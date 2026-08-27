import { describe, expect, it } from 'vitest'
import { assemble, rankFor } from './assemble'
import { pairKey } from './collaboration'
import { fullPool, requirements, role, specialist } from './fixtures'

describe('сборка Tiny Team', () => {
  it('собирает команду под все обязательные роли', () => {
    const result = assemble(fullPool(), requirements({ targetStage: 'permit' }))

    expect(result.outcome).toBe('ok')
    expect(result.team.map((m) => m.discipline).sort()).toEqual(
      ['architecture', 'mep', 'permitting', 'structural', 'survey', 'visualization'].sort(),
    )
  })

  it('не собирает команду на проект вне границы', () => {
    const result = assemble(fullPool(), requirements({ storeys: 9 }))

    expect(result.outcome).toBe('rejected')
    expect(result.team).toHaveLength(0)
    expect(result.candidates).toHaveLength(0)
  })

  it('меняет состав команды вслед за формой проекта', () => {
    const flat = assemble(fullPool(), requirements({ terrain: 'flat' }))
    const slope = assemble(fullPool(), requirements({ terrain: 'slope' }))

    expect(flat.team.some((m) => m.discipline === 'landscape')).toBe(false)
    expect(slope.team.some((m) => m.discipline === 'landscape')).toBe(true)
  })

  it('не берёт конструктора по бетону на деревянный дом', () => {
    const pool = fullPool().map((s) =>
      s.disciplines.includes('structural')
        ? { ...s, specializations: ['structural_concrete' as const] }
        : s,
    )

    const concrete = assemble(pool, requirements({ materialSystem: 'concrete' }))
    const timber = assemble(pool, requirements({ materialSystem: 'timber' }))

    expect(concrete.outcome).toBe('ok')
    expect(timber.outcome).toBe('incomplete')
    expect(timber.notes).toContain('structural_timber')
  })

  it('сообщает, какая роль не закрыта', () => {
    const withoutMep = fullPool().filter((s) => !s.disciplines.includes('mep'))
    const result = assemble(withoutMep, requirements())

    expect(result.outcome).toBe('incomplete')
    expect(result.notes).toContain('mep')
  })

  it('не берёт проект без права подписи в юрисдикции', () => {
    const nobodySigns = fullPool().map((s) => ({ ...s, signsIn: [] }))
    const result = assemble(nobodySigns, requirements())

    expect(result.outcome).toBe('no_signatory')
    expect(result.notes).toContain('подписи')
  })

  it('ставит ровно одного подписывающего', () => {
    const result = assemble(fullPool(), requirements())
    const signatories = result.team.filter((m) => m.isSignatory)

    expect(result.outcome).toBe('ok')
    expect(signatories).toHaveLength(1)
    expect(signatories[0].specialist.signsIn).toContain('ME')
  })

  it('меняет состав ради подписи с наименьшей потерей балла', () => {
    const pool = [
      ...fullPool().map((s) => ({ ...s, signsIn: [] as never[] })),
      specialist({
        id: 'signing-structural',
        displayName: 'Конструктор с подписью',
        disciplines: ['structural'],
        portfolioRating: 8,
        signsIn: ['ME'],
      }),
    ]

    const result = assemble(pool, requirements())
    const signatory = result.team.find((m) => m.isSignatory)

    expect(result.outcome).toBe('ok')
    expect(signatory?.specialist.id).toBe('signing-structural')
  })

  it('уступает место следующему, если кандидат вне пакета команды', () => {
    // Клиент пакета не задал, поэтому шлюз проекта молчит — но команда всё
    // равно обязана говорить на одном языке с ведущим архитектором.
    const pool = [
      specialist({ id: 'arch', disciplines: ['architecture'], software: ['revit'], portfolioRating: 9.5 }),
      specialist({
        id: 'isolated-structural',
        disciplines: ['structural'],
        software: ['rhino'],
        portfolioRating: 9.9,
      }),
      specialist({
        id: 'same-stack-structural',
        disciplines: ['structural'],
        software: ['revit'],
        portfolioRating: 8.5,
      }),
      specialist({ id: 'mep', disciplines: ['mep'], software: ['revit'] }),
      specialist({ id: 'viz', disciplines: ['visualization'], software: ['revit'] }),
    ]

    const result = assemble(pool, requirements({ targetStage: 'concept', software: [] }))
    const structural = result.team.find((m) => m.discipline === 'structural')

    expect(result.outcome).toBe('ok')
    // Балл выше у изолированного, но в команду идёт тот, кто в пакете команды.
    expect(structural?.specialist.id).toBe('same-stack-structural')
  })

  it('не выдаёт один и тот же час дважды', () => {
    const generalist = specialist({
      id: 'generalist',
      disciplines: ['architecture', 'structural', 'mep', 'visualization'],
      weeklyCapacityHours: 10,
      portfolioRating: 10,
    })
    const backup = specialist({
      id: 'backup',
      disciplines: ['structural', 'mep', 'visualization'],
      weeklyCapacityHours: 40,
      portfolioRating: 8,
    })

    const result = assemble(
      [generalist, backup],
      requirements({ targetStage: 'concept', requiredHoursPerWeek: 10 }),
    )

    expect(result.outcome).toBe('ok')
    expect(result.team.filter((m) => m.specialist.id === 'generalist')).toHaveLength(1)
  })

  it('позволяет универсалу закрыть несколько ролей, когда ёмкости хватает', () => {
    const generalist = specialist({
      id: 'generalist',
      disciplines: ['architecture', 'structural', 'mep', 'visualization'],
      weeklyCapacityHours: 40,
      portfolioRating: 10,
    })

    const result = assemble([generalist], requirements({ targetStage: 'concept' }))

    expect(result.outcome).toBe('ok')
    expect(result.team).toHaveLength(4)
    expect(new Set(result.team.map((m) => m.specialist.id)).size).toBe(1)
  })
})

