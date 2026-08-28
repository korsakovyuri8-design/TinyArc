/**
 * Стадия Assemble (концепт, п.7 и п.10). Публичное имя стадии — Score.
 *
 * Из ранжированных списков по ролям собирается Tiny Team — минимальная
 * достаточная команда под конкретный проект, а не полный штат бюро. Состав
 * ролей выводит сценарная матрица (taxonomy.requiredRoles), а не шаблон.
 *
 * Человек в этой функции не участвует ни в каком виде. Единственный способ
 * получить другой состав — изменить требования проекта или пул.
 */

import { requiredRoles, type Discipline, type RequiredRole, type Software } from './taxonomy'
import { teamFactor, type PairHistory } from './collaboration'
import { failedGate, narrowPackages, sharesPackage } from './filter'
import { availability, scoreFor } from './score'
import { validateProject } from './validate'
import type {
  AssemblyGap,
  Assembly,
  ProjectRequirements,
  ScoredCandidate,
  SpecialistProfile,
  TeamMember,
} from './types'

/**
 * Архитектура идёт первой не по важности, а по механике: её пакет задаёт
 * рабочий формат, с которым сверяются остальные (п.10).
 */
const LEAD_DISCIPLINE: Discipline = 'architecture'

function selectionOrder(roles: RequiredRole[]): RequiredRole[] {
  return [...roles].sort((a, b) => {
    if (a.discipline === LEAD_DISCIPLINE) return -1
    if (b.discipline === LEAD_DISCIPLINE) return 1
    return 0
  })
}

function shapeOf(requirements: ProjectRequirements) {
  return {
    typology: requirements.typology,
    targetStage: requirements.targetStage,
    materialSystem: requirements.materialSystem,
    terrain: requirements.terrain,
    gridConnection: requirements.gridConnection,
  }
}

/** Все кандидаты на одну роль с разбором балла и рангом. */
export function rankFor(
  pool: SpecialistProfile[],
  requirements: ProjectRequirements,
  role: RequiredRole,
): ScoredCandidate[] {
  const scored = pool.map((specialist) => {
    const gate = failedGate(specialist, requirements, role)

    return {
      specialist,
      role,
      discipline: role.discipline,
      passed: gate === null,
      failedGate: gate,
      breakdown: scoreFor(specialist, requirements),
      rank: 0,
    } satisfies ScoredCandidate
  })

  const passed = scored
    .filter((c) => c.passed)
    .sort((a, b) => b.breakdown.score - a.breakdown.score)

  passed.forEach((c, index) => {
    c.rank = index + 1
  })

  return scored
}

/**
 * Сколько кандидатов на роль вообще рассматривается при переборе.
 *
 * Ограничение нужно только чтобы поиск оставался предсказуемым по времени.
 * Кандидат, стоящий девятым по баллу в своей роли, в лучшем составе не
 * окажется: чтобы он туда попал, все восемь выше должны одновременно
 * конфликтовать с остальной командой.
 */
const CANDIDATES_PER_ROLE = 8

/** Потолок обхода. Упирается в него только вырожденный пул; берём лучшее найденное. */
const SEARCH_LIMIT = 20_000

type Assignment = { role: RequiredRole; candidate: ScoredCandidate; score: number }

/**
 * Подбор состава перебором с возвратом.
 *
 * Жадный проход здесь неверен, и это не теория. Если лучший архитектор
 * оказывается единственным, кто закрывает согласования, жадность отдаёт его
 * архитектуре и объявляет состав несобранным — при том что валидный состав
 * есть: поставить архитектором второго и отдать согласования ему.
 *
 * Роли обходятся от самых дефицитных к свободным, чтобы тупик обнаруживался
 * рано. Ведущая дисциплина идёт первой независимо от дефицита: её пакет задаёт
 * формат обмена для остальных.
 */
function search(
  roles: RequiredRole[],
  byRole: Map<RequiredRole, ScoredCandidate[]>,
  requirements: ProjectRequirements,
  requireSignatory: boolean,
  history: Map<string, PairHistory>,
): Assignment[] | null {
  const order = [...roles].sort((a, b) => {
    if (a.discipline === LEAD_DISCIPLINE) return -1
    if (b.discipline === LEAD_DISCIPLINE) return 1
    return (byRole.get(a)?.length ?? 0) - (byRole.get(b)?.length ?? 0)
  })

  let best: Assignment[] | null = null
  let bestScore = -1
  let visited = 0

  const taken = new Map<string, number>()
  const chosen: Assignment[] = []

  function step(depth: number, total: number, stack: readonly Software[] | null): void {
    if (visited >= SEARCH_LIMIT) return

    if (depth === order.length) {
      visited += 1

      if (requireSignatory) {
        const signs = chosen.some((a) =>
          a.candidate.specialist.signsIn.includes(requirements.jurisdiction),
        )
        if (!signs) return
      }

      // Сработанность применяется к собранному составу, а не к отдельному
      // человеку: она свойство пар, и в отрыве от команды её не существует.
      const weighted = total * teamFactor(chosen.map((a) => a.candidate.specialist.id), history)

      if (weighted > bestScore) {
        bestScore = weighted
        best = chosen.map((a) => ({ ...a }))
      }

      return
    }

    const role = order[depth]

    for (const candidate of byRole.get(role) ?? []) {
      if (visited >= SEARCH_LIMIT) return

      const specialist = candidate.specialist
      const busy = taken.get(specialist.id) ?? 0

      // Часов не осталось: второй слот тому же человеку не бесплатен.
      const factor = availability(specialist, requirements, busy)
      if (factor <= 0) continue

      // Единый пакет внутри команды. Сверяемся с общим набором, а не с
      // набором ведущего: у ведущего пакетов может быть три, и двое смежников
      // прошли бы каждый по своему, не имея общего между собой.
      if (stack && !sharesPackage(specialist, stack)) continue

      const score = scoreFor(specialist, requirements, busy).score

      chosen.push({ role, candidate, score })
      taken.set(specialist.id, busy + requirements.requiredHoursPerWeek)

      step(depth + 1, total + score, narrowPackages(specialist, stack))

      taken.set(specialist.id, busy)
      chosen.pop()
    }
  }

  step(0, 0, null)

  return best
}

