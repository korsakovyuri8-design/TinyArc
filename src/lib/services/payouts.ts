/**
 * Вторая сторона денег: что бюро должно за работу.
 *
 * Начисление привязано к приёмке бюро, а не к подтверждению заказчика.
 * Приёмка означает «сделано как заказано», с этой секунды бюро должно
 * человеку, и заказчик, молчащий неделю, работу несделанной не делает.
 *
 * Обязательство заводится, когда принят последний тикет дисциплины на стадии:
 * плата назначена за дисциплину на стадии, а не за тикет (см. движок).
 * Уникальность в схеме гасит повторный вызов, приёмка идемпотентна и зовётся
 * не один раз, а второй гонорар за ту же работу это не мелочь.
 */

import { DOC_STAGE_ORDER, type Discipline, type DocStage } from '@/engine/taxonomy'
import {
  CURRENCY,
  feeFactor,
  feeFor,
  margin,
  owed,
  type Margin,
  type PayoutRate,
} from '@/engine/payout'
import { prisma } from '../db'
import { bounded, TEXT_MAX } from '../text'
import { payoutPaid, type Delivery } from './notify'

/** Ставки целиком: их десятки, а не тысячи, читаются одним запросом. */
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
 * того же, что разрыв между переходом и гейтом (п.86), обязательство,
 * которого никто не видит, потому что никто о нём не знает. Проход по всему
 * проекту дешёв и идемпотентен, а значит лечится повторным вызовом.
 */
