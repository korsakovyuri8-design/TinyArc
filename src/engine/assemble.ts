/**
 * Стадия Assemble (концепт, п.7 и п.10). Публичное имя стадии — Score.
 *
 * Из ранжированных списков по дисциплинам собирается Tiny Team — минимальная
 * достаточная команда под конкретный проект, а не полный штат бюро.
 *
 * Человек в этой функции не участвует ни в каком виде. Единственный способ
 * получить другой состав — изменить требования проекта или пул.
 */

import { requiredDisciplines, type Discipline } from './taxonomy'
import { exchangesWith, failedGate } from './filter'
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
 * базовый формат обмена, с которым сверяются остальные (п.10).
 */
const LEAD_DISCIPLINE: Discipline = 'architecture'

function selectionOrder(disciplines: Discipline[]): Discipline[] {
  return [...disciplines].sort((a, b) => {
    if (a === LEAD_DISCIPLINE) return -1
    if (b === LEAD_DISCIPLINE) return 1
    return 0
  })
}

/** Все кандидаты по одной дисциплине с разбором балла и рангом. */
export function rankFor(
  pool: SpecialistProfile[],
  requirements: ProjectRequirements,
  discipline: Discipline,
): ScoredCandidate[] {
  const scored = pool.map((specialist) => {
    const gate = failedGate(specialist, requirements, discipline)

    return {
      specialist,
      discipline,
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
  const required = requiredDisciplines(requirements.typology, requirements.targetStage)

  if (!validation.ok) {
    return {
      outcome: 'rejected',
      notes: validation.reason,
      pooledCount: pool.length,
      survivedCount: 0,
      requiredDisciplines: required,
      candidates: [],
      team: [],
    }
  }

  const candidates = required.flatMap((d) => rankFor(pool, requirements, d))
  const survived = new Set(candidates.filter((c) => c.passed).map((c) => c.specialist.id))

  const base = {
    pooledCount: pool.length,
    survivedCount: survived.size,
    requiredDisciplines: required,
    candidates,
  }

  const team: TeamMember[] = []
  /** Часы, уже занятые специалистом в этой же команде: второй слот не бесплатен. */
  const taken = new Map<string, number>()
  let leadSoftware: readonly string[] | null = null

  for (const discipline of selectionOrder(required)) {
    const ranked = candidates
      .filter((c) => c.discipline === discipline && c.passed)
      .sort((a, b) => a.rank - b.rank)

    const picked = ranked.find((c) => {
      const busy = taken.get(c.specialist.id) ?? 0

      // Ёмкости не осталось — специалист недоступен, каким бы высоким ни был
      // его балл в отрыве от уже занятых им слотов.
      if (availability(c.specialist, requirements, busy) <= 0) return false

      // Кандидат, ломающий обмен моделями, уступает место следующему — даже с
      // более высоким баллом (п.10).
      if (leadSoftware && !exchangesWith(c.specialist, leadSoftware)) return false

      return true
    })

    if (!picked) {
      return {
        ...base,
        outcome: 'incomplete',
        notes: `Дисциплина «${discipline}» не закрыта: в пуле нет специалиста, проходящего гейты и совместимого с командой.`,
        team,
      }
    }

    const busy = taken.get(picked.specialist.id) ?? 0
    const slotScore = scoreFor(picked.specialist, requirements, busy).score

    team.push({
      specialist: picked.specialist,
      discipline,
      isSignatory: false,
      score: slotScore,
    })

    taken.set(picked.specialist.id, busy + requirements.requiredHoursPerWeek)
    if (!leadSoftware) leadSoftware = picked.specialist.software
  }

  const signed = signOff(team, candidates, requirements, taken, leadSoftware)

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
  leadSoftware: readonly string[] | null,
): TeamMember[] | null {
  const alreadySigns = team.find((m) => m.specialist.signsIn.includes(requirements.jurisdiction))

  if (alreadySigns) {
    return team.map((m) => (m === alreadySigns ? { ...m, isSignatory: true } : m))
  }

  type Swap = { index: number; member: TeamMember; loss: number }
  let best: Swap | null = null

  team.forEach((current, index) => {
    const replacement = candidates
      .filter(
        (c) =>
          c.discipline === current.discipline &&
          c.passed &&
          c.specialist.signsIn.includes(requirements.jurisdiction) &&
          (!leadSoftware || exchangesWith(c.specialist, leadSoftware)),
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
