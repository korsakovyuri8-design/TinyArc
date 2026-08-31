import { describe, expect, it } from 'vitest'
import { MIN_DEPTH, allShapes, coverage, gaps, readiness } from './readiness'
import { specialist } from './fixtures'
import { DISCIPLINES } from './taxonomy'
import type { SpecialistProfile } from './types'

/** Полный пул: по два человека на каждую роль в каждой стране. */
function fullPool(): SpecialistProfile[] {
  const people: SpecialistProfile[] = []

  const roles = [
    { disciplines: ['architecture'] as const, specializations: ['arch_small_scale', 'arch_large_scale'] as const },
    { disciplines: ['structural'] as const, specializations: ['structural_concrete', 'structural_steel', 'structural_timber'] as const },
    { disciplines: ['mep'] as const, specializations: ['mep_hvac', 'mep_electrical', 'mep_plumbing', 'mep_off_grid'] as const },
    { disciplines: ['landscape'] as const, specializations: ['landscape_garden', 'landscape_master_planning', 'landscape_grading'] as const },
    { disciplines: ['interiors'] as const, specializations: ['interiors_residential', 'interiors_horeca'] as const },
    { disciplines: ['visualization'] as const, specializations: ['viz_photoreal'] as const },
    { disciplines: ['survey'] as const, specializations: [] as const },
    { disciplines: ['permitting'] as const, specializations: ['permit_zoning', 'permit_flood'] as const },
    { disciplines: ['cost_estimation'] as const, specializations: [] as const },
    { disciplines: ['dfma'] as const, specializations: [] as const },
    { disciplines: ['energy'] as const, specializations: [] as const },
  ]

  for (const role of roles) {
    for (const copy of [1, 2]) {
      people.push(
        specialist({
          id: `${role.disciplines[0]}-${copy}`,
          disciplines: [...role.disciplines],
          specializations: [...role.specializations],
          jurisdictions: ['ME', 'RS', 'GR'],
          signsIn: ['ME', 'RS', 'GR'],
          portfolioRating: 9,
        }),
      )
    }
  }

  return people
}

describe('перебор форм проекта', () => {
  it('покрывает границу продукта целиком', () => {
    // 4 типологии × 4 стадии × 5 материалов × 3 рельефа × 2 подключения.
    expect(allShapes()).toHaveLength(4 * 4 * 5 * 3 * 2)
  })
})

describe('полнота самого стенда', () => {
  it('в пуле есть каждая дисциплина таксономии', () => {
    // Иначе «полный пул» тихо перестаёт быть полным на следующей дисциплине,
    // и тесты ниже начинают подтверждать вчерашнюю границу продукта.
    const covered = new Set(fullPool().flatMap((s) => s.disciplines))

    for (const discipline of DISCIPLINES) {
      expect(covered.has(discipline), `${discipline} не заведена в стенде`).toBe(true)
    }
  })
})

describe('готовность пула', () => {
  it('на полном пуле берёт любую форму в любой стране', () => {
    const pool = fullPool()

    for (const jurisdiction of ['ME', 'RS', 'GR'] as const) {
      expect(readiness(pool, jurisdiction)).toBe(1)
    }
  })

  it('без права подписи в стране готовность нулевая, сколько бы людей ни было', () => {
    // Пакет без подписи юридической силы не имеет: считать долю сценариев
    // здесь означало бы обещать то, что нельзя сдать.
    const pool = fullPool().map((s) => ({ ...s, signsIn: [] }))

    expect(readiness(pool, 'ME')).toBe(0)
  })

  it('падает, когда из пула уходит дисциплина', () => {
    const pool = fullPool().filter((s) => !s.disciplines.includes('survey'))

    // Геодезия нужна со стадии разрешения — значит часть сценариев отпадает,
    // а концепция остаётся.
    const value = readiness(pool, 'ME')
    expect(value).toBeGreaterThan(0)
    expect(value).toBeLessThan(1)
  })

  it('в стране, где никого нет, нулевая', () => {
    const pool = fullPool().map((s) => ({ ...s, jurisdictions: ['ME' as const] }))

    expect(readiness(pool, 'GR')).toBe(0)
  })
})

describe('глубина покрытия', () => {
  it('считает людей и подписантов по паре «дисциплина × страна»', () => {
    const rows = coverage(fullPool())
    const architects = rows.find((r) => r.discipline === 'architecture' && r.jurisdiction === 'ME')

    expect(architects).toMatchObject({ depth: 2, signatories: 2 })
  })

  it('не считает тех, кто не прошёл порог портфолио', () => {
    const pool = fullPool().map((s) => ({ ...s, portfolioRating: 7 }))
    const rows = coverage(pool)

    expect(rows.every((r) => r.depth === 0)).toBe(true)
  })
})

