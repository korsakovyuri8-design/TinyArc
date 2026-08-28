/**
 * Замена выбывшего участника (концепт, п.10а).
 *
 * Люди выпадают: болеют, переоценивают объём, берут другой заказ. До сих пор
 * это означало остановку проекта — отказаться исполнитель не мог, а назначить
 * замену бюро не вправе: команду собирает алгоритм, и ручное назначение здесь
 * не «упрощение», а отмена всего продукта (п.7).
 *
 * Поэтому замена ищется там же, где искался состав: в ранжированном списке
 * кандидатов того самого прогона. Порядок уже посчитан и сохранён вместе с
 * разбором балла — брать следующего по рангу значит продолжать то же решение,
 * а не принимать новое.
 *
 * Гейты при этом проверяются заново, по текущему профилю. Прогон мог быть
 * месяц назад: у человека сменилась ёмкость, он ушёл на паузу, у него кончился
 * срок выхода. Ранг — это память о решении, а гейты — это факт о сегодня.
 */

import { narrowPackages, passes, sharesPackage } from './filter'
import type { ProjectRequirements, SpecialistProfile } from './types'
import type { RequiredRole, Software } from './taxonomy'

/** Кандидат прогона: ранг и кто это. Балл здесь уже не пересчитывается. */
export type RankedCandidate = {
  specialistId: string
  rank: number
}

export type ReplacementInput = {
  /** Кандидаты на роль из прогона, в порядке ранга. */
  ranked: RankedCandidate[]
  /** Кто уже в команде: их брать нельзя, они заняты другими ролями. */
  taken: string[]
  /** Кто выбывает. Его самого в замену не предлагать. */
  leaving: string
  /** Профили тех, кого можно проверить сейчас. */
  profiles: Map<string, SpecialistProfile>
  requirements: ProjectRequirements
  role: RequiredRole
  /**
   * Пакеты, общие для остающейся части команды.
   *
   * Единый пакет — требование состава, а не человека (п.8). Заменяющий обязан
   * попадать в то, в чём работают остальные: иначе команда собрана, а обменять
   * модель внутри неё нечем.
   */
  teamPackages: readonly Software[]
}

export type Replacement =
  | { found: true; specialistId: string; rank: number }
  | { found: false; reason: 'no_candidates' | 'none_passes' }

/**
 * Следующий по рангу, кто проходит гейты сегодня.
 *
 * Возвращает причину отказа, а не просто null: «в прогоне никого не было» и
 * «были, но сегодня никто не проходит» — разные новости для бюро. Первая
 * означает, что роль изначально держалась на одном человеке; вторая — что пул
 * изменился с момента прогона.
 */
export function pickReplacement(input: ReplacementInput): Replacement {
  const pool = input.ranked
    .filter((c) => c.specialistId !== input.leaving)
    .filter((c) => !input.taken.includes(c.specialistId))
    .sort((a, b) => a.rank - b.rank)

  if (pool.length === 0) return { found: false, reason: 'no_candidates' }

  for (const candidate of pool) {
    const profile = input.profiles.get(candidate.specialistId)
    if (!profile) continue

    if (!passes(profile, input.requirements, input.role)) continue
    if (!sharesPackage(profile, input.teamPackages)) continue

    return { found: true, specialistId: candidate.specialistId, rank: candidate.rank }
  }

  return { found: false, reason: 'none_passes' }
}

/**
 * Пакеты, которые останутся общими у команды без выбывшего.
 *
 * Считается по остающимся: набор, суженный ушедшим, мог быть уже нужного, и
 * заменяющего пришлось бы искать под ограничение, которого больше нет.
 */
export function packagesOf(remaining: SpecialistProfile[]): Software[] {
  return remaining.reduce<Software[] | null>(
    (common, member) => narrowPackages(member, common),
    null,
  ) ?? []
}
