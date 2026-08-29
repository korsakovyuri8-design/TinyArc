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
 *
 * Язык письма — тот, на котором человек читал документы, когда соглашался. Это
 * не угадывание по заголовку браузера, которого у фонового задания нет вовсе:
 * язык записан вместе с согласием (п.13а). Заказчик, оформивший бриф
 * по-английски, получает по-английски и счёт.
 */

import { DOC_STAGE_LABELS } from '../labels'
import { fill } from '../fill'
import { dateTime } from '../format'
import { absolute, siteUrl } from '../site'
import { mailer } from '../mail'
import { prisma } from '../db'
import { company } from '../legal'
import type { DocStage } from '@/engine/taxonomy'

/** Одновременных отправок. Столько же, сколько на рассылке приглашений. */
const MAIL_CONCURRENCY = 5

type Kind =
  | 'invoice_issued'
  | 'stage_awaiting'
  | 'ticket_open'
  | 'ticket_revision'
  | 'client_answer'
  | 'conflict_resolved'
  | 'ticket_comment'
  | 'application_declined'
  | 'invoice_paid'

/**
 * Что случилось с письмом.
 *
 * Различаются четыре исхода, а не два, потому что тот, кто нажал кнопку,
 * должен узнать правду. «Ушло» и «не ушло» здесь мало: при выключенной почте
 * письмо не уходит и не может уйти, и человека придётся позвать руками — это
 * не сбой и не повод, это режим. А молча выданное «отправлено» на выключенной
 * почте — та самая ложь, из-за которой оператор закрывает карточку, считая
 * дело сделанным.
 */
export type Delivery =
  /** Письмо ушло. */
  | 'sent'
  /** Почта выключена: письмо составлено и никуда не пошло. Звать руками. */
  | 'stub'
  /** Повода нет: адресата нет, или об этом уже писали. */
  | 'skipped'
  /** Пробовали и не смогли. Звать руками. */
  | 'failed'

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
): Promise<Delivery> {
  if (!email) return 'skipped'

  let claimed: string

  try {
    const row = await prisma.notification.create({ data: { kind, targetId, email } })
    claimed = row.id
  } catch {
    // Уже отправляли. Это не ошибка: сюда заходят по нескольку раз на событие.
    return 'skipped'
  }

  try {
    await send()
    // Запись остаётся и при заглушке: повод отработан, и повторять его не
    // надо. Иначе включённая назавтра почта разослала бы письма о том, что
    // случилось неделю назад.
    return mailer().mode === 'stub' ? 'stub' : 'sent'
  } catch (error) {
    await prisma.notification.delete({ where: { id: claimed } }).catch(() => {})
    console.error(`Письмо ${kind}/${targetId} не ушло:`, error)
    return 'failed'
  }
}

/**
 * Что сказать тому, кто нажал кнопку.
 *
 * Одно место на все действия панели: обещание «мы написали» произносится
 * ровно там, где письмо действительно ушло, и нигде больше.
 */
export function deliveryNote(delivery: Delivery, whom: string): string {
  switch (delivery) {
    case 'sent':
      return `${whom} has been told by email.`
    case 'stub':
      return `Email delivery is off — tell ${whom.toLowerCase()} yourself.`
    case 'failed':
      return `The email did not go out — tell ${whom.toLowerCase()} yourself.`
    case 'skipped':
      return `No email was needed: ${whom.toLowerCase()} already knows.`
  }
}

const SIGNATURE = ['', 'TinyArc Cloud Bureau', siteUrl()]

/** Выставлен счёт: без письма заказчик узнает об этом, только зайдя в кабинет. */
async function invoiceIssued(invoiceId: string): Promise<void> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      project: {
        select: { title: true, clientEmail: true, clientName: true },
      },
    },
  })

  if (!invoice || invoice.status !== 'issued') return

  const details = company()
  const stage = DOC_STAGE_LABELS[invoice.stage as DocStage] ?? invoice.stage

  await once('invoice_issued', invoice.id, invoice.project.clientEmail, async () => {
    await mailer().send({
      to: invoice.project.clientEmail,
      subject: fill('Invoice for the “{stage}” stage — {project}', {
        stage,
        project: invoice.project.title,
      }),
      body: [
        fill('Dear {name},', { name: invoice.project.clientName }),
        '',
        fill('An invoice has been issued for the “{stage}” stage of the {project} project: {amount} {currency}.', {
          project: invoice.project.title,
          stage,
          amount: invoice.amount,
          currency: invoice.currency,
        }),
        '',
          'A stage is paid for before work on it begins: the team are real people, and their time starts the moment a task opens. The breakdown of the amount — what it is made of — is visible in the project workspace.',
        '',
        details.bank
          ? `Payment details:\n${details.bank}`
          : 'We will send payment details in reply to this email.',
        '',
        `Project workspace: ${absolute('/enter')}`,
        ...SIGNATURE,
      ].join('\n'),
    })
  })
}