describe('ранжирование и разбор', () => {
  it('хранит и прошедших, и отсеянных с причиной', () => {
    const pool = [
      specialist({ id: 'good', portfolioRating: 9 }),
      specialist({ id: 'weak', portfolioRating: 6 }),
    ]

    const ranked = rankFor(pool, requirements(), role('architecture', ['arch_small_scale']))
    const weak = ranked.find((c) => c.specialist.id === 'weak')

    expect(ranked).toHaveLength(2)
    expect(weak?.passed).toBe(false)
    expect(weak?.failedGate).toBe('portfolio_threshold')
    expect(weak?.rank).toBe(0)
  })

  it('ранжирует по убыванию балла, начиная с первого', () => {
    const pool = [
      specialist({ id: 'second', portfolioRating: 8.5 }),
      specialist({ id: 'first', portfolioRating: 9.5 }),
      specialist({ id: 'third', portfolioRating: 8.1 }),
    ]

    const ranked = rankFor(pool, requirements(), role('architecture'))
      .filter((c) => c.passed)
      .sort((a, b) => a.rank - b.rank)

    expect(ranked.map((c) => c.specialist.id)).toEqual(['first', 'second', 'third'])
    expect(ranked[0].rank).toBe(1)
  })

  it('считает выживших по людям, а не по кандидатурам', () => {
    const generalist = specialist({
      id: 'generalist',
      disciplines: ['architecture', 'structural', 'mep', 'visualization'],
      weeklyCapacityHours: 40,
    })

    const result = assemble([generalist], requirements({ targetStage: 'concept' }))

    expect(result.pooledCount).toBe(1)
    expect(result.survivedCount).toBe(1)
    expect(result.candidates).toHaveLength(4)
  })
})

describe('исчерпывающий подбор', () => {
  /**
   * Жадный проход берёт верхнего по баллу в каждой роли независимо. Если
   * верхний в ранней роли — единственный, кто закрывает позднюю, состав
   * рассыпается там, где он существует.
   */
  it('не отдаёт раннюю роль тому, кто один закрывает позднюю', () => {
    const pool = [
      // Лучший архитектор, и он же единственный согласователь. Ёмкости ровно
      // на один слот: взять его дважды нельзя.
      specialist({
        id: 'generalist',
        disciplines: ['architecture', 'permitting'],
        weeklyCapacityHours: 10,
        portfolioRating: 10,
      }),
      specialist({ id: 'other-architect', portfolioRating: 8.5, weeklyCapacityHours: 40 }),
      specialist({ id: 'structural', disciplines: ['structural'], weeklyCapacityHours: 40 }),
      specialist({ id: 'mep', disciplines: ['mep'], weeklyCapacityHours: 40 }),
      specialist({ id: 'survey', disciplines: ['survey'], weeklyCapacityHours: 40 }),
      specialist({ id: 'viz', disciplines: ['visualization'], weeklyCapacityHours: 40 }),
    ]

    const result = assemble(pool, requirements({ requiredHoursPerWeek: 10 }))

    expect(result.outcome).toBe('ok')
    expect(result.team.find((m) => m.discipline === 'permitting')?.specialist.id).toBe('generalist')
    expect(result.team.find((m) => m.discipline === 'architecture')?.specialist.id).toBe(
      'other-architect',
    )
  })

  it('всё-таки отказывает, когда валидного состава нет', () => {
    // Тот же дефицит, но замены архитектору не существует.
    const pool = [
      specialist({
        id: 'generalist',
        disciplines: ['architecture', 'permitting'],
        weeklyCapacityHours: 10,
        portfolioRating: 10,
      }),
      specialist({ id: 'structural', disciplines: ['structural'], weeklyCapacityHours: 40 }),
      specialist({ id: 'mep', disciplines: ['mep'], weeklyCapacityHours: 40 }),
      specialist({ id: 'survey', disciplines: ['survey'], weeklyCapacityHours: 40 }),
      specialist({ id: 'viz', disciplines: ['visualization'], weeklyCapacityHours: 40 }),
    ]

    expect(assemble(pool, requirements({ requiredHoursPerWeek: 10 })).outcome).toBe('incomplete')
  })
})