export async function accrueFor(projectId: string): Promise<number> {
  const [project, tickets, table] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { areaSqm: true } }),
    prisma.ticket.findMany({
      where: { projectId, specialistId: { not: null } },
      select: { discipline: true, stage: true, status: true, specialistId: true },
    }),
    rates(),
  ])

  if (!project || tickets.length === 0) return 0

  /*
   * Ключ, «человек + дисциплина + стадия». Дисциплину без исполнителя
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
   * Своя ставка человека сильнее умолчания бюро, то же правило, по которому
   * считается бюджет команды при сборке (`costTable`).
   *
   * Без этого две стороны денег расходились: отбор пропускал состав по
   * названным людьми ценам, а начисление книжило умолчание. Человек, сказавший
   * девятьсот, получал шестьсот пятьдесят, и узнавал об этом на своей странице
   * денег, то есть после того, как работа принята. Занижение при этом
   * систематическое: свою ставку называют те, кому умолчание мало.
   */
  const own = await prisma.specialistRate.findMany({
    where: { specialistId: { in: [...new Set(ready.map((g) => g.specialistId))] } },
    select: { specialistId: true, discipline: true, stage: true, amount: true },
  })

  const byPerson = new Map(
    own.map((r) => [`${r.specialistId}:${r.discipline}:${r.stage}`, r.amount]),
  )

  /*
   * Заводятся по одному, а не `createMany`: повтор обязан пройти молча, а
   * `skipDuplicates` есть не у каждого провайдера. Групп на проект единицы —
   * это не то место, где число обращений к базе имеет значение.
   */
  let created = 0

  for (const group of ready) {
    /*
     * Ставка названа для объекта обычного размера и пересчитывается на этот
     * (движок, `feeFactor`). Пересчёт один и тот же для своей ставки и для
     * умолчания бюро: иначе один и тот же раздел стоил бы разное в зависимости
     * от того, дошёл ли человек до своей страницы денег.
     */
    const named = byPerson.get(`${group.specialistId}:${group.discipline}:${group.stage}`)

    const amount =
      named === undefined
        ? feeFor(table, group.discipline as Discipline, group.stage as DocStage, project.areaSqm)
        : Math.round(named * feeFactor(project.areaSqm))

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
      // Единственная причина отказа, уникальность: обязательство уже есть.
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
 * никто не закроет, потому что его никто не увидит,, а на той стороне живой
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
 * переписать дату, дата выплаты это факт, а не последнее нажатие.
 *
 * Обязательство без суммы отметить нельзя. Отметка «выплачено» на пустой
 * сумме означала бы, что бюро закрыло долг, размера которого не знает.
 */
export async function markPayoutPaid(payoutId: string, note: string): Promise<Delivery> {
  const payout = await prisma.payout.findUnique({ where: { id: payoutId } })
  if (!payout) throw new PayoutRefused('There is no such obligation.')

  if (payout.amount === null) {
    throw new PayoutRefused(
      'The rate for this discipline and stage is not set, so the amount is unknown. Set the rate first, marking an unknown amount paid records a debt closed at a size nobody knows.',
    )
  }

  const moved = await prisma.payout.updateMany({
    where: { id: payoutId, status: 'accrued' },
    data: { status: 'paid', paidAt: new Date(), paidNote: bounded(note, TEXT_MAX.line) },
  })

  /*
   * Письмо зовётся здесь, а не в действии панели.
   *
   * Правило то же, что у гейта: повод обязан возникать внутри идемпотентной
   * функции, а не у вызывающего. Второй путь к этой записи, а он появится:
   * пакетная выплата, сверка с банком, восстановление после разрыва, отметил
   * бы выплату и никому не сказал, и заметить это было бы неоткуда. Дубликаты
   * гасит запись повода в базе, а не аккуратность вызывающего.
   *
   * Ноль изменённых строк означает, что выплату отметил кто-то другой: тогда
   * и письмо уже его, и повторять нечего.
   */
  if (moved.count === 0) return 'skipped'

  return payoutPaid(payoutId)
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
 * Выручкой считается оплаченное, а не выставленное. Выставленный счёт, это
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
 * Подставляет названную ставку в уже начисленные обязательства без суммы.
 *
 * Пишется по одному, а не одним `updateMany`, и это следствие пересчёта по
 * размеру (движок, `feeFactor`): у каждого обязательства свой проект, значит
 * своя площадь, значит своя сумма. Одно число на все строки означало бы, что
 * гонорар на вилле в 250 м² и на квартале в 3000 одинаков, ровно то, ради
 * чего пересчёт и заведён.
 *
 * Строк здесь единицы: это долги, возникшие раньше, чем цена была названа.
 */
async function fillUnrated(
  where: { discipline: string; stage: string; specialistId?: string },
  base: number,
): Promise<number> {
  const rows = await prisma.payout.findMany({
    where: { ...where, amount: null, status: 'accrued' },
    select: { id: true, project: { select: { areaSqm: true } } },
  })

  for (const row of rows) {
    await prisma.payout.update({
      where: { id: row.id },
      data: { amount: Math.round(base * feeFactor(row.project.areaSqm)) },
    })
  }

  return rows.length
}

/**
 * Ставит ставку и подставляет её в уже начисленные обязательства без суммы.
 *
 * Задним числом, намеренно. Обязательство возникло раньше, чем бюро назвало
 * цену, но работа при этом была той же самой: оставить долг без суммы значило
 * бы, что первый месяц работы навсегда выпал из маржи. Уже выплаченные не
 * трогаются: там сумма, это то, что человек получил, а не то, что мы теперь
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

  return fillUnrated({ discipline, stage }, amount)
}

/**
 * Что бюро должно этому человеку и что уже выплатило.
 *
 * Реестр был построен только со стороны бюро: человек, сделавший работу, не мог
 * узнать, сколько ему причитается, даже зайдя. Начисленные показываются все —
 * срезанное обязательство это его деньги, о которых он не узнает; выплаченные
 * последними, как подтверждение, а не как архив.
 */
export const OWN_PAID_SHOWN = 20

export type OwnPayout = {
  id: string
  projectTitle: string
  discipline: Discipline
  stage: DocStage
  amount: number | null
  currency: string
  status: string
  accruedAt: Date
  paidAt: Date | null
}

export async function payoutsOf(specialistId: string): Promise<{
  accrued: OwnPayout[]
  paid: OwnPayout[]
  /** Сумма начисленного и невыплаченного, по известным ставкам. */
  owedKnown: number
  /** Сколько начислений ещё без ставки: бюро их не назвало. */
  owedUnknown: number
  /** Сумма всего, что уже выплачено. */
  paidTotal: number
  currency: string
}> {
  const [accruedRows, paidRows, paidSum] = await Promise.all([
    prisma.payout.findMany({
      where: { specialistId, status: 'accrued' },
      orderBy: { accruedAt: 'desc' },
      include: { project: { select: { title: true } } },
    }),
    prisma.payout.findMany({
      where: { specialistId, status: 'paid' },
      orderBy: { paidAt: 'desc' },
      take: OWN_PAID_SHOWN,
      include: { project: { select: { title: true } } },
    }),
    prisma.payout.aggregate({
      where: { specialistId, status: 'paid' },
      _sum: { amount: true },
    }),
  ])

  const view = (row: (typeof accruedRows)[number]): OwnPayout => ({
    id: row.id,
    projectTitle: row.project.title,
    discipline: row.discipline as Discipline,
    stage: row.stage as DocStage,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    accruedAt: row.accruedAt,
    paidAt: row.paidAt,
  })

  const obligations = owed(accruedRows.map((row) => row.amount))

  return {
    accrued: accruedRows.map(view),
    paid: paidRows.map(view),
    owedKnown: obligations.known,
    owedUnknown: obligations.unknown,
    paidTotal: paidSum._sum.amount ?? 0,
    currency: CURRENCY,
  }
}

/**
 * Ставки одного человека. Его собственная цена, а не политика бюро.
 */
export async function ratesOf(specialistId: string): Promise<PayoutRate[]> {
  const rows = await prisma.specialistRate.findMany({
    where: { specialistId },
    select: { discipline: true, stage: true, amount: true },
  })

  return rows.map((r) => ({
    discipline: r.discipline as Discipline,
    stage: r.stage as DocStage,
    amount: r.amount,
  }))
}

export async function setOwnRate(
  specialistId: string,
  discipline: Discipline,
  stage: DocStage,
  amount: number,
): Promise<void> {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new PayoutRefused('A fee is a whole number of euro, zero or more.')
  }

  await prisma.specialistRate.upsert({
    where: { specialistId_discipline_stage: { specialistId, discipline, stage } },
    create: { specialistId, discipline, stage, amount, currency: CURRENCY },
    update: { amount },
  })

  /*
   * Обязательства без суммы закрываются задним числом, так же, как их
   * закрывает названная бюро ставка (`setRate`).
   *
   * Порядок здесь обычный, а не редкий: человека зовут в проект раньше, чем он
   * доходит до своей страницы денег, и работа успевает быть принятой. Оставить
   * такое обязательство пустым значит показать ему «не задано» ровно там, где
   * он только что назвал число. Уже оценённые не трогаются: сумма обязательства
   * зафиксирована в момент приёмки и задним числом не переписывается.
   */
  await fillUnrated({ specialistId, discipline, stage }, amount)
}

/** Снять свою ставку: цену снова определяет умолчание бюро, если оно есть. */
export async function clearOwnRate(
  specialistId: string,
  discipline: Discipline,
  stage: DocStage,
): Promise<void> {
  await prisma.specialistRate.deleteMany({ where: { specialistId, discipline, stage } })
}

/**
 * Что стоит каждый человек пула на каждой своей дисциплине для этого проекта.
 *
 * Своя ставка человека сильнее умолчания бюро: гонорар, его деньги. Стадии
 * складываются все до целевой: команда собирается один раз на весь комплект,
 * и платить ей придётся за каждую стадию, а не за последнюю.
 *
 * Если хоть одна стадия не оценена ни им, ни бюро, цена человека **неизвестна**
 * и в таблицу не попадает вовсе. Записать её как сумму известных стадий значило
 * бы занизить: потолок бы соблюли, а денег бы не хватило.
 */
export async function costTable(
  specialistIds: string[],
  targetStage: DocStage,
  areaSqm: number,
): Promise<Map<string, number>> {
  const stages = (Object.keys(DOC_STAGE_ORDER) as DocStage[]).filter(
    (stage) => DOC_STAGE_ORDER[stage] <= DOC_STAGE_ORDER[targetStage],
  )

  const [own, bureau] = await Promise.all([
    specialistIds.length === 0
      ? []
      : prisma.specialistRate.findMany({
          where: { specialistId: { in: specialistIds }, stage: { in: stages } },
          select: { specialistId: true, discipline: true, stage: true, amount: true },
        }),
    prisma.payoutRate.findMany({
      where: { stage: { in: stages } },
      select: { discipline: true, stage: true, amount: true },
    }),
  ])

  const byBureau = new Map(bureau.map((r) => [`${r.discipline}:${r.stage}`, r.amount]))
  const byPerson = new Map(
    own.map((r) => [`${r.specialistId}:${r.discipline}:${r.stage}`, r.amount]),
  )

  /* Дисциплины, по которым у человека вообще есть цена, своя или бюро. */
  const disciplines = new Set<string>([
    ...own.map((r) => r.discipline),
    ...bureau.map((r) => r.discipline),
  ])

  const table = new Map<string, number>()

  for (const specialistId of specialistIds) {
    for (const discipline of disciplines) {
      let sum = 0
      let complete = true

      for (const stage of stages) {
        const price =
          byPerson.get(`${specialistId}:${discipline}:${stage}`) ??
          byBureau.get(`${discipline}:${stage}`)

        if (price === undefined) {
          complete = false
          break
        }

        // Тот же пересчёт по размеру, что и при начислении: гейт по бюджету
        // обязан считать по тем деньгам, которые потом будут книжиться.
        sum += Math.round(price * feeFactor(areaSqm))
      }

      if (complete) table.set(`${specialistId}:${discipline}`, sum)
    }
  }

  return table
}

/**
 * Расхождение после приёмки: работа принята, обязательства нет.
 *
 * Начисление стоит вне транзакции приёмки намеренно, оно обходит проект
 * целиком и читает ставки, и держать на нём транзакцию значило бы держать
 * блокировку на приёмке. Разрыв между двумя шагами объявлен лечимым:
 * обязательство уникально в схеме, повторный вызов не начислит второй раз.
 *
 * Лечимым, но никто не лечил. Второго вызова в продукте не существовало: если
 * начисление падало после приёмки, деньги, которые бюро уже должно человеку,
 * просто не появлялись. Заметить это было нельзя: панель считает обязательства,
 * а не принятые работы без обязательств,, то есть смотрит ровно с той
 * стороны, с которой пропажи не видно.
 *
 * Стадия целиком, а не тикет: обязательство заводится на пару «дисциплина ×
 * стадия», сколько бы тикетов в ней ни было.
 *
 * Окно, тридцать дней, и это не экономия на буквах. Проверка идёт при каждой
 * загрузке панели, а принятые тикеты копятся навсегда: без окна панель бюро с
 * годовой историей начинала бы день с обхода всего архива. Разрыв старше
 * месяца при этом либо уже закрыт, либо не закроется никогда, деньги за
 * работу, принятую полгода назад, ищут не по этой очереди, а по обращению
 * человека.
 */
const DRIFT_WINDOW_DAYS = 30
export type AccrualDrift = {
  projectId: string
  projectTitle: string
  specialistId: string
  specialistName: string
  discipline: string
  stage: string
}

export async function accrualDrift(now = new Date()): Promise<AccrualDrift[]> {
  const since = new Date(now.getTime() - DRIFT_WINDOW_DAYS * 86_400_000)

  const accepted = await prisma.ticket.findMany({
    where: { status: 'accepted', specialistId: { not: null }, acceptedAt: { gte: since } },
    select: {
      projectId: true,
      specialistId: true,
      discipline: true,
      stage: true,
      project: { select: { title: true } },
      specialist: { select: { displayName: true } },
    },
  })

  if (accepted.length === 0) return []

  const payouts = await prisma.payout.findMany({
    where: { projectId: { in: [...new Set(accepted.map((t) => t.projectId))] } },
    select: { projectId: true, specialistId: true, discipline: true, stage: true },
  })

  const booked = new Set(
    payouts.map((p) => `${p.projectId}:${p.specialistId}:${p.discipline}:${p.stage}`),
  )

  const missing = new Map<string, AccrualDrift>()

  for (const ticket of accepted) {
    const key = `${ticket.projectId}:${ticket.specialistId}:${ticket.discipline}:${ticket.stage}`
    if (booked.has(key) || missing.has(key)) continue

    missing.set(key, {
      projectId: ticket.projectId,
      projectTitle: ticket.project.title,
      specialistId: ticket.specialistId!,
      specialistName: ticket.specialist?.displayName ?? 'n/a',
      discipline: ticket.discipline,
      stage: ticket.stage,
    })
  }

  return [...missing.values()]
}