/**
 * Платёж отмечен: деньги дошли.
 *
 * Приёма платежей в продукте нет — отметку ставит человек в бюро, увидев
 * поступление (п.14а). Значит, для заказчика перевод уходит в тишину: банк
 * сказал «отправлено», а дошло ли и засчитано ли, знает только бюро. Молчание
 * тут читается однозначно — деньги пропали, — и следующим действием человек
 * пишет нам спрашивать. Письма о счёте это не закрывает: оно было про то, что
 * платить, а не про то, что заплачено.
 *
 * Про открытие стадии письмо не обещает ничего. Оплата — третий гейт наравне с
 * графом и подтверждением (п.14а), и «стадия открыта» было бы неправдой ровно
 * там, где не закрыт один из двух других. Сказано то, что верно всегда: деньги
 * засчитаны, от заказчика больше ничего не нужно, остальное видно в кабинете.
 */
export async function invoicePaid(invoiceId: string): Promise<Delivery> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { project: { select: { title: true, clientEmail: true, clientName: true } } },
  })

  if (!invoice || invoice.status !== 'paid') return 'skipped'

  const stage = DOC_STAGE_LABELS[invoice.stage as DocStage] ?? invoice.stage

  return once('invoice_paid', invoice.id, invoice.project.clientEmail, async () => {
    await mailer().send({
      to: invoice.project.clientEmail,
      subject: fill('Payment received — “{stage}”, {project}', {
        stage,
        project: invoice.project.title,
      }),
      body: [
        fill('Dear {name},', { name: invoice.project.clientName }),
        '',
        fill(
          'We have received your payment for the “{stage}” stage of {project}: {amount} {currency}. The invoice is settled and nothing further is needed from you.',
          {
            project: invoice.project.title,
            stage,
            amount: invoice.amount,
            currency: invoice.currency,
          },
        ),
        '',
        'Payment is one of the three conditions for a stage to open; the other two are the previous stage being accepted and confirmed by you. Where this stage stands right now is on the project workspace — it says which of the three is still outstanding, if any.',
        '',
        `Project workspace: ${absolute('/enter')}`,
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
      subject: fill('The “{stage}” stage awaits your confirmation — {project}', {
        stage: label,
        project: project.title,
      }),
      body: [
        fill('Dear {name},', { name: project.clientName }),
        '',
        fill(
          'The “{stage}” stage of the {project} project is complete: the bureau has accepted every task in it. That means “done as specified”.',
          { project: project.title, stage: label },
        ),
        '',
          'What remains is your word — “this is what was ordered”. Until it arrives the next stage does not begin: developing documentation on an unconfirmed concept is preparing rework.',
        '',
          'If you have comments, do not confirm — write to us from the workspace and we will turn them into a round of revisions.',
        '',
        `Project workspace: ${absolute('/enter')}`,
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
    include: {
      specialist: { select: { email: true, displayName: true } },
    },
  })

  if (!ticket?.specialist || ticket.status !== 'open') return


  const due = ticket.dueAt
    ? fill('Due: {due}.', {
        due: dateTime(ticket.dueAt),
      })
    : fill('Due: {hours} h from now.', { hours: ticket.slaHours })

  await once('ticket_open', ticket.id, ticket.specialist.email, async () => {
    await mailer().send({
      to: ticket.specialist!.email,
      subject: fill('New task: {title}', { title: ticket.title }),
      body: [
        fill('Dear {name},', { name: ticket.specialist!.displayName }),
        '',
        fill('A task has been opened for you: {title}.', { title: ticket.title }),
        due,
        '',
          'The specification and the input files are on your work board. Claim it there as well: the clock runs from when the task opened, not from when you saw it.',
        '',
        `Work board: ${absolute('/enter')}`,
        ...SIGNATURE,
      ].join('\n'),
    })
  })
}

/**
 * Работа вернулась на круг, и срок пошёл заново.
 *
 * Тот же случай, что и открытие задачи, только хуже: человек считает, что
 * работу сдал, и в доску не заходит. До письма мы считали ему круг правок и
 * время, о которых он не знал.
 *
 * Ключ отправки — тикет вместе с номером круга: повод возникает на каждом
 * возврате, и запись про первый не должна гасить письмо про второй.
 *
 * Причину бюро пишет комментарием в тикете, и в письме её нет намеренно:
 * замечания читаются рядом с работой, а не в почте, где на них нельзя
 * ответить. Письмо говорит только, что от человека снова чего-то ждут.
 */
export async function ticketReturned(ticketId: string): Promise<void> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { specialist: { select: { email: true, displayName: true } } },
  })

  if (!ticket?.specialist || ticket.status !== 'revision') return

  const due = ticket.dueAt
    ? fill('Due: {due}.', { due: dateTime(ticket.dueAt) })
    : fill('Due: {hours} h from now.', { hours: ticket.slaHours })

  await once(
    'ticket_revision',
    `${ticket.id}:${ticket.revisionRounds}`,
    ticket.specialist.email,
    async () => {
      await mailer().send({
        to: ticket.specialist!.email,
        subject: fill('Back for revision: {title}', { title: ticket.title }),
        body: [
          fill('Dear {name},', { name: ticket.specialist!.displayName }),
          '',
          fill(
            'The bureau has sent the work on “{title}” back for another round. What exactly is wrong is written in the ticket, next to the work.',
            { title: ticket.title },
          ),
          due,
          '',
          'A round of revisions is not a verdict on you: it is counted in the delivery metrics and nowhere else.',
          '',
          `Work board: ${absolute('/enter')}`,
          ...SIGNATURE,
        ].join('\n'),
      })
    },
  )
}

