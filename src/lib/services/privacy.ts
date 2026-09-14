/**
 * Права из политики: обезличить профиль и удалить данные проекта.
 *
 * Политика обещала оба действия с самого начала, а сделать их было нечем.
 * Обещание без механизма — это не политика, а текст; на первом же обращении
 * оно превращается в ручную правку базы, то есть в необратимую ошибку под
 * давлением времени.
 *
 * Оба действия необратимы и оба оставляют дату: по ней видно, что
 * обязательство исполнено, и когда. Ничего «мягкого удаления» здесь нет —
 * данные, которые человек попросил стереть, не должны лежать под флагом.
 *
 * Что остаётся, названо прямо и не по недосмотру:
 *
 * — метрики поставки специалиста. Они уже обезличены и держат историю
 *   проектов, в которых он участвовал; удалить их значит переписать чужие
 *   проекты задним числом;
 * — счета. Их хранение — обязанность перед страной регистрации, и человек
 *   не может её снять с нас своим обращением;
 * — тикеты и их приёмка. По ним считаются метрики других людей.
 *
 * Журнал уведомлений остаётся, но без адреса. Он хранит адрес затем, чтобы на
 * жалобу «мне ничего не приходило» можно было ответить фактом, — а после
 * обезличивания жаловаться некому, и живой адрес в нём становится ровно тем,
 * что человек просил стереть. Строка при этом не удаляется: пара «повод и
 * его цель» гасит повторные письма, и снять её значит однажды написать
 * человеку, которого больше нет, ещё раз.
 */

import { randomBytes } from 'node:crypto'
import { prisma } from '../db'
import { artifactKey, storage } from '../storage'
import { stepOut } from './handover'

/** Ключ, который заведомо никому не подойдёт. */
function deadKey(prefix: string): string {
  return `${prefix}-${randomBytes(9).toString('hex')}`
}

export class NotErasable extends Error {}

/** Проекты, которые ещё идут: на закрытых выходить не из чего. */
const RUNNING = ['draft', 'assembled', 'delivering'] as const

/**
 * Причина выхода, которая уезжает в тикет к заменяющему.
 *
 * Она не называет обращения. Тот, кто придёт на замену, увидит её вместе с
 * задачей, и «человек попросил себя стереть» рассказало бы команде ровно то,
 * что человек просил не рассказывать. Сказано то, что заменяющему нужно
 * знать: прежнего исполнителя в пуле больше нет.
 */
const LEFT_THE_POOL = 'The previous contributor is no longer in the pool.'

/**
 * Обезличить профиль специалиста.
 *
 * Личное уходит: имя, почта, ссылка на портфолио и сами работы. Ключ
 * заменяется на заведомо непригодный — доступ закрывается тем же действием, и
 * это важнее аккуратности: обезличенный профиль, в который можно войти старым
 * ключом, обезличен только на экране.
 *
 * Статус `removed` выводит человека из отбора, потому что в выборку попадает
 * только `active`. Отдельной проверки для этого не нужно, и её отсутствие —
 * не упущение: гейт по статусу уже стоит первым.
 *
 * Сначала — выход из живых проектов, и только потом обезличивание. Иначе
 * получался тупик, которого никто не видит: задачи остаются за человеком,
 * войти он уже не может, сдать работу не может, замену никто не ищет — проект
 * стоит молча до просрочки. Роли передаёт тот же механизм, что и при обычном
 * выходе (п.10а): замену выбирает алгоритм, бюро не назначает.
 *
 * Обращение при этом не откладывается до удобного бюро момента. Право не
 * зависит от того, сколько у нас незакрытых задач, и отказ «сначала сдайте
 * работу» был бы отказом по существу. Если замены в прогоне нет, механизм
 * сам вернёт задачу бюро и скажет об этом в тикете — это честное состояние,
 * а не повод не исполнять просьбу.
 */
export type Anonymised = {
  /** Ролей передано алгоритму. */
  handed: number
  /** Ролей, которым замены в прогоне не нашлось: задача вернулась бюро. */
  stranded: number
}

