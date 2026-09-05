/**
 * Вторая сторона денег: что бюро должно за работу.
 *
 * Начисление привязано к приёмке бюро, а не к подтверждению заказчика.
 * Приёмка означает «сделано как заказано» — с этой секунды бюро должно
 * человеку, и заказчик, молчащий неделю, работу несделанной не делает.
 *
 * Обязательство заводится, когда принят последний тикет дисциплины на стадии:
 * плата назначена за дисциплину на стадии, а не за тикет (см. движок).
 * Уникальность в схеме гасит повторный вызов — приёмка идемпотентна и зовётся
 * не один раз, а второй гонорар за ту же работу это не мелочь.
 */

import { DOC_STAGE_ORDER, type Discipline, type DocStage } from '@/engine/taxonomy'
import { CURRENCY, margin, owed, rateFor, type Margin, type PayoutRate } from '@/engine/payout'
import { prisma } from '../db'
import { bounded, TEXT_MAX } from '../text'

/** Ставки целиком: их десятки, а не тысячи — читаются одним запросом. */
export async function rates(): Promise<PayoutRate[]> {
  const rows = await prisma.payoutRate.findMany({
    select: { discipline: true, stage: true, amount: true },
  })

  return rows.map((r) => ({
    discipline: r.discipline as Discipline,
    stage: r.stage as DocStage,
    amount: r.amount,
  }))
}

export class PayoutRefused extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PayoutRefused'
  }
}

/**
 * Начисляет обязательства по всем закрытым дисциплинам проекта.
 *
 * Проходит по всем, а не только по той, чей тикет сейчас приняли: приёмка
 * зовёт это следом за собой, и разрыв между переходом и начислением стоил бы
 * того же, что разрыв между переходом и гейтом (п.86) — обязательство,
 * которого никто не видит, потому что никто о нём не знает. Проход по всему
 * проекту дешёв и идемпотентен, а значит лечится повторным вызовом.
 */
export async function accrueFor(projectId: string): Promise<number> {
  const [tickets, table] = await Promise.all([
    prisma.ticket.findMany({
      where: { projectId, specialistId: { not: null } },
      select: { discipline: true, stage: true, status: true, specialistId: true },
    }),
    rates(),
  ])

  if (tickets.length === 0) return 0

  /*
   * Ключ — «человек + дисциплина + стадия». Дисциплину без исполнителя
   * пропускаем выше запросом: должны мы человеку, а не роли.
   */
  type Group = { specialistId: string; discipline: string; stage: string; done: boolean }
  const groups = new Map<string, Group>()

  for (const ticket of tickets) {
    const key = `${ticket.specialistId}:${ticket.discipline}:${ticket.stage}`
    const group = groups.get(key)
    const accepted = ticket.status === 'accepted'

    if (group) group.done = group.done && accepted
    else
      groups.set(key, {
        specialistId: ticket.specialistId!,
        discipline: ticket.discipline,
        stage: ticket.stage,
        done: accepted,
      })
  }

  const ready = [...groups.values()].filter((g) => g.done)
  if (ready.length === 0) return 0

  /*
   * Заводятся по одному, а не `createMany`: повтор обязан пройти молча, а
   * `skipDuplicates` есть не у каждого провайдера. Групп на проект единицы —
   * это не то место, где число обращений к базе имеет значение.
   */
  let created = 0

  for (const group of ready) {
    const amount = rateFor(table, group.discipline as Discipline, group.stage as DocStage)

    try {
      await prisma.payout.create({
        data: {
          projectId,
          specialistId: group.specialistId,
          discipline: group.discipline,
          stage: group.stage,
          amount,
          currency: CURRENCY,
        },
      })
      created += 1
    } catch {
      // Единственная причина отказа — уникальность: обязательство уже есть.
      // Это и есть нормальный ход при повторной приёмке.
    }
  }

  return created
}

export type PayoutView = {
  id: string
  projectId: string
  projectTitle: string
  specialistId: string
  specialistName: string
  discipline: Discipline
  stage: DocStage
  amount: number | null
  currency: string
  status: string
  accruedAt: Date
  paidAt: Date | null
}

/**
 * Сколько выплаченных обязательств показывается рядом с очередью.
 *
 * Та же причина, что у счетов: серверное действие перерисовывает страницу, и
 * выплаченное ушло бы из списка вместе с формой, которая показывает ответ.
 */
export const PAID_SHOWN = 20

/**
 * Очередь выплат: сначала невыплаченные, потом последние выплаченные.
 *
 * Невыплаченные показываются все и потолка не имеют: срезанное обязательство
 * никто не закроет, потому что его никто не увидит, — а на той стороне живой
 * человек, который сделал работу и ждёт денег. Их число ограничено живыми
 * стадиями живых проектов.
 */
export async function payoutQueue(): Promise<PayoutView[]> {
  const [open, paid] = await Promise.all([
    prisma.payout.findMany({
      where: { status: 'accrued' },
      orderBy: { accruedAt: 'asc' },
      include: {
        project: { select: { title: true } },
        specialist: { select: { displayName: true } },
      },
    }),
    prisma.payout.findMany({
      where: { status: 'paid' },
      orderBy: { paidAt: 'desc' },
      take: PAID_SHOWN,
      include: {
        project: { select: { title: true } },
        specialist: { select: { displayName: true } },
      },
    }),
  ])

  return [...open, ...paid].map((row) => ({
    id: row.id,
    projectId: row.projectId,
    projectTitle: row.project.title,
    specialistId: row.specialistId,
    specialistName: row.specialist.displayName,
    discipline: row.discipline as Discipline,
    stage: row.stage as DocStage,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    accruedAt: row.accruedAt,
    paidAt: row.paidAt,
  }))
}