/**
 * Бюро написало в тикет.
 *
 * Цифровой менеджер существует затем, чтобы сдвигать вставшую работу, и его
 * единственный инструмент — комментарий в тикете. Пока о комментарии никто не
 * писал, инструмент молчал: человек читал вопрос про срок в тот день, когда
 * сам заходил на доску, то есть после срока.
 *
 * Текста реплики в письме нет: разговор идёт в тикете, где рядом лежит работа
 * и входные файлы, а ответить на письмо всё равно нельзя.
 *
 * Своя же реплика письма не порождает — специалист пишет в тикет сам, и
 * сообщать ему об этом незачем.
 */
export async function ticketCommented(commentId: string): Promise<Delivery> {
  const comment = await prisma.ticketComment.findUnique({
    where: { id: commentId },
    include: {
      ticket: {
        include: { specialist: { select: { email: true, displayName: true } } },
      },
    },
  })

  if (!comment || comment.authorRole !== 'bureau') return 'skipped'
  if (!comment.ticket.specialist) return 'skipped'

  return once('ticket_comment', comment.id, comment.ticket.specialist.email, async () => {
    await mailer().send({
      to: comment.ticket.specialist!.email,
      subject: fill('The bureau has written on: {title}', { title: comment.ticket.title }),
      body: [
        fill('Dear {name},', { name: comment.ticket.specialist!.displayName }),
        '',
        fill(
          'There is a comment from the bureau on “{title}”. It is in the ticket, next to the work and the input files — that is where the conversation lives.',
          { title: comment.ticket.title },
        ),
        '',
        `Work board: ${absolute('/enter')}`,
        ...SIGNATURE,
      ].join('\n'),
    })
  })
}

