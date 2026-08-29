/**
 * Blind Relay Protocol: работа с базой (концепт, п.11).
 *
 * Функции здесь — единственный способ сдвинуть тикет. Ни одна из них не создаёт
 * канала между двумя специалистами: комментарий всегда принадлежит тикету, а
 * автор бывает только двух видов — бюро и исполнитель этого тикета.
 */

import {
  REQUEST_SLA_HOURS,
  deliveryDeltaFor,
  dueDate,
  openable,
  type RelayTicket,
} from '@/engine/relay'
import type { Discipline } from '@/engine/taxonomy'
import { images } from '../images'
import { MAX_FILE_BYTES, artifactKey, storage } from '../storage'
import { prisma } from '../db'
import { recordConflict, recordProjectTogether, recordRequestAnswered } from './collaboration'
import { approvedStages, stagesAwaitingClient } from './approval'
import { issueDueInvoices, paidStages } from './billing'
import { notifyProject } from './notify'

export class NotYours extends Error {
  constructor() {
    super('Тикет назначен не вам.')
    this.name = 'NotYours'
  }
}

export class NoSuchRole extends Error {
  constructor(readonly discipline: string) {
    super('В команде проекта нет такой дисциплины — просить некого.')
    this.name = 'NoSuchRole'
  }
}

export class TooLarge extends Error {
  constructor(readonly bytes: number) {
    super(
      'Файл больше потолка, указанного у поля. Это уже не чертёж, а архив: положите его отдельно и приложите ссылкой.',
    )
    this.name = 'TooLarge'
  }
}

export class NotOpen extends Error {
  constructor(readonly status: string) {
    super('Тикет сейчас в другом статусе: это действие недоступно.')
    this.name = 'NotOpen'
  }
}

async function relayTickets(projectId: string): Promise<RelayTicket[]> {
  const tickets = await prisma.ticket.findMany({
    where: { projectId },
    include: { dependsOn: true },
  })

  return tickets.map((t) => ({
    id: t.id,
    status: t.status as RelayTicket['status'],
    stage: t.stage as RelayTicket['stage'],
    dependsOn: t.dependsOn.map((d) => d.prerequisiteId),
  }))
}

/**
 * Открывает тикеты, у которых приняты все зависимости.
 *
 * Вызывается после каждой приёмки и после сборки команды. Другого способа
 * перевести тикет в работу нет — руками статус не ставится.
 */
export async function applyGates(projectId: string): Promise<string[]> {
  /*
   * Три условия, и два из них не про граф.
   *
   * Подтверждённые заказчиком стадии — разрабатывать документацию по
   * неподтверждённой концепции значит готовить переделку (п.12б). Оплаченные
   * стадии — открытый тикет это начатая работа живого человека, и начинать её
   * в долг бюро не вправе (п.14а).
   *
   * Счета выставляются здесь же, до открытия: гейт и счёт смотрят на одно и то
   * же состояние, и разносить их по разным вызовам значит однажды забыть один
   * из них.
   */
  await issueDueInvoices(projectId)

  const [tickets, approved, paid] = await Promise.all([
    relayTickets(projectId),
    approvedStages(projectId),
    paidStages(projectId),
  ])

  const ready = openable(tickets, approved, paid)

  /*
   * Раннего выхода здесь нет намеренно.
   *
   * Пустой список — это как раз те два случая, ради которых письма и заводились:
   * стадия не оплачена и стадия не подтверждена. Гейт ничего не открывает
   * именно потому, что ждёт человека, — и если уйти отсюда молча, человек
   * никогда не узнает, что ждут его.
   */
  const now = new Date()

  for (const id of ready) {
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id } })

    await prisma.ticket.update({
      where: { id },
      data: { status: 'open', openedAt: now, dueAt: dueDate(now, ticket.slaHours) },
    })
  }

  /*
   * Письма отправляются здесь же, а не там, где «случилось событие».
   *
   * Гейт — единственное место, где состояние проекта меняется: он открывает
   * задачи, он же зовёт выставление счетов, и он же работает после каждой
   * приёмки и подтверждения. Разносить отправку по местам событий значит
   * однажды забыть одно из них и молча перестать звать человека.
   *
   * Повторные вызовы безопасны: каждое письмо уходит один раз, и сторожит это
   * запись в базе, а не аккуратность вызывающего.
   */
  await notifyProject(projectId, ready)

  return ready
}

/**
 * Взять тикет в работу.
 *
 * Отдельное действие, а не побочный эффект первого комментария: время до
 * принятия задачи — это метрика (п.12), и она должна отмечаться явно.
 */
export async function claim(ticketId: string, specialistId: string): Promise<void> {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })

  if (ticket.specialistId !== specialistId) throw new NotYours()
  if (ticket.status !== 'open') throw new NotOpen(ticket.status)

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { status: 'in_progress', claimedAt: new Date() },
  })
}

