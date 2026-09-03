/**
 * Готовность сети подрядчиков (п.14б).
 *
 * То же, что готовность пула (`readiness.ts`), но про стройку: какие работы мы
 * сегодня можем закрыть, а какие обещать нельзя. Вопрос нельзя решить взглядом
 * на список — сеть из пятидесяти фирм бесполезна, если кровельщик в стране один,
 * а по списку это не видно, потому что фирм в списке пятьдесят.
 *
 * Считается способность, а не загрузка. Занятость меняется за неделю, дыра в
 * покрытии — нет: её закрывают звонком или наймом, и разница между этими двумя
 * ответами и есть главное, что здесь считается.
 *
 * Отдельно от `contractor.ts` потому, что это другой вопрос. Там — «кого дать
 * этому проекту», здесь — «чего сети не хватает вообще». Смешать их значит
 * узнавать о дыре в тот день, когда в неё упёрся заказчик.
 */

import { CONTRACTOR_THRESHOLD, type ContractorProfile } from './contractor'
import { TRADES, type Trade } from './trades'

/**
 * Меньше двух подрядчиков на работу — это не покрытие.
 *
 * Один означает, что работа держится на его занятости, полисе и настроении.
 * Отбор при этом формально работает: он найдёт единственного и покажет список
 * из одного. Ровно до того дня, когда тот занят.
 */
export const MIN_TRADE_DEPTH = 2

/**
 * Почему работа не закрыта. Порядок — от того, что лечится звонком, к тому,
 * что лечится наймом: бюро должно сначала снять дешёвое.
 */
export const NETWORK_REASONS = ['insurance', 'availability', 'portfolio', 'nobody'] as const
export type NetworkReason = (typeof NETWORK_REASONS)[number]

export type TradeDepth = {
  trade: Trade
  /** Сколько подрядчиков в сети заявляют эту работу. */
  claimed: number
  /** Сколько из них проходят все жёсткие гейты. */
  eligible: number
  /**
   * Что мешает, если не хватает.
   *
   * Названа одна причина — та, которая мешает больше всех, — а не список:
   * бюро действует по одной за раз, и «просрочен полис у двоих» это звонок,
   * а «никого нет вовсе» — поиск. Пусто, если работа закрыта.
   */
  reason: NetworkReason | null
  /** Насколько срочно. Никого — не то же, что мало. */
  severity: 'none' | 'thin' | 'ok'
}

/**
 * Глубина сети по каждой работе.
 *
 * Проходит по закрытому словарю работ, а не по тому, что заявили подрядчики:
 * работа, которую в стране не делает никто, обязана появиться в списке строкой
 * с нулём. Считать по заявленному значило бы не увидеть именно те дыры, ради
 * которых список и существует.
 */
export function tradeDepth(network: ContractorProfile[]): TradeDepth[] {
  return TRADES.map((trade) => {
    const claiming = network.filter((row) => row.trades.includes(trade))
    const eligible = claiming.filter(
      (row) => row.insured && row.available && row.portfolioRating >= CONTRACTOR_THRESHOLD,
    )

    const severity = eligible.length === 0 ? 'none' : eligible.length < MIN_TRADE_DEPTH ? 'thin' : 'ok'

    return {
      trade,
      claimed: claiming.length,
      eligible: eligible.length,
      reason: severity === 'ok' ? null : bindingReason(claiming),
      severity,
    }
  })
}

/**
 * Что мешает больше всех.
 *
 * Порядок проверок — по дешевизне лечения, а не по числу отсеянных. Один
 * просроченный полис важнее пяти слабых портфолио: первый закрывается звонком
 * сегодня, второе — наймом за месяцы. Показывать самую многочисленную причину
 * значило бы посылать бюро делать дорогое, пока дешёвое лежит рядом.
 */
function bindingReason(claiming: ContractorProfile[]): NetworkReason {
  if (claiming.length === 0) return 'nobody'

  const strong = claiming.filter((row) => row.portfolioRating >= CONTRACTOR_THRESHOLD)
  if (strong.length === 0) return 'portfolio'

  if (strong.some((row) => !row.insured)) return 'insurance'
  if (strong.some((row) => !row.available)) return 'availability'

  // Сильные, застрахованные и свободные есть, но их меньше порога глубины:
  // это не дыра причины, а дыра числа — нужен ещё один человек.
  return 'nobody'
}

/**
 * Доля закрытых работ, 0…1.
 *
 * Одно число для страницы, по тем же правилам, что готовность пула: считается
 * покрытие, а не загрузка. Работа с одним подрядчиком считается закрытой
 * наполовину — она есть, но держится на одном.
 */
export function networkReadiness(network: ContractorProfile[]): number {
  const rows = tradeDepth(network)
  const score = rows.reduce(
    (sum, row) => sum + (row.severity === 'ok' ? 1 : row.severity === 'thin' ? 0.5 : 0),
    0,
  )

  return rows.length === 0 ? 0 : score / rows.length
}
