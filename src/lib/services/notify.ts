/**
 * Письма о том, что от человека чего-то ждут.
 *
 * До этого писем было два: ключ доступа и приглашение в пул. Всё остальное
 * человек узнавал, только зайдя в кабинет, — а он туда не заходит. Заказчику
 * выставлен счёт, и он об этом не знает; стадия ждёт его подтверждения, и он
 * не знает; специалисту открыли задачу с часовым сроком, и он не знает, а срок
 * уже идёт. Последнее хуже всех: метрика поставки считается от открытия
 * задачи, то есть мы наказывали за молчание человека, которого не позвали.
 *
 * Поводы возникают внутри идемпотентных функций — гейт зовут после каждой
 * приёмки, после подтверждения и после оплаты. Поэтому каждое письмо
 * отправляется ровно один раз, и сторожит это запись в базе, а не аккуратность
 * вызывающего кода.
 *
 * Границу между сторонами письма не пересекают (п.13): заказчику не уходит
 * ничего о конкретных исполнителях, специалисту — ничего о заказчике.
 */

import { DOC_STAGE_LABELS } from '../labels'
import { absolute, siteUrl } from '../site'
import { mailer } from '../mail'
import { prisma } from '../db'
import { company } from '../legal'
import type { DocStage } from '@/engine/taxonomy'

/** Одновременных отправок. Столько же, сколько на рассылке приглашений. */
const MAIL_CONCURRENCY = 5

type Kind = 'invoice_issued' | 'stage_awaiting' | 'ticket_open'

/**
 * Отправить письмо не более одного раза на повод.
 *
 * Порядок намеренный: сначала запись, потом отправка. Уникальный ключ решает
 * гонку двух одновременных вызовов гейта — второй просто ничего не сделает.
 *
 * Если отправка провалилась, запись снимается, и следующий вызов попробует
 * снова. Дубликат письма неприятен, потерянное уведомление означает срок,
 * идущий на человеке, которого не позвали, — из двух рисков выбран первый.
 */
async function once(
  kind: Kind,
  targetId: string,
  email: string,
  send: () => Promise<void>,
): Promise<boolean> {
  if (!email) return false

  let claimed: string

  try {
    const row = await prisma.notification.create({ data: { kind, targetId, email } })
    claimed = row.id
  } catch {
    // Уже отправляли. Это не ошибка: сюда заходят по нескольку раз на событие.
    return false
  }

  try {
    await send()
    return true
  } catch (error) {
    await prisma.notification.delete({ where: { id: claimed } }).catch(() => {})
    console.error(`Письмо ${kind}/${targetId} не ушло:`, error)
    return false
  }
}

const SIGNATURE = ['', 'TinyArc Cloud Bureau', siteUrl()]

/** Выставлен счёт: без письма заказчик узнает об этом, только зайдя в кабинет. */
async function invoiceIssued(invoiceId: string): Promise<void> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { project: { select: { title: true, clientEmail: true, clientName: true } } },
  })

  if (!invoice || invoice.status !== 'issued') return

  const details = company()
  const stage = DOC_STAGE_LABELS[invoice.stage as DocStage] ?? invoice.stage

  await once('invoice_issued', invoice.id, invoice.project.clientEmail, async () => {
    await mailer().send({
      to: invoice.project.clientEmail,
      subject: `Счёт за стадию «${stage}» — ${invoice.project.title}`,
      body: [
        `${invoice.project.clientName}, здравствуйте.`,
        '',
        `По проекту «${invoice.project.title}» выставлен счёт за стадию «${stage}»:`,
        `${invoice.amount} ${invoice.currency}.`,
        '',
        'Стадия оплачивается до начала работы по ней: команда — живые люди, и их',
        'время начинается в тот момент, когда открывается задача. Разбор суммы —',
        'из чего она сложилась — виден в кабинете проекта.',
        '',
        details.bank ? `Реквизиты:\n${details.bank}` : 'Реквизиты пришлём ответом на это письмо.',
        '',
        `Кабинет проекта: ${absolute('/enter')}`,
        ...SIGNATURE,
      ].join('\n'),
    })
  })
}