/** Комментарий на уровне тикета — единственный канал коммуникации в системе. */
export async function comment(
  ticketId: string,
  author: { role: 'bureau' | 'specialist'; specialistId?: string },
  body: string,
  options: { isConflict?: boolean } = {},
): Promise<void> {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })

  if (author.role === 'specialist') {
    if (!author.specialistId || ticket.specialistId !== author.specialistId) throw new NotYours()
    if (ticket.status === 'blocked') throw new NotOpen(ticket.status)
  }

  await prisma.ticketComment.create({
    data: {
      ticketId,
      authorRole: author.role,
      specialistId: author.role === 'specialist' ? author.specialistId : null,
      body,
      isConflict: options.isConflict ?? false,
    },
  })
}

/**
 * Запрос смежной дисциплине.
 *
 * Закрывает дыру между «сделал молча» и «пошёл к арбитру». Инженеру, которому
 * вентканал упирается в дверь, не нужен спор — ему нужно, чтобы дверь сдвинули.
 * Раньше на это в системе не было ничего: комментарий в своём тикете смежник
 * не увидит, а конфликт — тяжёлая эскалация, останавливающая работу.
 *
 * Прямого канала при этом не появляется. Запрос становится обычным тикетом для
 * той дисциплины: с исполнителем, сроком и приёмкой бюро — как всё остальное
 * (п.11). Автор запроса виден адресату дисциплиной, а не именем.
 */
export async function requestFrom(
  ticketId: string,
  fromSpecialistId: string,
  toDiscipline: Discipline,
  title: string,
  body: string,
): Promise<string> {
  const source = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })

  if (source.specialistId !== fromSpecialistId) throw new NotYours()
  if (source.status === 'blocked') throw new NotOpen(source.status)

  const slot = await prisma.teamSlot.findUnique({
    where: { projectId_discipline: { projectId: source.projectId, discipline: toDiscipline } },
  })

  if (!slot) throw new NoSuchRole(toDiscipline)

  const now = new Date()

  const created = await prisma.$transaction(async (tx) => {
    const request = await tx.ticket.create({
      data: {
        projectId: source.projectId,
        discipline: toDiscipline,
        stage: source.stage,
        kind: 'request',
        requestedFromId: source.id,
        title,
        spec: body,
        specialistId: slot.specialistId,
        slaHours: REQUEST_SLA_HOURS,
        // Запрос не ждёт гейта: он и появился потому, что работа уже идёт.
        status: 'open',
        openedAt: now,
        dueAt: dueDate(now, REQUEST_SLA_HOURS),
      },
    })

    // В исходном тикете остаётся след: спрашивавший должен видеть, что он
    // спросил, не выходя из своей задачи.
    await tx.ticketComment.create({
      data: {
        ticketId: source.id,
        authorRole: 'specialist',
        specialistId: fromSpecialistId,
        body: `Запрос дисциплине «${toDiscipline}»: ${title}`,
      },
    })

    return request
  })

  return created.id
}

/**
 * Арбитраж (концепт, п.11).
 *
 * Участники не договариваются между собой — договариваться им негде. Тот, кто
 * упёрся, поднимает конфликт, система сигналит бюро, решает бюро.
 */
export async function raiseConflict(
  ticketId: string,
  by: { role: 'bureau' | 'specialist'; specialistId?: string },
  note: string,
): Promise<void> {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })

  if (by.role === 'specialist' && ticket.specialistId !== by.specialistId) throw new NotYours()
  if (ticket.status === 'blocked') throw new NotOpen(ticket.status)

  // Спор на запросе — это спор между двумя конкретными людьми, и он должен
  // осесть в их истории: пара, доходящая до арбитра на каждом объекте, стоит
  // бюро рабочего времени.
  if (ticket.kind === 'request' && ticket.requestedFromId && ticket.specialistId) {
    const source = await prisma.ticket.findUnique({ where: { id: ticket.requestedFromId } })
    if (source?.specialistId) await recordConflict(source.specialistId, ticket.specialistId)
  }

  await prisma.$transaction([
    prisma.ticket.update({
      where: { id: ticketId },
      data: {
        conflictRaisedAt: new Date(),
        conflictBy: by.role === 'specialist' ? (by.specialistId ?? null) : null,
        conflictNote: note,
      },
    }),
    prisma.ticketComment.create({
      data: {
        ticketId,
        authorRole: by.role,
        specialistId: by.role === 'specialist' ? by.specialistId : null,
        body: note,
        isConflict: true,
      },
    }),
  ])
}