export function assemble(
  pool: SpecialistProfile[],
  requirements: ProjectRequirements,
  /**
   * История совместной работы по парам. Влияет только на порядок вариантов:
   * кто проходит гейты, от неё не зависит. Пустая карта — обычный случай для
   * нового пула, и результат тогда полностью определяется баллами.
   */
  history: Map<string, PairHistory> = new Map(),
): Assembly {
  const validation = validateProject(requirements)
  const roles = requiredRoles(shapeOf(requirements))

  if (!validation.ok) {
    return {
      outcome: 'rejected',
      notes: validation.reason,
      gap: null,
      pooledCount: pool.length,
      survivedCount: 0,
      requiredRoles: roles,
      candidates: [],
      team: [],
    }
  }

  const candidates = roles.flatMap((role) => rankFor(pool, requirements, role))
  const survived = new Set(candidates.filter((c) => c.passed).map((c) => c.specialist.id))

  const base = {
    pooledCount: pool.length,
    survivedCount: survived.size,
    requiredRoles: roles,
    candidates,
  }

  const byRole = new Map<RequiredRole, ScoredCandidate[]>(
    roles.map((role) => [
      role,
      candidates
        .filter((c) => c.role === role && c.passed)
        .sort((a, b) => a.rank - b.rank)
        .slice(0, CANDIDATES_PER_ROLE),
    ]),
  )

  const withSignatory = search(roles, byRole, requirements, true, history)

  if (withSignatory) {
    return {
      ...base,
      outcome: 'ok',
      notes: '',
      gap: null,
      team: toTeam(withSignatory, requirements),
    }
  }

  // Состав не собрался. Различаем две причины: людей нет вовсе или они есть,
  // но подписать пакет некому. Для клиента это разные ответы.
  const withoutSignatory = search(roles, byRole, requirements, false, history)

  if (withoutSignatory) {
    return {
      ...base,
      outcome: 'no_signatory',
      gap: null,
      notes:
        'Состав собирается, но ни в одном варианте нет специалиста с правом подписи в юрисдикции проекта. Пакет без локальной подписи не имеет силы, поэтому проект не берётся (п.10, п.21).',
      team: toTeam(withoutSignatory, requirements),
    }
  }

  const gap = scarcestRole(roles, byRole)

  return { ...base, outcome: 'incomplete', notes: describeGap(gap), gap, team: [] }
}

function toTeam(assignments: Assignment[], requirements: ProjectRequirements): TeamMember[] {
  // Подписывающий помечается один: если их в составе несколько, ответственность
  // должна быть на конкретном человеке, а не «на ком-то из команды».
  let marked = false

  return assignments.map((a) => {
    const signs = !marked && a.candidate.specialist.signsIn.includes(requirements.jurisdiction)
    if (signs) marked = true

    return {
      specialist: a.candidate.specialist,
      role: a.role,
      discipline: a.role.discipline,
      isSignatory: signs,
      score: a.score,
    }
  })
}

/** Роль, на которой поиск упирается раньше всего: с неё и начинать разбор. */
/** Роль, на которую меньше всего кандидатов: с неё и начинается объяснение. */
function scarcestRole(
  roles: RequiredRole[],
  byRole: Map<RequiredRole, ScoredCandidate[]>,
): AssemblyGap {
  const scarcest = [...roles].sort(
    (a, b) => (byRole.get(a)?.length ?? 0) - (byRole.get(b)?.length ?? 0),
  )[0]!

  return {
    discipline: scarcest.discipline,
    specializations: scarcest.specializations,
    mode: scarcest.mode,
    candidates: byRole.get(scarcest)?.length ?? 0,
  }
}

/**
 * Записка для бюро.
 *
 * Здесь допустимы имена из словарей: читает её тот, кто эти имена знает, и ему
 * нужна точность, а не гладкость. Клиенту та же нехватка объясняется на
 * странице проекта — по-русски и с тем, что делать дальше.
 */
function describeGap(gap: AssemblyGap): string {
  const what =
    gap.specializations.length === 0
      ? `дисциплина «${gap.discipline}»`
      : `«${gap.discipline}» со специализацией ${gap.specializations.join(gap.mode === 'all' ? ' + ' : ' / ')}`

  return gap.candidates === 0
    ? `Роль не закрыта: ${what}. В пуле нет ни одного специалиста, проходящего гейты.`
    : `Состав не собирается. Самая дефицитная роль — ${what}: кандидатов ${gap.candidates}, и ни один вариант не проходит по ёмкости и пакету одновременно.`
}