export async function anonymiseSpecialist(id: string): Promise<Anonymised> {
  const row = await prisma.specialist.findUnique({ where: { id }, select: { removedAt: true } })
  if (!row) throw new NotErasable('Specialist not found.')
  if (row.removedAt) throw new NotErasable('This profile is already anonymised.')

  const live = await prisma.teamSlot.findMany({
    where: { specialistId: id, project: { status: { in: [...RUNNING] } } },
    select: { projectId: true },
  })

  let handed = 0
  let stranded = 0

  for (const slot of live) {
    const result = await stepOut(id, slot.projectId, LEFT_THE_POOL)
    if (result.replaced) handed += 1
    else stranded += 1
  }

  const person = await prisma.specialist.findUniqueOrThrow({
    where: { id },
    select: { email: true },
  })
  const dead = `${deadKey('removed')}@removed.invalid`

  await prisma.$transaction([
    prisma.portfolioItem.deleteMany({ where: { specialistId: id } }),
    // Адрес уходит и из журнала уведомлений: он там для ответа на жалобу,
    // а жаловаться после обезличивания уже некому.
    prisma.notification.updateMany({
      where: { email: person.email },
      data: { email: dead },
    }),
    prisma.specialist.update({
      where: { id },
      data: {
        displayName: 'Former specialist',
        email: dead,
        accessKey: deadKey('removed'),
        portfolioUrl: '',
        status: 'removed',
        subscription: 'none',
        availabilityStatus: 'busy',
        weeklyCapacityHours: 0,
        removedAt: new Date(),
      },
    }),
  ])

  return { handed, stranded }
}

/**
 * Удалить данные проекта.
 *
 * Только после закрытия: пока проект идёт, удалять его данные значит
 * остановить работу людей, которые в этот момент по ним чертят. Отдельного
 * согласия команды на это не требуется — материалы принадлежат заказчику
 * (п.13), — но и удалить их посреди выпуска нельзя.
 *
 * Файлы стираются из хранилища, а не только из базы: строка без файла — это
 * не удаление, а потеря ссылки на него.
 */
export async function eraseProject(id: string): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id },
    select: { status: true, dataErasedAt: true },
  })

  if (!project) throw new NotErasable('Project not found.')
  if (project.dataErasedAt) throw new NotErasable('The data of this project is already erased.')
  if (project.status !== 'delivered' && project.status !== 'rejected') {
    throw new NotErasable('The project is still running: its data is erased after it closes.')
  }

  const artifacts = await prisma.artifact.findMany({
    where: { ticket: { projectId: id }, storageKey: { not: null } },
    select: { id: true, storageKey: true },
  })

  for (const artifact of artifacts) {
    // Промах по одному файлу не отменяет удаления остальных: хранилище может
    // не знать ключа, если файл уже убрали руками.
    await storage()
      .remove(artifact.storageKey ?? artifactKey(id, artifact.id))
      .catch((error) => console.error('Файл не удалён из хранилища:', error))
  }

  const client = await prisma.project.findUniqueOrThrow({
    where: { id },
    select: { clientEmail: true },
  })
  const dead = `${deadKey('erased')}@removed.invalid`

  await prisma.$transaction([
    prisma.artifact.deleteMany({ where: { ticket: { projectId: id } } }),
    // Тот же случай, что и у специалиста: журнал остаётся, адрес — нет.
    prisma.notification.updateMany({
      where: { email: client.clientEmail },
      data: { email: dead },
    }),
    prisma.ticketComment.deleteMany({ where: { ticket: { projectId: id } } }),
    prisma.clientMessage.deleteMany({ where: { projectId: id } }),
    prisma.designDirection.deleteMany({ where: { projectId: id } }),
    prisma.ticket.updateMany({ where: { projectId: id }, data: { spec: '', conflictNote: '' } }),
    prisma.project.update({
      where: { id },
      data: {
        clientName: 'Erased at the client’s request',
        clientEmail: dead,
        clientKey: deadKey('erased'),
        briefNotes: '',
        dataErasedAt: new Date(),
      },
    }),
  ])
}

/**
 * Копия своих данных.
 *
 * Политика называет шесть прав и утверждает, что это не намерения. Пять из них
 * были действиями: обезличивание, стирание, правка профиля, отзыв согласия,
 * возражение. Первое — «узнать, какие ваши данные у нас есть, и получить
 * копию» — оставалось текстом, и на первом же обращении превратилось бы ровно
 * в то, против чего написан этот модуль: в выборку из базы руками, под
 * давлением срока, с шансом отдать чужое.
 *
 * Здесь важнее не полнота, а граница. Копия отдаётся **одному человеку**, и
 * всё, что принадлежит другим, из неё вычтено: заказчик не получает почту и
 * ключи специалистов (это прямо обещано в политике), специалист не получает
 * имён и контактов заказчика и других участников. Копия, собранная «на всякий
 * случай пошире», — это утечка, оформленная как исполнение права.
 *
 * Форма — обычные данные, а не файл: собрать из них выгрузку может страница,
 * а служба обязана отвечать за состав.
 */
