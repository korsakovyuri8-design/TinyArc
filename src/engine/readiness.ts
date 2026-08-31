/**
 * Готовность пула (концепт, п.8а).
 *
 * Отвечает на вопрос, который нельзя решить взглядом на список: какие проекты
 * бюро сегодня в состоянии взять, а какие обещать нельзя. Пул из ста человек
 * бесполезен, если в Греции нет конструктора по дереву, — а по списку это не
 * видно, потому что конструкторов в списке двадцать.
 *
 * Считается не загрузка, а способность. Занятость меняется за неделю, дыра в
 * покрытии — нет: её закрывают наймом, а не ожиданием. Поэтому здесь не
 * учитываются ни свободная ёмкость, ни срок выхода, ни часовой пояс. Их место
 * — в отборе под конкретный проект (см. filter.ts), а не в вопросе «кого нам
 * не хватает вообще».
 */

import {
  DOC_STAGES,
  GRID_CONNECTIONS,
  JURISDICTIONS,
  MATERIAL_SYSTEMS,
  PORTFOLIO_THRESHOLD,
  TERRAINS,
  TYPOLOGIES,
  coversRole,
  requiredRoles,
  type Discipline,
  type Jurisdiction,
  type ProjectShape,
  type RequiredRole,
} from './taxonomy'
import type { SpecialistProfile } from './types'

/**
 * Меньше двух человек на роль в стране — это не покрытие.
 *
 * Один специалист означает, что роль держится на его отпуске, болезни и
 * настроении. Отбор при этом формально работает: он найдёт единственного
 * подходящего и соберёт команду. Ровно до того дня, когда тот занят.
 */
export const MIN_DEPTH = 2

export type Coverage = {
  discipline: Discipline
  jurisdiction: Jurisdiction
  /** Прошедших порог портфолио и работающих в этой стране. */
  depth: number
  /** Из них те, кто имеет право подписи здесь. */
  signatories: number
}

/** Кого пул считает пригодным вообще: порог портфолио — гейт до всего (п.9). */
function eligible(pool: SpecialistProfile[]): SpecialistProfile[] {
  return pool.filter((s) => s.portfolioRating >= PORTFOLIO_THRESHOLD)
}

/** Глубина пула по каждой паре «дисциплина × страна». */
export function coverage(pool: SpecialistProfile[]): Coverage[] {
  const usable = eligible(pool)
  const result: Coverage[] = []

  for (const jurisdiction of JURISDICTIONS) {
    const here = usable.filter((s) => s.jurisdictions.includes(jurisdiction))

    for (const discipline of DISCIPLINES_IN_USE) {
      const covering = here.filter((s) => s.disciplines.includes(discipline))

      result.push({
        discipline,
        jurisdiction,
        depth: covering.length,
        signatories: covering.filter((s) => s.signsIn.includes(jurisdiction)).length,
      })
    }
  }

  return result
}

/**
 * Дисциплины, которые вообще участвуют в сценариях.
 *
 * Берутся из матрицы ролей, а не из словаря: если сценарий перестанет звать
 * дисциплину, она должна исчезнуть и из отчёта о готовности, иначе бюро будет
 * добирать людей на роль, которой больше нет.
 */
const DISCIPLINES_IN_USE: Discipline[] = [
  ...new Set(allShapes().flatMap((shape) => requiredRoles(shape).map((r) => r.discipline))),
]

/** Все формы проекта внутри продуктовой границы (п.5). */
export function allShapes(): ProjectShape[] {
  const shapes: ProjectShape[] = []

  for (const typology of TYPOLOGIES) {
    for (const targetStage of DOC_STAGES) {
      for (const materialSystem of MATERIAL_SYSTEMS) {
        for (const terrain of TERRAINS) {
          for (const gridConnection of GRID_CONNECTIONS) {
            shapes.push({ typology, targetStage, materialSystem, terrain, gridConnection })
          }
        }
      }
    }
  }

  return shapes
}

