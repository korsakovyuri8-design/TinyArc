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

import { requiredRoles, type Discipline, type RequiredRole } from './taxonomy'
import { failedGate, worksInStack } from './filter'
import { availability, scoreFor } from './score'
import { validateProject } from './validate'
import type {
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

export function assemble(pool: SpecialistProfile[], requirements: ProjectRequirements): Assembly {
  const validation = validateProject(requirements)
  const roles = requiredRoles(shapeOf(requirements))

  if (!validation.ok) {
    return {
      outcome: 'rejected',
      notes: validation.reason,
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

  const team: TeamMember[] = []
  /** Часы, уже занятые специалистом в этой же команде: второй слот не бесплатен. */
  const taken = new Map<string, number>()

  for (const role of selectionOrder(roles)) {
    const ranked = candidates
      .filter((c) => c.discipline === role.discipline && c.passed)
      .sort((a, b) => a.rank - b.rank)

    const picked = ranked.find((c) => {
      const busy = taken.get(c.specialist.id) ?? 0

      // Ёмкости не осталось — специалист недоступен, каким бы высоким ни был
      // его балл в отрыве от уже занятых им слотов.
      if (availability(c.specialist, requirements, busy) <= 0) return false

      // Технологический шлюз на уровне команды: все говорят на одном языке.
      // Кандидат, ломающий это, уступает место следующему — даже с более
      // высоким баллом (п.10).
      if (team.length > 0 && !worksInStack(c.specialist, team[0].specialist.software)) return false

      return true
    })

    if (!picked) {
      return {
        ...base,
        outcome: 'incomplete',
        notes: describeGap(role),
        team,
      }
    }

    const busy = taken.get(picked.specialist.id) ?? 0

    team.push({
      specialist: picked.specialist,
      role,
      discipline: role.discipline,
      isSignatory: false,
      score: scoreFor(picked.specialist, requirements, busy).score,
    })

    taken.set(picked.specialist.id, busy + requirements.requiredHoursPerWeek)
  }

  const signed = signOff(team, candidates, requirements, taken)

  if (!signed) {
    return {
      ...base,
      outcome: 'no_signatory',
      notes:
        'В команде нет специалиста с правом подписи в юрисдикции проекта. Пакет без локальной подписи не имеет силы, поэтому проект не берётся (п.10, п.21).',
      team,
    }
  }

  return { ...base, outcome: 'ok', notes: '', team: signed }
}

function describeGap(role: RequiredRole): string {
  const what =
    role.specializations.length === 0
      ? `дисциплина «${role.discipline}»`
      : `«${role.discipline}» со специализацией ${role.specializations.join(role.mode === 'all' ? ' + ' : ' / ')}`

  return `Роль не закрыта: ${what}. В пуле нет специалиста, проходящего гейты и совместимого с командой по пакету.`
}

/**
 * Право подписи — гейт, а не пожелание (п.10). Если в собранной команде
 * подписывающего нет, ищем замену с наименьшей потерей балла; не находим —
 * проект не берётся.
 */
function signOff(
  team: TeamMember[],
  candidates: ScoredCandidate[],
  requirements: ProjectRequirements,
  taken: Map<string, number>,
): TeamMember[] | null {
  const alreadySigns = team.find((m) => m.specialist.signsIn.includes(requirements.jurisdiction))

  if (alreadySigns) {
    return team.map((m) => (m === alreadySigns ? { ...m, isSignatory: true } : m))
  }

  const stack = team[0]?.specialist.software ?? []

  type Swap = { index: number; member: TeamMember; loss: number }
  let best: Swap | null = null

  team.forEach((current, index) => {
    const replacement = candidates
      .filter(
        (c) =>
          c.discipline === current.discipline &&
          c.passed &&
          c.specialist.signsIn.includes(requirements.jurisdiction) &&
          (index === 0 || worksInStack(c.specialist, stack)),
      )
      .sort((a, b) => a.rank - b.rank)
      .find((c) => {
        const busy = taken.get(c.specialist.id) ?? 0
        return availability(c.specialist, requirements, busy) > 0
      })

    if (!replacement) return

    const busy = taken.get(replacement.specialist.id) ?? 0
    const score = scoreFor(replacement.specialist, requirements, busy).score
    const loss = current.score - score

    if (!best || loss < best.loss) {
      best = {
        index,
        member: {
          specialist: replacement.specialist,
          role: current.role,
          discipline: current.discipline,
          isSignatory: true,
          score,
        },
        loss,
      }
    }
  })

  if (!best) return null

  const swap: Swap = best
  return team.map((m, i) => (i === swap.index ? swap.member : m))
}