/** Стадия закончена бюро и ждёт слова заказчика. */
async function stageAwaiting(projectId: string, stage: DocStage): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { title: true, clientEmail: true, clientName: true },
  })

  if (!project) return

  const label = DOC_STAGE_LABELS[stage] ?? stage

  await once('stage_awaiting', `${projectId}:${stage}`, project.clientEmail, async () => {
    await mailer().send({
      to: project.clientEmail,
      subject: `Стадия «${label}» ждёт вашего подтверждения — ${project.title}`,
      body: [
        `${project.clientName}, здравствуйте.`,
        '',
        `По проекту «${project.title}» закончена стадия «${label}»: бюро приняло все`,
        'её задачи. Это означает «сделано так, как поставлено».',
        '',
        'Осталось ваше слово — «заказано было именно это». Пока его нет, следующая',
        'стадия не начинается: разрабатывать документацию по неподтверждённой',
        'концепции значит готовить переделку.',
        '',
        'Если есть замечания — не подтверждайте, а напишите нам из кабинета: мы',
        'переведём их в круг правок.',
        '',
        `Кабинет проекта: ${absolute('/enter')}`,
        ...SIGNATURE,
      ].join('\n'),
    })
  })
}

/**
 * Открыта задача, и срок по ней пошёл.
 *
 * Ничего о заказчике в письме нет — ни имени, ни адреса объекта. Специалист
 * видит постановку в своей доске, а не в почте (п.11, п.13).
 */
async function ticketOpen(ticketId: string): Promise<void> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { specialist: { select: { email: true, displayName: true } } },
  })

  if (!ticket?.specialist || ticket.status !== 'open') return

  const due = ticket.dueAt
    ? `Срок: до ${ticket.dueAt.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}.`
    : `Срок: ${ticket.slaHours} ч с этого момента.`

  await once('ticket_open', ticket.id, ticket.specialist.email, async () => {
    await mailer().send({
      to: ticket.specialist!.email,
      subject: `Новая задача: ${ticket.title}`,
      body: [
        `${ticket.specialist!.displayName}, здравствуйте.`,
        '',
        `Вам открыта задача: ${ticket.title}.`,
        due,
        '',
        'Постановка и входные данные — на доске работ. Взять в работу нужно там же:',
        'срок считается от открытия задачи, а не от того, когда вы её увидели.',
        '',
        `Доска работ: ${absolute('/enter')}`,
        ...SIGNATURE,
      ].join('\n'),
    })
  })
}

/**
 * Разослать всё, что назрело по проекту.
 *
 * Вызывается из гейта — там же, где меняется состояние. Разносить отправку по
 * местам, где событие «происходит», значит однажды забыть одно из них; здесь
 * же достаточно одного вызова, а повторы гасит запись об отправке.
 */
export async function notifyProject(projectId: string, openedTicketIds: string[]): Promise<void> {
  const [invoices, awaiting] = await Promise.all([
    prisma.invoice.findMany({ where: { projectId, status: 'issued' }, select: { id: true } }),
    // Импорт внутри функции, а не сверху: approval зовёт billing, billing —
    // relay, и модуль уведомлений замкнул бы этот круг на себе.
    import('./approval').then((m) => m.stagesAwaitingClient(projectId)),
  ])

  const jobs: (() => Promise<void>)[] = [
    ...invoices.map((i) => () => invoiceIssued(i.id)),
    ...awaiting.map((stage) => () => stageAwaiting(projectId, stage)),
    ...openedTicketIds.map((id) => () => ticketOpen(id)),
  ]

  for (let i = 0; i < jobs.length; i += MAIL_CONCURRENCY) {
    await Promise.all(jobs.slice(i, i + MAIL_CONCURRENCY).map((job) => job()))
  }
}