/**
 * Заявка не прошла порог портфолио.
 *
 * Единственная петля, в которой человек ждал ответа, которого не существовало.
 * Прошедшему уходит ключ, не прошедшему не уходило ничего: он подал заявку и
 * остался ждать письма, которое никогда не будет написано. Молчание здесь
 * хуже отказа — отказ можно пережить за минуту, а ждать человек будет месяцами.
 *
 * Письмо не открывает разговора, и это не грубость, а исполнение правила:
 * порог — условие допуска, а не балл, и он не обсуждается по случаям (п.9).
 * Поэтому в письме нет ни оценки, ни разбора работ, ни адреса для возражений.
 * Названа дверь, которая осталась открытой: портфолио — главный вход, и с
 * другим портфолио заявка подаётся заново.
 *
 * Повод — сам человек, а не разбор: пересмотр той же заявки решает то же
 * самое, и второе письмо об одном отказе — это письмо ни о чём.
 */
export async function applicationDeclined(specialistId: string): Promise<Delivery> {
  const specialist = await prisma.specialist.findUnique({
    where: { id: specialistId },
    select: { email: true, displayName: true, status: true },
  })

  if (!specialist || specialist.status !== 'rejected') return 'skipped'

  return once('application_declined', specialistId, specialist.email, async () => {
    await mailer().send({
      to: specialist.email,
      subject: 'Your application to the Bureau pool',
      body: [
        fill('Dear {name},', { name: specialist.displayName }),
        '',
        'We have reviewed your portfolio. The application does not pass: the work is below the threshold the pool is held to.',
        '',
        'The threshold is a condition of entry rather than a score, and it is not decided case by case — so there is nothing here to appeal, and we are not asking you to explain anything.',
        '',
        'The portfolio is the main entrance, and it is the part that can change. When there is work you would rather be judged on, apply again — a new application is reviewed from scratch.',
        '',
        `Apply: ${absolute('/specialists/apply')}`,
        ...SIGNATURE,
      ].join('\n'),
    })
  })
}

/**
 * Бюро ответило заказчику.
 *
 * У заказчика один канал, и он с бюро (п.10б). Канал, ответ в котором виден
 * только тому, кто сам догадался зайти, каналом не является: человек написал,
 * ждёт и не знает, что ему уже ответили.
 *
 * Текста ответа в письме нет намеренно. Разговор идёт в кабинете, где к нему
 * приложен проект целиком; письмо говорит, что ответ есть, — на письмо
 * ответить всё равно нельзя.
 */
export async function clientAnswered(messageId: string): Promise<Delivery> {
  const message = await prisma.clientMessage.findUnique({
    where: { id: messageId },
    include: { project: { select: { title: true, clientEmail: true, clientName: true } } },
  })

  if (!message || message.authorRole !== 'bureau') return 'skipped'

  return once('client_answer', message.id, message.project.clientEmail, async () => {
    await mailer().send({
      to: message.project.clientEmail,
      subject: fill('The bureau has answered — {project}', { project: message.project.title }),
      body: [
        fill('Dear {name},', { name: message.project.clientName }),
        '',
        fill(
          'There is an answer from the bureau on “{project}”. It is in the project workspace, next to the project itself — that is where the conversation lives.',
          { project: message.project.title },
        ),
        '',
        `Project workspace: ${absolute('/enter')}`,
        ...SIGNATURE,
      ].join('\n'),
    })
  })
}

/**
 * Арбитр вынес решение, и работа по задаче пошла дальше.
 *
 * Пока шёл спор, работа стояла — теперь она стоять перестала, и срок идёт
 * снова. Человек, который поднял конфликт и ждёт, узнаёт об этом из письма, а
 * не из ежедневного захода в доску, которого не будет.
 *
 * Ключ отправки — комментарий с решением: он создаётся один раз на решение,
 * и второе решение по тому же тикету письмо не погасит.
 */
export async function conflictResolved(ticketId: string, rulingId: string): Promise<Delivery> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { specialist: { select: { email: true, displayName: true } } },
  })

  if (!ticket?.specialist) return 'skipped'

  return once('conflict_resolved', rulingId, ticket.specialist.email, async () => {
    await mailer().send({
      to: ticket.specialist!.email,
      subject: fill('The dispute is settled: {title}', { title: ticket.title }),
      body: [
        fill('Dear {name},', { name: ticket.specialist!.displayName }),
        '',
        fill(
          'The bureau has ruled on “{title}”. The ruling is in the ticket; work on the task carries on from it, and the clock runs again.',
          { title: ticket.title },
        ),
        '',
        `Work board: ${absolute('/enter')}`,
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
