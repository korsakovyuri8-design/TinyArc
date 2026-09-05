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
  type TicketStatus,
} from '@/engine/relay'
import type { Discipline } from '@/engine/taxonomy'
import { images } from '../images'
import { MAX_FILE_BYTES, artifactKey, storage } from '../storage'
import { prisma } from '../db'
import { TEXT_MAX, bounded } from '../text'
import { recordConflict, recordProjectTogether, recordRequestAnswered } from './collaboration'
import { approvedStages, stagesAwaitingClient } from './approval'
import { issueDueInvoices, paidStages } from './billing'
import { notifyProject } from './notify'
import { accrueFor } from './payouts'

export class NotYours extends Error {
  constructor() {
    super('This ticket is assigned to someone else.')
    this.name = 'NotYours'
  }
}

export class NoSuchRole extends Error {
  constructor(readonly discipline: string) {
    super('The project team has no such discipline — there is no one to ask.')
    this.name = 'NoSuchRole'
  }
}

export class TooLarge extends Error {
  constructor(readonly bytes: number) {
    super(
      'The file is over the limit stated by the field. That is an archive, not a drawing: keep it elsewhere and attach it as a link.',
    )
    this.name = 'TooLarge'
  }
}

export class NotOpen extends Error {
  constructor(readonly status: string) {
    super('The ticket is in a different state right now: this action is unavailable.')
    this.name = 'NotOpen'
  }
}

/**
 * Перевести задачу из одного состояния в другое — атомарно.
 *
 * Все переходы здесь были устроены одинаково: прочитали статус, проверили,
 * записали. Между чтением и записью успевает второй запрос, и это не
 * теоретическая беда. Двое операторов, нажавшие «принять» в один момент, оба
 * видели `submitted`, оба входили в приёмку и оба начисляли счётчики поставки:
 * человек получал двойной зачёт по метрикам, которыми решается его доступ к
 * следующим проектам. Проверено на стенде — счётчик рос на два.
 *
 * Условие стоит внутри самой записи: `updateMany` со статусом в `where`
 * меняет строку только если она всё ещё в ожидаемом состоянии, и делает это
 * одной операцией базы. Ноль изменённых строк означает, что переход уже
 * сделал кто-то другой.
 *
 * Работает и на SQLite, и на Postgres: это обычное условное обновление, а не
 * блокировка и не особенность драйвера.
 */
async function moveTicket(
  tx: Pick<typeof prisma, 'ticket'>,
  ticketId: string,
  from: readonly TicketStatus[],
  data: Parameters<typeof prisma.ticket.updateMany>[0]['data'],
): Promise<boolean> {
  const moved = await tx.ticket.updateMany({
    where: { id: ticketId, status: { in: [...from] } },
    data,
  })

  return moved.count === 1
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

  // Двойное нажатие не должно переписывать время взятия: от него считается
  // время реакции, и второй щелчок обнулял бы его в пользу человека.
  const moved = await moveTicket(prisma, ticketId, ['open'], {
    status: 'in_progress',
    claimedAt: new Date(),
  })

  if (!moved) throw new NotOpen('in_progress')
}

/** Комментарий на уровне тикета — единственный канал коммуникации в системе. */
export async function comment(
  ticketId: string,
  author: { role: 'bureau' | 'specialist'; specialistId?: string },
  body: string,
  options: { isConflict?: boolean } = {},
): Promise<string> {
  const text = bounded(body, TEXT_MAX.note)
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })

  if (author.role === 'specialist') {
    if (!author.specialistId || ticket.specialistId !== author.specialistId) throw new NotYours()
    if (ticket.status === 'blocked') throw new NotOpen(ticket.status)
  }

  const created = await prisma.ticketComment.create({
    data: {
      ticketId,
      authorRole: author.role,
      specialistId: author.role === 'specialist' ? author.specialistId : null,
      body: text,
      isConflict: options.isConflict ?? false,
    },
  })

  // Идентификатор комментария нужен письму: оно уходит один раз на реплику,
  // а не один раз на тикет — бюро пишет в него не однажды.
  return created.id
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
  const heading = bounded(title, TEXT_MAX.title)
  const text = bounded(body, TEXT_MAX.spec)

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
        title: heading,
        spec: text,
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
        body: `Request to ${toDiscipline}: ${heading}`,
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
  const text = bounded(note, TEXT_MAX.note)
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
        conflictNote: text,
      },
    }),
    prisma.ticketComment.create({
      data: {
        ticketId,
        authorRole: by.role,
        specialistId: by.role === 'specialist' ? by.specialistId : null,
        body: text,
        isConflict: true,
      },
    }),
  ])
}

/** Решение арбитра. Снимает флаг и остаётся в переписке тикета как ответ. */
export async function resolveConflict(ticketId: string, ruling: string): Promise<string> {
  const decision = bounded(ruling, TEXT_MAX.note)

  const [, comment] = await prisma.$transaction([
    prisma.ticket.update({
      where: { id: ticketId },
      data: { conflictRaisedAt: null, conflictBy: null, conflictNote: '' },
    }),
    prisma.ticketComment.create({
      data: { ticketId, authorRole: 'bureau', body: `The bureau’s ruling: ${decision}` },
    }),
  ])

  // Идентификатор решения нужен письму: оно уходит один раз на решение, а не
  // один раз на тикет — спор по одной задаче может случиться и второй.
  return comment.id
}