export type Gap = {
  jurisdiction: Jurisdiction
  role: RequiredRole
  /** Сколько форм проекта эта дыра закрывает для нас. */
  shapes: number
  /** Никого вообще или меньше двух: разные новости и разная срочность. */
  severity: 'none' | 'thin'
}

/** Ключ роли: дисциплина и требование по специализации целиком. */
function roleKey(role: RequiredRole): string {
  return `${role.discipline}|${role.mode}|${[...role.specializations].sort().join(',')}`
}

/**
 * Чего пулу не хватает, чтобы брать проекты.
 *
 * Перебираются все формы проекта внутри границы; для каждой роли в каждой
 * стране считается, сколько людей её закрывают. Роли складываются по подписи
 * требования — иначе один и тот же пробел показался бы сотней строк.
 *
 * Отсортировано по числу затронутых форм: дыра, из-за которой мы не можем
 * взять половину заказов, важнее той, что закрывает один редкий сценарий.
 */
export function gaps(pool: SpecialistProfile[]): Gap[] {
  const usable = eligible(pool)
  const found = new Map<string, Gap>()

  /*
   * Глубина считается один раз на подпись роли, а не на каждое её появление.
   *
   * Форм проекта внутри границы почти пятьсот, ролей в них — три с половиной
   * тысячи, а различных подписей роли всего девятнадцать: одна и та же роль
   * повторяется в сотнях форм. Прежний обход фильтровал пул на каждом
   * появлении — десять с половиной тысяч проходов вместо пятидесяти семи, и
   * на базе в пять тысяч человек страница пула отдавалась секунду вместо
   * сорока миллисекунд. Ответ при этом получался тот же самый: подпись роли
   * и страна полностью определяют глубину.
   */
  const depths = new Map<string, number>()

  const depthFor = (role: RequiredRole, jurisdiction: Jurisdiction): number => {
    const key = `${jurisdiction}|${roleKey(role)}`
    const known = depths.get(key)
    if (known !== undefined) return known

    const depth = usable.filter(
      (s) =>
        s.jurisdictions.includes(jurisdiction) &&
        s.disciplines.includes(role.discipline) &&
        coversRole(s.specializations, role),
    ).length

    depths.set(key, depth)
    return depth
  }

  for (const shape of allShapes()) {
    for (const role of requiredRoles(shape)) {
      for (const jurisdiction of JURISDICTIONS) {
        const depth = depthFor(role, jurisdiction)

        if (depth >= MIN_DEPTH) continue

        const key = `${jurisdiction}|${roleKey(role)}`
        const existing = found.get(key)

        if (existing) {
          existing.shapes += 1
          continue
        }

        found.set(key, {
          jurisdiction,
          role,
          shapes: 1,
          severity: depth === 0 ? 'none' : 'thin',
        })
      }
    }
  }

  return [...found.values()].sort(
    (a, b) =>
      // Полное отсутствие важнее тонкого места при равном охвате: одно нельзя
      // обещать вовсе, другое — нельзя обещать надёжно.
      (a.severity === b.severity ? 0 : a.severity === 'none' ? -1 : 1) || b.shapes - a.shapes,
  )
}

/**
 * Доля форм проекта, которые бюро может взять в этой стране.
 *
 * Одно число на страну, по которому видно, готовы мы там работать или ещё нет.
 * Считается по способности собрать состав, а не по загрузке: «сегодня все
 * заняты» — это не «мы этого не умеем».
 */
export function readiness(pool: SpecialistProfile[], jurisdiction: Jurisdiction): number {
  const usable = eligible(pool).filter((s) => s.jurisdictions.includes(jurisdiction))
  const shapes = allShapes()

  // Подпись — отдельное условие состава: без неё пакет не имеет силы (п.10).
  const hasSignatory = usable.some((s) => s.signsIn.includes(jurisdiction))
  if (!hasSignatory) return 0

  const doable = shapes.filter((shape) =>
    requiredRoles(shape).every((role) =>
      usable.some(
        (s) => s.disciplines.includes(role.discipline) && coversRole(s.specializations, role),
      ),
    ),
  )

  return doable.length / shapes.length
}