/**
 * Отметка о выплате.
 *
 * Условие внутри записи, как и у счёта: повтор обязан пройти молча, но не
 * переписать дату — дата выплаты это факт, а не последнее нажатие.
 *
 * Обязательство без суммы отметить нельзя. Отметка «выплачено» на пустой
 * сумме означала бы, что бюро закрыло долг, размера которого не знает.
 */
export async function markPayoutPaid(payoutId: string, note: string): Promise<void> {
  const payout = await prisma.payout.findUnique({ where: { id: payoutId } })
  if (!payout) throw new PayoutRefused('There is no such obligation.')

  if (payout.amount === null) {
    throw new PayoutRefused(
      'The rate for this discipline and stage is not set, so the amount is unknown. Set the rate first — marking an unknown amount paid records a debt closed at a size nobody knows.',
    )
  }

  await prisma.payout.updateMany({
    where: { id: payoutId, status: 'accrued' },
    data: { status: 'paid', paidAt: new Date(), paidNote: bounded(note, TEXT_MAX.line) },
  })
}

export type Economics = {
  /** Заплачено заказчиком: только оплаченные счета, а не выставленные. */
  charged: number
  /** Начислено людям, по известным ставкам. */
  owedKnown: number
  /** Сколько обязательств без ставки. */
  owedUnknown: number
  currency: string
  margin: Margin
  /** Пары «дисциплина + стадия», у которых нет ставки. Для панели. */
  missingRates: { discipline: Discipline; stage: DocStage }[]
}

/**
 * Экономика проекта: сколько получено, сколько должны, что осталось.
 *
 * Выручкой считается оплаченное, а не выставленное. Выставленный счёт — это
 * намерение заказчика, и считать по нему маржу значит считать по деньгам,
 * которых нет; ровно та же ошибка, что и ноль вместо незаданной ставки, и
 * ровно в ту же сторону.
 */
export async function economicsOf(projectId: string): Promise<Economics> {
  const [invoices, payouts] = await Promise.all([
    prisma.invoice.findMany({
      where: { projectId, status: 'paid' },
      select: { amount: true },
    }),
    prisma.payout.findMany({
      where: { projectId, status: { not: 'void' } },
      select: { amount: true, discipline: true, stage: true },
    }),
  ])

  const charged = invoices.reduce((sum, row) => sum + row.amount, 0)
  const obligations = owed(payouts.map((row) => row.amount))

  /* Пары называются, а не считаются числом: бюро задаёт ставку по паре. */
  const missing = new Map<string, { discipline: Discipline; stage: DocStage }>()
  for (const row of payouts) {
    if (row.amount !== null) continue
    missing.set(`${row.discipline}:${row.stage}`, {
      discipline: row.discipline as Discipline,
      stage: row.stage as DocStage,
    })
  }

  return {
    charged,
    owedKnown: obligations.known,
    owedUnknown: obligations.unknown,
    currency: CURRENCY,
    margin: margin(charged, obligations),
    missingRates: [...missing.values()].sort(
      (a, b) => DOC_STAGE_ORDER[a.stage] - DOC_STAGE_ORDER[b.stage],
    ),
  }
}

/**
 * Пары «дисциплина + стадия», под которые уже начислено, а ставки нет.
 *
 * Это не список всех возможных пар: их сотня с лишним, и требовать ставку под
 * каждую значило бы просить бюро назвать цену работе, которой у него никогда
 * не было. Просится ставка ровно там, где долг уже возник.
 */
export async function unratedObligations(): Promise<
  { discipline: Discipline; stage: DocStage; count: number }[]
> {
  const rows = await prisma.payout.findMany({
    where: { amount: null, status: { not: 'void' } },
    select: { discipline: true, stage: true },
  })

  const counted = new Map<string, { discipline: Discipline; stage: DocStage; count: number }>()

  for (const row of rows) {
    const key = `${row.discipline}:${row.stage}`
    const seen = counted.get(key)

    if (seen) seen.count += 1
    else
      counted.set(key, {
        discipline: row.discipline as Discipline,
        stage: row.stage as DocStage,
        count: 1,
      })
  }

  return [...counted.values()].sort((a, b) => b.count - a.count)
}

/**
 * Ставит ставку и подставляет её в уже начисленные обязательства без суммы.
 *
 * Задним числом — намеренно. Обязательство возникло раньше, чем бюро назвало
 * цену, но работа при этом была той же самой: оставить долг без суммы значило
 * бы, что первый месяц работы навсегда выпал из маржи. Уже выплаченные не
 * трогаются: там сумма — это то, что человек получил, а не то, что мы теперь
 * думаем о цене.
 */
export async function setRate(
  discipline: Discipline,
  stage: DocStage,
  amount: number,
): Promise<number> {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new PayoutRefused('A rate is a whole number of euro, zero or more.')
  }

  await prisma.payoutRate.upsert({
    where: { discipline_stage: { discipline, stage } },
    create: { discipline, stage, amount, currency: CURRENCY },
    update: { amount },
  })

  const filled = await prisma.payout.updateMany({
    where: { discipline, stage, amount: null, status: 'accrued' },
    data: { amount },
  })

  return filled.count
}
