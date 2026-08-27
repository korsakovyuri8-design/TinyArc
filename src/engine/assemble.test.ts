import { describe, expect, it } from 'vitest'
import { assemble, rankFor } from './assemble'
import { fullPool, requirements, specialist } from './fixtures'

describe('сборка Tiny Team', () => {
  it('собирает команду под все обязательные дисциплины', () => {
    const result = assemble(fullPool(), requirements({ targetStage: 'permit' }))

    expect(result.outcome).toBe('ok')
    expect(result.team.map((m) => m.discipline).sort()).toEqual(
      ['architecture', 'mep', 'permitting', 'structural', 'survey'].sort(),
    )
  })

  it('не собирает команду на проект вне границы', () => {
    const result = assemble(fullPool(), requirements({ storeys: 9 }))

    expect(result.outcome).toBe('rejected')
    expect(result.team).toHaveLength(0)
    expect(result.candidates).toHaveLength(0)
  })

  it('сообщает, какая дисциплина не закрыта', () => {
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
    // Все верхние кандидаты без подписи; подписывает только слабый конструктор.
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

    expect(result.outcome).toBe('ok')
    const signatory = result.team.find((m) => m.isSignatory)
    expect(signatory?.specialist.id).toBe('signing-structural')
    expect(signatory?.discipline).toBe('structural')
  })

  it('уступает место следующему, если кандидат ломает обмен моделями', () => {
    // Архитектор ведёт на Revit. Верхний конструктор — Rhino без IFC.
    const pool = [
      specialist({ id: 'arch', disciplines: ['architecture'], software: ['revit'], portfolioRating: 9.5 }),
      specialist({
        id: 'isolated-structural',
        disciplines: ['structural'],
        software: ['rhino'],
        ifcLevel: 'none',
        portfolioRating: 9.9,
      }),
      specialist({
        id: 'exchanging-structural',
        disciplines: ['structural'],
        software: ['tekla'],
        ifcLevel: 'coordination',
        portfolioRating: 8.5,
      }),
      specialist({ id: 'mep', disciplines: ['mep'], software: ['revit'] }),
    ]

    const result = assemble(pool, requirements({ targetStage: 'concept', software: [] }))
    const structural = result.team.find((m) => m.discipline === 'structural')

    expect(result.outcome).toBe('ok')
    // Балл выше у изолированного, но в команду идёт тот, кто обменивается.
    expect(structural?.specialist.id).toBe('exchanging-structural')
  })

  it('не выдаёт один и тот же час дважды', () => {
    // Один универсал на две дисциплины, ёмкости хватает ровно на один слот.
    const generalist = specialist({
      id: 'generalist',
      disciplines: ['architecture', 'structural', 'mep'],
      weeklyCapacityHours: 10,
      portfolioRating: 10,
    })
    const backup = specialist({
      id: 'backup',
      disciplines: ['structural', 'mep'],
      weeklyCapacityHours: 40,
      portfolioRating: 8,
    })

    const result = assemble(
      [generalist, backup],
      requirements({ targetStage: 'concept', requiredHoursPerWeek: 10 }),
    )

    expect(result.outcome).toBe('ok')
    const byGeneralist = result.team.filter((m) => m.specialist.id === 'generalist')
    expect(byGeneralist).toHaveLength(1)
  })

  it('позволяет универсалу закрыть несколько дисциплин, когда ёмкости хватает', () => {
    const generalist = specialist({
      id: 'generalist',
      disciplines: ['architecture', 'structural', 'mep'],
      weeklyCapacityHours: 40,
      portfolioRating: 10,
    })

    const result = assemble([generalist], requirements({ targetStage: 'concept' }))

    expect(result.outcome).toBe('ok')
    expect(result.team).toHaveLength(3)
    expect(new Set(result.team.map((m) => m.specialist.id)).size).toBe(1)
  })
})

describe('ранжирование и разбор', () => {
  it('хранит и прошедших, и отсеянных с причиной', () => {
    const pool = [
      specialist({ id: 'good', portfolioRating: 9 }),
      specialist({ id: 'weak', portfolioRating: 6 }),
    ]

    const ranked = rankFor(pool, requirements(), 'architecture')
    const weak = ranked.find((c) => c.specialist.id === 'weak')

    expect(ranked).toHaveLength(2)
    expect(weak?.passed).toBe(false)
    expect(weak?.failedGate).toBe('portfolio_threshold')
    // Отсеянному ранг не присваивается.
    expect(weak?.rank).toBe(0)
  })

  it('ранжирует по убыванию балла, начиная с первого', () => {
    const pool = [
      specialist({ id: 'second', portfolioRating: 8.5 }),
      specialist({ id: 'first', portfolioRating: 9.5 }),
      specialist({ id: 'third', portfolioRating: 8.1 }),
    ]

    const ranked = rankFor(pool, requirements(), 'architecture')
      .filter((c) => c.passed)
      .sort((a, b) => a.rank - b.rank)

    expect(ranked.map((c) => c.specialist.id)).toEqual(['first', 'second', 'third'])
    expect(ranked[0].rank).toBe(1)
  })

  it('считает выживших по людям, а не по кандидатурам', () => {
    const generalist = specialist({
      id: 'generalist',
      disciplines: ['architecture', 'structural', 'mep'],
      weeklyCapacityHours: 40,
    })

    const result = assemble([generalist], requirements({ targetStage: 'concept' }))

    expect(result.pooledCount).toBe(1)
    expect(result.survivedCount).toBe(1)
    // Кандидатур при этом три — по одной на дисциплину.
    expect(result.candidates).toHaveLength(3)
  })
})