describe('сработанность в подборе', () => {
  const pool = () => [
    specialist({ id: 'arch', disciplines: ['architecture'], weeklyCapacityHours: 40 }),
    // Два конструктора с одинаковым баллом: выбор решает только история.
    specialist({ id: 'struct-new', disciplines: ['structural'], weeklyCapacityHours: 40 }),
    specialist({ id: 'struct-proven', disciplines: ['structural'], weeklyCapacityHours: 40 }),
    specialist({ id: 'mep', disciplines: ['mep'], weeklyCapacityHours: 40 }),
    specialist({ id: 'viz', disciplines: ['visualization'], weeklyCapacityHours: 40 }),
  ]

  const req = () => requirements({ targetStage: 'concept' })

  it('при равном балле предпочитает того, с кем уже сдавали', () => {
    const history = new Map([
      [pairKey('arch', 'struct-proven'), { projects: 3, requestsAnswered: 6, conflicts: 0 }],
    ])

    const result = assemble(pool(), req(), history)

    expect(result.outcome).toBe('ok')
    expect(result.team.find((m) => m.discipline === 'structural')?.specialist.id).toBe(
      'struct-proven',
    )
  })

  it('пара, доходящая до арбитра, проигрывает незнакомой', () => {
    const history = new Map([
      [pairKey('arch', 'struct-proven'), { projects: 2, requestsAnswered: 0, conflicts: 5 }],
    ])

    const result = assemble(pool(), req(), history)

    expect(result.team.find((m) => m.discipline === 'structural')?.specialist.id).toBe('struct-new')
  })

  it('не пускает мимо гейтов и не перебивает разницу в баллах', () => {
    // Сработанность узкая по диапазону: она довод при равенстве, а не аргумент
    // против порога и не замена качеству.
    const weak = specialist({
      id: 'struct-weak',
      disciplines: ['structural'],
      portfolioRating: 7.9,
      weeklyCapacityHours: 40,
    })
    const strong = specialist({
      id: 'struct-strong',
      disciplines: ['structural'],
      portfolioRating: 9.8,
      weeklyCapacityHours: 40,
    })

    const history = new Map([
      [pairKey('arch', 'struct-weak'), { projects: 99, requestsAnswered: 99, conflicts: 0 }],
    ])

    const result = assemble(
      [...pool().filter((s) => !s.disciplines.includes('structural')), weak, strong],
      req(),
      history,
    )

    // Ниже порога — не в выборке, сколько бы совместных проектов ни было.
    expect(result.team.find((m) => m.discipline === 'structural')?.specialist.id).toBe(
      'struct-strong',
    )
  })

  it('без истории собирает то же, что и раньше', () => {
    const withEmpty = assemble(pool(), req(), new Map())
    const withDefault = assemble(pool(), req())

    expect(withDefault.team.map((m) => m.specialist.id)).toEqual(
      withEmpty.team.map((m) => m.specialist.id),
    )
  })
})

describe('единый пакет внутри команды', () => {
  it('не разваливает команду на два пакета через широкий набор ведущего', () => {
    // Ведущий работает в трёх пакетах. Двое смежников не пересекаются между
    // собой — с набором ведущего каждый совместим, друг с другом нет.
    const pool = [
      specialist({
        id: 'arch',
        disciplines: ['architecture'],
        software: ['revit', 'archicad', 'autocad'],
        portfolioRating: 9.5,
      }),
      specialist({
        id: 'struct-archicad',
        disciplines: ['structural'],
        software: ['archicad'],
        portfolioRating: 9.4,
      }),
      specialist({
        id: 'mep-revit',
        disciplines: ['mep'],
        software: ['revit'],
        portfolioRating: 9.3,
      }),
      specialist({
        id: 'mep-archicad',
        disciplines: ['mep'],
        software: ['archicad'],
        portfolioRating: 8.2,
      }),
      specialist({ id: 'viz', disciplines: ['visualization'], software: ['archicad', 'revit'] }),
    ]

    const result = assemble(pool, requirements({ targetStage: 'concept', software: [] }))

    expect(result.outcome).toBe('ok')

    // Балл выше у MEP на Revit, но общего пакета с конструктором у него нет.
    const packages = result.team.map((m) => new Set(m.specialist.software))
    const common = [...packages[0]].filter((p) => packages.every((set) => set.has(p)))

    expect(common.length).toBeGreaterThan(0)
    expect(result.team.find((m) => m.discipline === 'mep')?.specialist.id).toBe('mep-archicad')
  })

  it('пакет, заявленный клиентом, состав не ограничивает', () => {
    // Вся команда на ArchiCAD, клиент написал Revit: это справка, не гейт.
    const pool = [
      specialist({ id: 'arch', disciplines: ['architecture'], software: ['archicad'] }),
      specialist({ id: 'struct', disciplines: ['structural'], software: ['archicad'] }),
      specialist({ id: 'mep', disciplines: ['mep'], software: ['archicad'] }),
      specialist({ id: 'viz', disciplines: ['visualization'], software: ['archicad'] }),
    ]

    const result = assemble(pool, requirements({ targetStage: 'concept', software: ['revit'] }))

    expect(result.outcome).toBe('ok')
    expect(result.team).toHaveLength(4)
  })
})