/** Решение арбитра. Снимает флаг и остаётся в переписке тикета как ответ. */
export async function resolveConflict(ticketId: string, ruling: string): Promise<void> {
  await prisma.$transaction([
    prisma.ticket.update({
      where: { id: ticketId },
      data: { conflictRaisedAt: null, conflictBy: null, conflictNote: '' },
    }),
    prisma.ticketComment.create({
      data: { ticketId, authorRole: 'bureau', body: `Решение бюро: ${ruling}` },
    }),
  ])
}

/** Предъявление работы. Приёмка — отдельное действие и делает её бюро. */
export async function submit(ticketId: string, specialistId: string): Promise<void> {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })

  if (ticket.specialistId !== specialistId) throw new NotYours()
  if (ticket.status !== 'in_progress' && ticket.status !== 'revision') throw new NotOpen(ticket.status)

  const now = new Date()

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: 'submitted',
      submittedAt: now,
      // Сдал, не отметив принятие в работу, — время реакции считается по сдаче.
      claimedAt: ticket.claimedAt ?? now,
    },
  })
}

/** Возврат на круг. Питает Revision Rate и First Time Right (п.12). */
export async function requestRevision(ticketId: string, note: string): Promise<void> {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })
  if (ticket.status !== 'submitted') throw new NotOpen(ticket.status)

  await prisma.$transaction([
    prisma.ticket.update({
      where: { id: ticketId },
      data: { status: 'revision', revisionRounds: { increment: 1 } },
    }),
    prisma.ticketComment.create({
      data: { ticketId, authorRole: 'bureau', body: note },
    }),
  ])
}

/**
 * Приёмка. Здесь и только здесь меняются счётчики специалиста — из времён
 * самого тикета, а не из чьей-либо оценки (п.12).
 */
export async function accept(ticketId: string): Promise<void> {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })
  if (ticket.status !== 'submitted') throw new NotOpen(ticket.status)

  const acceptedAt = new Date()
  const delta = deliveryDeltaFor({
    openedAt: ticket.openedAt,
    claimedAt: ticket.claimedAt,
    acceptedAt,
    dueAt: ticket.dueAt,
    revisionRounds: ticket.revisionRounds,
  })

  await prisma.$transaction(async (tx) => {
    await tx.ticket.update({
      where: { id: ticketId },
      data: { status: 'accepted', acceptedAt },
    })

    if (ticket.specialistId) {
      await tx.specialist.update({
        where: { id: ticket.specialistId },
        data: {
          deliveredTickets: { increment: delta.deliveredTickets },
          onTimeTickets: { increment: delta.onTimeTickets },
          firstTimeRightTickets: { increment: delta.firstTimeRightTickets },
          responseMinutesTotal: { increment: delta.responseMinutes },
          revisionRoundsTotal: { increment: delta.revisionRounds },
        },
      })
    }
  })

  // Закрытый запрос — это сработанность: одна дисциплина спросила, другая
  // ответила, и работа пошла дальше без бюро.
  if (ticket.kind === 'request' && ticket.requestedFromId && ticket.specialistId) {
    const source = await prisma.ticket.findUnique({ where: { id: ticket.requestedFromId } })
    if (source?.specialistId) await recordRequestAnswered(source.specialistId, ticket.specialistId)
  }

  await applyGates(ticket.projectId)
  await refreshProjectStatus(ticket.projectId)
}

/** Статус проекта выводится из тикетов, а не ставится руками. */
export async function refreshProjectStatus(projectId: string): Promise<void> {
  const [before, tickets] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { status: true } }),
    prisma.ticket.findMany({ where: { projectId }, select: { status: true } }),
  ])

  if (tickets.length === 0) return

  const allAccepted = tickets.every((t) => t.status === 'accepted')
  const anyStarted = tickets.some((t) => t.status !== 'blocked')

  // Закрыт — это когда сказали оба: бюро приняло всё и заказчик подтвердил
  // каждую стадию (п.12б). Иначе проект закрывался бы, пока последняя стадия
  // ещё ждёт его слова, — и «закрыт» означало бы только «мы закончили».
  const pending = allAccepted ? await stagesAwaitingClient(projectId) : []
  const closed = allAccepted && pending.length === 0

  const next = closed ? 'delivered' : anyStarted ? 'delivering' : 'assembled'

  if (next === before.status) return

  await prisma.project.update({ where: { id: projectId }, data: { status: next } })

  // Совместный проект засчитывается на переходе в закрытое состояние, а не при
  // каждом пересчёте: иначе один проект накрутил бы паре историю на ровном
  // месте. «Работали вместе» — про доведённую работу, а не про общий список.
  if (next === 'delivered') await recordProjectTogether(projectId)
}

