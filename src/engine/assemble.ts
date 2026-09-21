/**
 * Стадия Assemble (концепт, п.7 и п.10). Публичное имя стадии, Score.
 *
 * Из ранжированных списков по ролям собирается Tiny Team, минимальная
 * достаточная команда под конкретный проект, а не полный штат бюро. Состав
 * ролей выводит сценарная матрица (taxonomy.requiredRoles), а не шаблон.
 *
 * Человек в этой функции не участвует ни в каком виде. Единственный способ
 * получить другой состав, изменить требования проекта или пул.
 */

import {
  requiredRoles,
  SIGNED_DISCIPLINES,
  type Discipline,
  type RequiredRole,
  type Software,
} from './taxonomy'
import { teamFactor, type PairHistory } from './collaboration'
import { failedGate, narrowPackages, sharesPackage } from './filter'
import { availability, scoreFor } from './score'
import { validateProject } from './validate'
import type {
  AssemblyGap,
  Assembly,
  ProjectRequirements,
  ScoredCandidate,
  SignOff,
  SigningPartner,
  SpecialistProfile,
  TeamBudget,
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
 * архитектуре и объявляет состав несобранным, при том что валидный состав
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
  /** Потолок на команду. `null`, потолка нет, и цена ни на что не влияет. */
  budget: TeamBudget | null,
  /** Местные фирмы с правом подписи в стране проекта. */
  partners: readonly SigningPartner[],
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

  function step(
    depth: number,
    total: number,
    cost: number,
    stack: readonly Software[] | null,
  ): void {
    if (visited >= SEARCH_LIMIT) return

    if (depth === order.length) {
      visited += 1

      if (requireSignatory) {
        // Подпись нужна под каждым разделом, где её требует закон, а не одна
        // на весь состав. См. SIGNED_DISCIPLINES.
        if (signing(members(chosen), requirements, partners).unsigned.length > 0) return
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

      /*
       * Цена, гейт, а не слагаемое. Не поместившийся в остаток бюджета
       * вариант не рассматривается вовсе; порядок среди поместившихся тот же,
       * что был. Дешёвый не обходит сильного, он становится по карману.
       *
       * Цена неназвавшего считается нулём: он из отбора не исключается, а его
       * отсутствие в сумме возвращается наверх отдельным числом.
       */
      const own = budget?.costOf.get(`${specialist.id}:${role.discipline}`) ?? 0
      if (budget && cost + own > budget.total) continue

      const score = scoreFor(specialist, requirements, busy).score

      chosen.push({ role, candidate, score })
      taken.set(specialist.id, busy + requirements.requiredHoursPerWeek)

      step(depth + 1, total + score, cost + own, narrowPackages(specialist, stack))

      taken.set(specialist.id, busy)
      chosen.pop()
    }
  }

  step(0, 0, 0, null)

  return best
}

export function assemble(
  pool: SpecialistProfile[],
  requirements: ProjectRequirements,
  /**
   * История совместной работы по парам. Влияет только на порядок вариантов:
   * кто проходит гейты, от неё не зависит. Пустая карта, обычный случай для
   * нового пула, и результат тогда полностью определяется баллами.
   */
  history: Map<string, PairHistory> = new Map(),
  /**
   * Потолок на команду и цены участников. `null`, потолка нет.
   *
   * Ноль в `total`, это не «бесплатно», а «денег нет»: такой потолок не
   * пропустит никого, у кого названа цена. Отсутствие потолка выражается
   * значением `null`, и различать их обязательно.
   */
  budget: TeamBudget | null = null,
  /**
   * Местные проектные фирмы, которые проверяют и подписывают разделы в стране
   * проекта. Пусто, подписать может только сам участник команды с правом
   * подписи.
   */
  partners: readonly SigningPartner[] = [],
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
      teamCost: null,
      unpricedMembers: 0,
      signOff: [],
      unsigned: [],
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

  /** Что стоит собранный состав и скольких в нём не оценили. */
  function priced(team: TeamMember[]): { teamCost: number | null; unpricedMembers: number } {
    if (!budget) return { teamCost: null, unpricedMembers: 0 }

    let teamCost = 0
    let unpricedMembers = 0

    for (const member of team) {
      const own = budget.costOf.get(`${member.specialist.id}:${member.discipline}`)
      if (own === undefined) unpricedMembers += 1
      else teamCost += own
    }

    return { teamCost, unpricedMembers }
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

  const withSignatory = search(roles, byRole, requirements, true, history, budget, partners)

  if (withSignatory) {
    const { signOff } = signing(members(withSignatory), requirements, partners)
    const team = toTeam(withSignatory, signOff)

    return { ...base, outcome: 'ok', notes: '', gap: null, team, ...priced(team), signOff, unsigned: [] }
  }

  // Состав не собрался. Различаем две причины: людей нет вовсе или они есть,
  // но подписать пакет некому. Для клиента это разные ответы.
  const withoutSignatory = search(roles, byRole, requirements, false, history, budget, partners)

  if (withoutSignatory) {
    const { signOff, unsigned } = signing(members(withoutSignatory), requirements, partners)
    const team = toTeam(withoutSignatory, signOff)

    return {
      ...base,
      outcome: 'no_signatory',
      gap: null,
      notes: `A team does come together, but nobody holds signing rights in the project’s jurisdiction for: ${unsigned.join(', ')}. Neither a team member nor a local signing partner can sign these sections, and a documentation set without the responsible designer’s signature on every section has no force, so the project is not taken on (§10, §21).`,
      team,
      ...priced(team),
      signOff,
      unsigned,
    }
  }

  /*
   * Деньги отделяются от людей. Состав, который собирается без потолка и не
   * собирается с ним,, это не «людей нет»: люди есть, и дело в цене. Разница
   * не косметическая: первое лечится наймом и месяцами, второе, сегодня,
   * деньгами заказчика или ставкой бюро. Сказать второму первое значит
   * отправить человека ждать того, что уже случилось.
   */
  if (budget) {
    const unbounded = search(roles, byRole, requirements, true, history, null, partners)

    if (unbounded) {
      const { signOff } = signing(members(unbounded), requirements, partners)
      const team = toTeam(unbounded, signOff)
      const { teamCost, unpricedMembers } = priced(team)

      return {
        ...base,
        outcome: 'over_budget',
        gap: null,
        notes:
          'A team does come together, but no variant fits the fee budget for this project. This is about money, not about people: the fees are named by the specialists themselves.',
        team: [],
        teamCost,
        unpricedMembers,
        signOff: [],
        unsigned: [],
      }
    }
  }

  const gap = scarcestRole(roles, byRole)

  return {
    ...base,
    outcome: 'incomplete',
    notes: describeGap(gap),
    gap,
    team: [],
    teamCost: null,
    unpricedMembers: 0,
    signOff: [],
    unsigned: [],
  }
}

function toTeam(assignments: Assignment[], signOff: readonly SignOff[]): TeamMember[] {
  // Подписывающий отмечается по разделу: архитектор подписывает архитектуру,
  // конструктор конструкции. Раздел, который подписывает партнёрская фирма,
  // своего подписанта в команде не имеет.
  return assignments.map((a) => ({
    specialist: a.candidate.specialist,
    role: a.role,
    discipline: a.role.discipline,
    isSignatory: signOff.some(
      (o) =>
        o.by === 'member' &&
        o.specialistId === a.candidate.specialist.id &&
        o.discipline === a.role.discipline,
    ),
    score: a.score,
  }))
}

/** Состав в виде пар «человек, раздел»: то, по чему считается подпись. */
function members(assignments: readonly Assignment[]) {
  return assignments.map((a) => ({ specialist: a.candidate.specialist, discipline: a.role.discipline }))
}

/**
 * Кто подписывает каждый раздел, где нужна подпись.
 *
 * Сначала свой: участник, который сделал раздел и имеет право подписи в стране
 * проекта. Он отвечает за то, что сам сделал, и чужая проверка ему не нужна.
 * Только если своего подписанта нет, раздел уходит партнёрской фирме, и её
 * инженер проверяет чужую работу, прежде чем подписать.
 *
 * Внутри раздела подписывает один. Если в составе двое с правом подписи по
 * одной дисциплине, ответственность должна лежать на конкретном человеке, а
 * не «на ком-то из команды».
 */
export function signing(
  chosen: readonly { specialist: SpecialistProfile; discipline: Discipline }[],
  requirements: ProjectRequirements,
  partners: readonly SigningPartner[],
): { signOff: SignOff[]; unsigned: Discipline[] } {
  const needed = [...new Set(chosen.map((c) => c.discipline))].filter((d) =>
    SIGNED_DISCIPLINES.includes(d),
  )

  const signOff: SignOff[] = []
  const unsigned: Discipline[] = []

  for (const discipline of needed) {
    const member = chosen.find(
      (c) => c.discipline === discipline && c.specialist.signsIn.includes(requirements.jurisdiction),
    )
    if (member) {
      signOff.push({ discipline, by: 'member', specialistId: member.specialist.id })
      continue
    }

    const partner = partners.find(
      (p) => p.jurisdiction === requirements.jurisdiction && p.disciplines.includes(discipline),
    )
    if (partner) {
      signOff.push({ discipline, by: 'partner', partnerId: partner.id })
      continue
    }

    unsigned.push(discipline)
  }

  return { signOff, unsigned }
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
 * странице проекта, по-русски и с тем, что делать дальше.
 */
function describeGap(gap: AssemblyGap): string {
  const what =
    gap.specializations.length === 0
      ? `discipline «${gap.discipline}»`
      : `«${gap.discipline}» with specialisation ${gap.specializations.join(gap.mode === 'all' ? ' + ' : ' / ')}`

  return gap.candidates === 0
    ? `The role is not covered: ${what}. There is not a single specialist in the pool who passes the gates.`
    : `No team comes together. The scarcest role is ${what}: candidates ${gap.candidates}, and no variant passes on capacity and software suite at the same time.`
}
