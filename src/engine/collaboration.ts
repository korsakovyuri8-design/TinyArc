/**
 * Сработанность команды.
 *
 * Люди, уже сдававшие проект вместе, работают лучше людей, впервые увидевших
 * друг друга через тикет-систему. Это не мнение и не «химия»: в наших данных
 * это видно по числу закрытых запросов между дисциплинами и по числу споров,
 * дошедших до арбитра.
 *
 * Чего фактор НЕ делает, и это важнее того, что он делает:
 *
 *  · не пускает мимо гейтов — состав кандидатов от него не меняется вовсе;
 *  · не поднимает слабого выше сильного больше чем на границу ниже;
 *  · не считается по мнениям — поля «нам понравилось работать вместе» нет.
 *
 * Он меняет только порядок вариантов при сборке: из двух составов, набравших
 * близкий балл, выбирается сработавшийся.
 */

export type PairHistory = {
  projects: number
  requestsAnswered: number
  conflicts: number
}

/** Границы фактора. Узкие намеренно: сработанность — довод, а не аргумент. */
export const MIN_FACTOR = 0.9
export const MAX_FACTOR = 1.1

/** Совместных проектов, после которых прибавка выходит на потолок. */
export const PROJECTS_FOR_FULL_CREDIT = 3

/** Закрытых запросов, после которых прибавка за них выходит на потолок. */
export const REQUESTS_FOR_FULL_CREDIT = 8

/**
 * Вес одного спора, дошедшего до арбитра.
 *
 * Подобран так, чтобы один арбитраж перевешивал один совместный проект: пара,
 * которая на каждом объекте упирается в бюро, стоит рабочего времени, и это
 * ровно тот сигнал, ради которого фактор существует. Тест на это есть — при
 * меньшем весе он падает.
 */
export const CONFLICT_WEIGHT = 1

function saturate(value: number, full: number): number {
  if (full <= 0) return 0
  return Math.min(1, Math.max(0, value) / full)
}

/**
 * Фактор пары: 0.9–1.1, нейтральная единица без истории.
 *
 * Совместный опыт весит больше закрытых запросов: довести проект вместе —
 * сильнее, чем ответить друг другу на восемь вопросов.
 */
export function pairFactor(history: PairHistory | undefined | null): number {
  if (!history) return 1

  const credit =
    0.7 * saturate(history.projects, PROJECTS_FOR_FULL_CREDIT) +
    0.3 * saturate(history.requestsAnswered, REQUESTS_FOR_FULL_CREDIT)

  const penalty = saturate(history.conflicts * CONFLICT_WEIGHT, PROJECTS_FOR_FULL_CREDIT)

  const factor = 1 + (MAX_FACTOR - 1) * credit - (1 - MIN_FACTOR) * penalty

  return Math.min(MAX_FACTOR, Math.max(MIN_FACTOR, factor))
}

/** Ключ пары. Порядок нормализован, поэтому пара хранится и ищется один раз. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

/**
 * Фактор состава — среднее по парам.
 *
 * Именно среднее, а не произведение: произведение по двадцати восьми парам
 * восьмиролевой команды скатилось бы к краю диапазона от одной плохой пары и
 * перестало бы быть доводом. Пары без истории считаются нейтральными и
 * усредняются вместе со всеми — новичок в команде не штраф.
 */
export function teamFactor(
  specialistIds: string[],
  history: Map<string, PairHistory>,
): number {
  const unique = [...new Set(specialistIds)]
  if (unique.length < 2) return 1

  const factors: number[] = []

  for (let i = 0; i < unique.length; i += 1) {
    for (let j = i + 1; j < unique.length; j += 1) {
      factors.push(pairFactor(history.get(pairKey(unique[i], unique[j]))))
    }
  }

  return factors.reduce((sum, f) => sum + f, 0) / factors.length
}