/** Артефакт тикета: то, что гейт передаёт дальше по графу. */
export async function attachArtifact(
  ticketId: string,
  specialistId: string,
  artifact: { name: string; url: string; kind: string; source?: string },
): Promise<void> {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })

  if (ticket.specialistId !== specialistId) throw new NotYours()
  if (ticket.status === 'blocked') throw new NotOpen(ticket.status)

  await prisma.artifact.create({ data: { ticketId, ...artifact } })
}

/**
 * Загрузить файл к задаче.
 *
 * Файл ложится в хранилище, а в базу — ключ, имя и размер. Ключ собирается из
 * идентификаторов, а не из имени файла: имя приходит от человека, и в пути оно
 * означает и пробелы, и кириллицу, и «../» в одном месте.
 *
 * Запись создаётся первой и только потом заполняется ключом. Обратный порядок
 * оставлял бы в хранилище файлы, на которые никто не ссылается, — и заметить
 * их можно было бы только по счёту за хранение.
 */
export async function uploadArtifact(
  ticketId: string,
  specialistId: string,
  file: { name: string; kind: string; bytes: Uint8Array; contentType: string },
): Promise<string> {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })

  if (ticket.specialistId !== specialistId) throw new NotYours()
  if (ticket.status === 'blocked') throw new NotOpen(ticket.status)

  if (file.bytes.byteLength > MAX_FILE_BYTES) {
    throw new TooLarge(file.bytes.byteLength)
  }

  const artifact = await prisma.artifact.create({
    data: {
      ticketId,
      name: file.name,
      kind: file.kind,
      sizeBytes: file.bytes.byteLength,
      contentType: file.contentType,
    },
  })

  const key = artifactKey(ticket.projectId, artifact.id)

  try {
    await storage().put(key, file.bytes, file.contentType)
  } catch (error) {
    // Запись без файла хуже, чем отсутствие записи: человек видит его в списке
    // и не может скачать.
    await prisma.artifact.delete({ where: { id: artifact.id } }).catch(() => {})
    throw error
  }

  await prisma.artifact.update({ where: { id: artifact.id }, data: { storageKey: key } })

  return artifact.id
}

/**
 * Изображение к тикету.
 *
 * Кладётся тем же путём, что и любой другой файл, но с пометкой происхождения:
 * это материал, полученный генератором, и в записях он отличим от ручной
 * работы. Что с ним делать — брать в работу, переделывать или выбросить —
 * решает специалист; предъявляет он то, за что готов отвечать.
 */
export async function generateRender(
  ticketId: string,
  specialistId: string,
  prompt: string,
  name: string,
): Promise<void> {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })

  if (ticket.specialistId !== specialistId) throw new NotYours()
  if (ticket.status === 'blocked') throw new NotOpen(ticket.status)

  const image = await images().generate({ key: ticket.discipline, title: name, prompt })

  await prisma.artifact.create({
    data: {
      ticketId,
      name,
      url: image.url,
      kind: 'render',
      source: image.source === 'stub' ? 'generated' : `generated:${image.source}`,
    },
  })
}

/**
 * Что специалист видит по своим тикетам.
 *
 * Постановка задачи выдаётся вместе с открытием тикета: до гейта у специалиста
 * есть название и стадия, но не содержание — входные артефакты ещё не готовы.
 */
export async function ticketsOf(specialistId: string) {
  const tickets = await prisma.ticket.findMany({
    where: { specialistId },
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    include: {
      project: { select: { id: true, title: true, jurisdiction: true, typology: true } },
      dependsOn: { include: { prerequisite: { select: { discipline: true, status: true } } } },
    },
  })

  return tickets.map((t) => ({
    ...t,
    spec: t.status === 'blocked' ? '' : t.spec,
    // Соседи по графу видны как дисциплины, не как люди (п.11).
    waitingOn: t.dependsOn
      .filter((d) => d.prerequisite.status !== 'accepted')
      .map((d) => d.prerequisite.discipline),
  }))
}

/**
 * Входные артефакты тикета: то, что сдали предшественники по графу.
 *
 * Это и есть хендофф — архитектор выкладывает модель, смежник её забирает.
 * Имени автора здесь нет, только дисциплина.
 */
export async function inboundArtifacts(ticketId: string) {
  const dependencies = await prisma.ticketDependency.findMany({
    where: { dependentId: ticketId },
    include: {
      prerequisite: {
        select: { discipline: true, status: true, artifacts: true },
      },
    },
  })

  return dependencies
    .filter((d) => d.prerequisite.status === 'accepted')
    .flatMap((d) =>
      d.prerequisite.artifacts.map((a) => ({
        id: a.id,
        name: a.name,
        url: a.url,
        storageKey: a.storageKey,
        kind: a.kind,
        fromDiscipline: d.prerequisite.discipline,
      })),
    )
}
