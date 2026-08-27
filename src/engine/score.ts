/**
 * Логика скоринга (концепт, п.9).
 *
 *     score = Quality × Availability
 *
 * Умножение, а не сумма, — сознательно. Отличный специалист без ёмкости
 * бесполезен для проекта с датой; сумма позволила бы качеству компенсировать
 * недоступность, произведение — нет.
 *
 * Порог по портфолио 8/10 здесь не участвует: он стоит до скоринга, в фильтре.
 */

import {
  FULL_TIMEZONE_OVERLAP_HOURS,
  SCALE_BANDS,
  scaleBandFor,
  type ScaleBand,
} from './taxonomy'
import { clamp01, deliveryMetrics, deliveryScore, historyWeight } from './metrics'
import type { ProjectRequirements, ScoreBreakdown, SpecialistProfile } from './types'

/** Рабочий день, по которому считается пересечение часовых поясов. */
export const WORKING_DAY_HOURS = 8

/**
 * Нижняя граница фактора доступности.
 *
 * Занятой специалист не исчезает из выборки — он проигрывает свободному. Ноль
 * означал бы «нет в пуле», а это отдельное решение и отдельный гейт: тот, у
 * кого нет ни часа или кто не успеет выйти к сроку, отсекается фильтром, а не
 * получает балл 0.1 и место в хвосте списка.
 */
export const MIN_AVAILABILITY = 0.1

/**
 * Нижняя граница соответствия. Одно несовпадение по мягкому измерению не должно
 * обнулять сильного специалиста — мягкие сигналы ранжируют, а не отсеивают
 * (п.8).
 */
export const RELEVANCE_FLOOR = 0.4

/** Веса мягких измерений таксономии. Заданы руками — это гипотезы (п.9). */
export const RELEVANCE_WEIGHTS = {
  typology: 0.3,
  scale: 0.2,
  material: 0.2,
  climate: 0.15,
  regulatory: 0.15,
} as const

export function timezoneOverlapHours(offsetA: number, offsetB: number): number {
  return Math.max(0, WORKING_DAY_HOURS - Math.abs(offsetA - offsetB))
}

/** Соседний диапазон площади — половина совпадения: масштаб непрерывен. */
export function scaleMatch(bands: ScaleBand[], areaSqm: number): number {
  const needed = scaleBandFor(areaSqm)
  if (bands.includes(needed)) return 1

  const neededIndex = SCALE_BANDS.indexOf(needed)
  const adjacent = bands.some((b) => Math.abs(SCALE_BANDS.indexOf(b) - neededIndex) === 1)

  return adjacent ? 0.5 : 0
}

/**
 * Соответствие мягким измерениям: типология, масштаб, материал, климат,
 * регуляторный трек. Возвращает 0.4–1.0.
 */
export function relevance(
  specialist: SpecialistProfile,
  requirements: ProjectRequirements,
): number {
  const typology = specialist.typologies.includes(requirements.typology) ? 1 : 0
  const scale = scaleMatch(specialist.scaleBands, requirements.areaSqm)

  const material = specialist.materialSystems.includes(requirements.materialSystem)
    ? 1
    : // Гибрид — это опыт стыковки систем, а не отдельная система.
      specialist.materialSystems.includes('hybrid')
      ? 0.5
      : 0

  const climate = specialist.climateZones.includes(requirements.climateZone) ? 1 : 0
  const regulatory = specialist.regulatoryTracks.includes(requirements.regulatoryTrack) ? 1 : 0

  const matched =
    RELEVANCE_WEIGHTS.typology * typology +
    RELEVANCE_WEIGHTS.scale * scale +
    RELEVANCE_WEIGHTS.material * material +
    RELEVANCE_WEIGHTS.climate * climate +
    RELEVANCE_WEIGHTS.regulatory * regulatory

  return RELEVANCE_FLOOR + (1 - RELEVANCE_FLOOR) * clamp01(matched)
}

/**
 * Фактор доступности, 0–1: свободная ёмкость против требуемой, срок выхода на
 * задачу и пересечение часовых поясов.
 *
 * `takenHoursPerWeek` — часы, уже занятые этим специалистом в собираемой
 * команде: второй слот не берётся из воздуха (п.10).
 */
export function availability(
  specialist: SpecialistProfile,
  requirements: ProjectRequirements,
  takenHoursPerWeek = 0,
): number {
  const free = Math.max(0, specialist.weeklyCapacityHours - takenHoursPerWeek)

  // Ни одного свободного часа — это не «низкий фактор», это отсутствие в
  // выборке. Возвращаем ноль, чтобы сборка команды такого не брала.
  if (free <= 0) return 0

  const capacityFactor = clamp01(free / Math.max(1, requirements.requiredHoursPerWeek))
  const leadTimeFactor = clamp01(1 - specialist.leadTimeDays / Math.max(1, requirements.horizonDays))

  const overlap = timezoneOverlapHours(specialist.utcOffset, requirements.utcOffset)
  const timezoneFactor = 0.8 + 0.2 * clamp01(overlap / FULL_TIMEZONE_OVERLAP_HOURS)

  const factor = capacityFactor * leadTimeFactor * timezoneFactor

  return factor <= 0 ? 0 : Math.max(MIN_AVAILABILITY, factor)
}

/**
 * Quality: портфолио, смешанное с историей поставок, умноженное на
 * соответствие проекту.
 *
 * У специалиста без закрытых тикетов вес истории нулевой, и Quality — это
 * рейтинг портфолио. Как только история появляется, она вытесняет портфолио до
 * потолка в 60%: портфолио стареет, метрики — нет (п.9).
 */
export function quality(
  specialist: SpecialistProfile,
  requirements: ProjectRequirements,
): { quality: number; deliveryScore: number; historyWeight: number; relevance: number } {
  const delivery = deliveryScore(deliveryMetrics(specialist.delivery))
  const weight = historyWeight(specialist.delivery)
  const fit = relevance(specialist, requirements)

  const base = specialist.portfolioRating * (1 - weight) + delivery * weight

  return { quality: base * fit, deliveryScore: delivery, historyWeight: weight, relevance: fit }
}

/** Полный разбор балла для одного специалиста под один проект. */
export function scoreFor(
  specialist: SpecialistProfile,
  requirements: ProjectRequirements,
  takenHoursPerWeek = 0,
): ScoreBreakdown {
  const q = quality(specialist, requirements)
  const a = availability(specialist, requirements, takenHoursPerWeek)

  return {
    portfolioRating: specialist.portfolioRating,
    deliveryScore: q.deliveryScore,
    historyWeight: q.historyWeight,
    relevance: q.relevance,
    quality: q.quality,
    availability: a,
    score: q.quality * a,
  }
}

/**
 * Балл в сотне — так, как он записан в спецификации отбора.
 *
 * Внутри движок считает в десятках, потому что в десятках задан порог по
 * портфолио. Наружу показывается сотня: «Скилл 98 × доступность 0.3 = 29.4»
 * читается без пересчёта в уме.
 */
export function asHundred(breakdown: ScoreBreakdown): {
  skill: number
  availability: number
  final: number
  matchPercent: number
} {
  const skill = breakdown.quality * 10

  return {
    skill,
    availability: breakdown.availability,
    final: breakdown.score * 10,
    // Совпадение с проектом: сколько процентов от идеального кандидата.
    matchPercent: Math.round(breakdown.score * 10),
  }
}
