/**
 * Метрики качества (концепт, п.12).
 *
 * Считаются из счётчиков тикетов. Поля «оценка специалиста» не существует ни у
 * клиента, ни у оператора: отзывы — это мнение, а отбор идёт по фактам.
 */

import type { DeliveryCounters } from './types'

export type DeliveryMetrics = {
  /** Доля тикетов, закрытых в срок. */
  slaCompliance: number
  /** Доля тикетов, принятых с первого предъявления. */
  firstTimeRight: number
  /** Среднее время до первого содержательного ответа, часов. */
  responseHours: number
  /** Среднее число кругов правок на тикет. */
  revisionRate: number
  delivered: number
}

/** Время отклика, за пределами которого фактор обнуляется. */
export const RESPONSE_HORIZON_HOURS = 48
/** Число кругов правок, за которым фактор обнуляется. */
export const REVISION_HORIZON_ROUNDS = 3

/** Максимальный вес истории поставок в Quality. Портфолио не вытесняется совсем. */
export const HISTORY_MAX_WEIGHT = 0.6
/** Сколько закрытых тикетов нужно, чтобы вес истории вышел на максимум. */
export const HISTORY_FULL_AT_TICKETS = 10

export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0
  return Math.min(1, Math.max(0, value))
}

/** null, если истории поставок нет: у такого специалиста Quality — портфолио. */
export function deliveryMetrics(counters: DeliveryCounters): DeliveryMetrics | null {
  const { deliveredTickets: n } = counters
  if (n <= 0) return null

  return {
    slaCompliance: counters.onTimeTickets / n,
    firstTimeRight: counters.firstTimeRightTickets / n,
    responseHours: counters.responseMinutesTotal / n / 60,
    revisionRate: counters.revisionRoundsTotal / n,
    delivered: n,
  }
}

/**
 * Балл поставки, 0–10. Срок и приёмка с первого раза весят больше скорости
 * ответа: клиент платит за комплект, а не за расторопность в переписке.
 */
export function deliveryScore(metrics: DeliveryMetrics | null): number {
  if (!metrics) return 0

  const responseFactor = clamp01(1 - metrics.responseHours / RESPONSE_HORIZON_HOURS)
  const revisionFactor = clamp01(1 - metrics.revisionRate / REVISION_HORIZON_ROUNDS)

  return (
    10 *
    (0.35 * clamp01(metrics.slaCompliance) +
      0.35 * clamp01(metrics.firstTimeRight) +
      0.15 * responseFactor +
      0.15 * revisionFactor)
  )
}

/**
 * Насколько можно опереться на историю. Три закрытых тикета — это ещё не
 * репутация, поэтому вес растёт постепенно и упирается в потолок.
 */
export function historyWeight(counters: DeliveryCounters): number {
  return HISTORY_MAX_WEIGHT * clamp01(counters.deliveredTickets / HISTORY_FULL_AT_TICKETS)
}