export type PersonalCopy = {
  subject: 'specialist' | 'client'
  generatedAt: string
  /** Что отдано. Человек должен видеть состав, а не только содержимое. */
  sections: string[]
  data: Record<string, unknown>
}

export async function copyForSpecialist(id: string): Promise<PersonalCopy> {
  const [person, works, tickets, payouts, rates] = await Promise.all([
    prisma.specialist.findUnique({ where: { id } }),
    prisma.portfolioItem.findMany({ where: { specialistId: id } }),
    /*
     * События задач — без постановки и без комментариев.
     *
     * Постановку пишет бюро под чужой проект, а в комментариях есть реплики
     * других людей. Человеку принадлежит факт его работы: что взял, когда сдал,
     * приняли ли, сколько раз возвращали, — из этого и считаются его метрики.
     */
    prisma.ticket.findMany({
      where: { specialistId: id },
      select: {
        discipline: true,
        stage: true,
        status: true,
        slaHours: true,
        openedAt: true,
        claimedAt: true,
        submittedAt: true,
        acceptedAt: true,
        dueAt: true,
        revisionRounds: true,
      },
    }),
    prisma.payout.findMany({
      where: { specialistId: id },
      select: { discipline: true, stage: true, amount: true, currency: true, status: true, accruedAt: true },
    }),
    prisma.specialistRate.findMany({
      where: { specialistId: id },
      select: { discipline: true, stage: true, amount: true, currency: true },
    }),
  ])

  if (!person) throw new NotErasable('There is no such specialist.')

  /*
   * Профиль отдаётся без ключа доступа.
   *
   * Ключ — это учётные данные, а не сведения о человеке, и он у него уже есть.
   * Копия данных путешествует: её пересылают, кладут в почту и в облако, и
   * ключ внутри неё превращает исполнение права в способ потерять доступ.
   */
  const { accessKey: _accessKey, ...profile } = person

  return {
    subject: 'specialist',
    generatedAt: new Date().toISOString(),
    sections: [
      'profile — what you declared about yourself',
      'portfolio — the works you listed',
      'work — task events your delivery metrics are computed from',
      'money — your own rates and what the bureau owes or has paid',
    ],
    data: { profile, portfolio: works, work: tickets, rates, payouts },
  }
}

export async function copyForClient(id: string): Promise<PersonalCopy> {
  const [project, messages, invoices, directions, artifacts] = await Promise.all([
    prisma.project.findUnique({ where: { id } }),
    prisma.clientMessage.findMany({
      where: { projectId: id },
      select: { author: true, body: true, createdAt: true },
    }),
    prisma.invoice.findMany({
      where: { projectId: id },
      select: { stage: true, amount: true, currency: true, status: true, basisJson: true, createdAt: true, paidAt: true },
    }),
    prisma.designDirection.findMany({
      where: { projectId: id },
      select: { title: true, summary: true, chosen: true, createdAt: true },
    }),
    /*
     * Материалы — списком, а не файлами. Файл принадлежит проекту и выдаётся
     * комплектом; здесь человек спрашивает, какие данные о нём у нас есть.
     */
    prisma.artifact.findMany({
      where: { ticket: { projectId: id } },
      select: { name: true, kind: true, createdAt: true },
    }),
  ])

  if (!project) throw new NotErasable('There is no such project.')

  /*
   * Ключ кабинета не отдаётся по той же причине, что и ключ специалиста.
   *
   * Состав команды тоже не отдаётся: почта, ключи и контакты специалистов
   * заказчику не передаются — это обещано в политике прямо, и обращение за
   * своей копией не тот случай, когда обещание пересматривают.
   */
  const { clientKey: _clientKey, ...brief } = project

  return {
    subject: 'client',
    generatedAt: new Date().toISOString(),
    sections: [
      'brief — what you told us about the project and the site',
      'conversation — your thread with the bureau',
      'invoices — what was billed, with the breakdown',
      'directions — the design directions offered and the one you chose',
      'materials — the list of files delivered on the project',
    ],
    data: { brief, conversation: messages, invoices, directions, materials: artifacts },
  }
}