/** Предъявление работы. Приёмка — отдельное действие и делает её бюро. */
export async function submit(ticketId: string, specialistId: string): Promise<void> {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })

  if (ticket.specialistId !== specialistId) throw new NotYours()
  if (ticket.status !== 'in_progress' && ticket.status !== 'revision') throw new NotOpen(ticket.status)

  const now = new Date()

  const moved = await moveTicket(prisma, ticketId, ['in_progress', 'revision'], {
    status: 'submitted',
    submittedAt: now,
    // Сдал, не отметив принятие в работу, — время реакции считается по сдаче.
    claimedAt: ticket.claimedAt ?? now,
  })

  if (!moved) throw new NotOpen('submitted')
}

/** Возврат на круг. Питает Revision Rate и First Time Right (п.12). */
export async function requestRevision(ticketId: string, note: string): Promise<void> {
  const text = bounded(note, TEXT_MAX.note)
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })
  if (ticket.status !== 'submitted') throw new NotOpen(ticket.status)

  await prisma.$transaction(async (tx) => {
    // Круг правок считается тем же условным обновлением: два возврата подряд
    // приписали бы человеку два круга за одну работу, а круги идут в метрику
    // «сдано с первого раза».
    const moved = await moveTicket(tx, ticketId, ['submitted'], {
      status: 'revision',
      revisionRounds: { increment: 1 },
    })

    if (!moved) throw new NotOpen('revision')

    await tx.ticketComment.create({
      data: { ticketId, authorRole: 'bureau', body: text },
    })
  })
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
    // Здесь условие в записи важнее всего: за переходом идут счётчики
    // поставки, и вторая приёмка начисляла их повторно.
    const moved = await moveTicket(tx, ticketId, ['submitted'], {
      status: 'accepted',
      acceptedAt,
    })

    if (!moved) throw new NotOpen('accepted')

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

  /*
   * Обязательство перед человеком заводится здесь, а не при подтверждении
   * стадии заказчиком: приёмка бюро означает «сделано как заказано», и с этой
   * секунды бюро должно. Заказчик, молчащий неделю, работу несделанной не
   * делает.
   *
   * Вне транзакции и следом за гейтом, по той же причине: начисление читает
   * ставки и обходит проект целиком. Разрыв между приёмкой и начислением
   * лечится повторным вызовом — обязательство заводится с уникальностью в
   * схеме, и второй раз оно не начислится.
   */
  await accrueFor(ticket.projectId)
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
  const name = bounded(artifact.name, TEXT_MAX.title)
  const url = bounded(artifact.url, TEXT_MAX.url)

  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })

  if (ticket.specialistId !== specialistId) throw new NotYours()
  if (ticket.status === 'blocked') throw new NotOpen(ticket.status)

  await prisma.artifact.create({ data: { ticketId, ...artifact, name, url } })
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
  const name = bounded(file.name, TEXT_MAX.title)
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })

  if (ticket.specialistId !== specialistId) throw new NotYours()
  if (ticket.status === 'blocked') throw new NotOpen(ticket.status)

  if (file.bytes.byteLength > MAX_FILE_BYTES) {
    throw new TooLarge(file.bytes.byteLength)
  }

  const artifact = await prisma.artifact.create({
    data: {
      ticketId,
      name,
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
  const title = bounded(name, TEXT_MAX.title)
  const ask = bounded(prompt, TEXT_MAX.note)

  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })

  if (ticket.specialistId !== specialistId) throw new NotYours()
  if (ticket.status === 'blocked') throw new NotOpen(ticket.status)

  const image = await images().generate({ key: ticket.discipline, title, prompt: ask })

  await prisma.artifact.create({
    data: {
      ticketId,
      name: title,
      url: image.url,
      kind: 'render',
      source: image.source === 'stub' ? 'generated' : `generated:${image.source}`,
    },
  })
}

/**
 * Сколько принятых задач показывается на доске.
 *
 * Принятые нужны не как история, а как подтверждение: человек сдал работу и
 * должен увидеть, что её взяли. Для этого хватает последних.
 *
 * Живые задачи показываются все и потолка не имеют: их число ограничено
 * живыми проектами, и срезанная задача — это работа, которую никто не сделает,
 * потому что её никто не увидел. Принятые же не убывают никогда, и через год
 * работы доска превращалась в стену сданного, сквозь которую надо искать
 * сегодняшнее.
 */
export const ACCEPTED_SHOWN = 20

/**
 * Что специалист видит по своим тикетам.
 *
 * Постановка задачи выдаётся вместе с открытием тикета: до гейта у специалиста
 * есть название и стадия, но не содержание — входные артефакты ещё не готовы.
 *
 * Два запроса, а не один с потолком: живое и законченное живут по разным
 * правилам, и общий потолок однажды срезал бы открытую задачу.
 */
export async function ticketsOf(specialistId: string) {
  const shape = {
    include: {
      project: { select: { id: true, title: true, jurisdiction: true, typology: true } },
      dependsOn: { include: { prerequisite: { select: { discipline: true, status: true } } } },
    },
  } as const

  const [live, accepted, acceptedTotal] = await Promise.all([
    prisma.ticket.findMany({
      where: { specialistId, status: { not: 'accepted' } },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      ...shape,
    }),
    prisma.ticket.findMany({
      where: { specialistId, status: 'accepted' },
      orderBy: { acceptedAt: 'desc' },
      take: ACCEPTED_SHOWN,
      ...shape,
    }),
    prisma.ticket.count({ where: { specialistId, status: 'accepted' } }),
  ])

  const tickets = [...live, ...accepted].map((t) => ({
    ...t,
    spec: t.status === 'blocked' ? '' : t.spec,
    // Соседи по графу видны как дисциплины, не как люди (п.11).
    waitingOn: t.dependsOn
      .filter((d) => d.prerequisite.status !== 'accepted')
      .map((d) => d.prerequisite.discipline),
  }))

  return { tickets, acceptedTotal }
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