describe('дыры в пуле', () => {
  it('на полном пуле молчит', () => {
    expect(gaps(fullPool())).toEqual([])
  })

  it('называет отсутствующую специализацию, а не дисциплину целиком', () => {
    // Конструкторы есть, но никто не ведёт дерево: вилла из бруса не соберётся,
    // хотя по списку «конструкторов достаточно».
    const pool = fullPool().map((s) =>
      s.disciplines.includes('structural')
        ? { ...s, specializations: ['structural_concrete' as const] }
        : s,
    )

    const timber = gaps(pool).find((g) =>
      g.role.specializations.includes('structural_timber'),
    )

    expect(timber).toBeDefined()
    expect(timber?.severity).toBe('none')
    expect(timber?.shapes).toBeGreaterThan(0)
  })

  it('отличает пустое место от тонкого', () => {
    // Один визуализатор — роль формально закрыта, но держится на одном человеке.
    const pool = fullPool().filter((s) => s.id !== 'visualization-2')
    const viz = gaps(pool).find((g) => g.role.discipline === 'visualization')

    expect(viz?.severity).toBe('thin')
  })

  it('порог глубины — не единица', () => {
    expect(MIN_DEPTH).toBeGreaterThan(1)
  })

  it('складывает одну и ту же дыру, а не показывает её сотней строк', () => {
    const pool = fullPool().filter((s) => !s.disciplines.includes('survey'))
    const survey = gaps(pool).filter((g) => g.role.discipline === 'survey')

    // Три страны — три строки, а не по строке на каждую форму проекта.
    expect(survey).toHaveLength(3)
    expect(survey[0]!.shapes).toBeGreaterThan(1)
  })

  it('ставит полное отсутствие впереди тонкого места', () => {
    const pool = fullPool()
      .filter((s) => s.id !== 'visualization-2')
      .filter((s) => !s.disciplines.includes('survey'))

    const first = gaps(pool)[0]
    expect(first?.severity).toBe('none')
  })
})

/**
 * Готовность пула на большой базе.
 *
 * База бюро растёт импортом, и `gaps` перебирает все формы проекта внутри
 * границы. Формы почти пятьсот, ролей в них три с половиной тысячи, а
 * различных подписей роли — девятнадцать: считать глубину на каждом появлении
 * значит пройти по пулу десять тысяч раз вместо пятидесяти семи.
 *
 * Так и было: на базе в пять тысяч человек страница пула отдавалась секунду
 * вместо сорока миллисекунд, а под десятком одновременных запросов — двадцать
 * секунд на всех. Проверка стоит здесь, потому что заметить это на стенде из
 * девяноста трёх человек невозможно: там разница в единицы миллисекунд.
 */
describe('готовность на большой базе', () => {
  function bulk(size: number): SpecialistProfile[] {
    return Array.from({ length: size }, (_, i) =>
      specialist({
        id: `bulk-${i}`,
        disciplines: [DISCIPLINES[i % DISCIPLINES.length]],
        portfolioRating: 8 + (i % 20) / 10,
      }),
    )
  }

  it('пять тысяч человек разбираются за отведённое время', () => {
    const pool = bulk(5000)

    const started = performance.now()
    gaps(pool)
    const spent = performance.now() - started

    // На этой машине — около шестидесяти миллисекунд. Запас десятикратный:
    // проверка ловит возврат к перебору на каждом появлении роли, а не
    // медленный день сборочной машины.
    expect(spent, `разбор занял ${spent.toFixed(0)} мс`).toBeLessThan(600)
  })

  it('ответ на большой базе тот же, что и на её половине с теми же ролями', () => {
    // Удвоение пула теми же людьми не создаёт и не закрывает ни одной дыры
    // сверх того, что уже закрыто: глубина считается по подписи роли.
    const small = bulk(400)
    const large = [...small, ...bulk(400).map((p) => specialist({ ...p, id: `${p.id}-copy` }))]

    expect(gaps(large).map((g) => `${g.jurisdiction}|${g.role.discipline}|${g.shapes}`)).toEqual(
      gaps(small).map((g) => `${g.jurisdiction}|${g.role.discipline}|${g.shapes}`),
    )
  })
})
