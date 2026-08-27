import { describe, expect, it } from 'vitest'
import { failedGate, passes, worksInStack } from './filter'
import { requirements, role, specialist } from './fixtures'

describe('жёсткие гейты', () => {
  it('пропускает специалиста, проходящего все измерения', () => {
    expect(failedGate(specialist(), requirements(), role('architecture'))).toBeNull()
  })

  it('отсекает по порогу портфолио раньше всего остального', () => {
    // Портфолио 7.9 и сломанная дисциплина одновременно: сообщить надо про порог.
    const weak = specialist({ portfolioRating: 7.9, disciplines: [], specializations: [] })
    expect(failedGate(weak, requirements(), role('architecture'))).toBe('portfolio_threshold')
  })

  it('держит порог ровно на 8/10', () => {
    expect(passes(specialist({ portfolioRating: 8 }), requirements(), role('architecture'))).toBe(true)
    expect(passes(specialist({ portfolioRating: 7.99 }), requirements(), role('architecture'))).toBe(false)
  })

  it('требует опыт согласований именно в стране проекта', () => {
    const elsewhere = specialist({ jurisdictions: ['RS'], signsIn: ['RS'] })
    expect(failedGate(elsewhere, requirements({ jurisdiction: 'ME' }), role('architecture'))).toBe('jurisdiction')
  })

  it('отсекает по этажности, если опыта на такой высоте нет', () => {
    const low = specialist({ maxStoreys: 2 })
    expect(failedGate(low, requirements({ storeys: 4 }), role('architecture'))).toBe('storeys')
    expect(failedGate(low, requirements({ storeys: 2 }), role('architecture'))).toBeNull()
  })

  it('требует ведения документации до целевой стадии', () => {
    const conceptOnly = specialist({ docStages: ['concept'] })
    expect(failedGate(conceptOnly, requirements({ targetStage: 'permit' }), role('architecture'))).toBe('doc_stage')
    expect(failedGate(conceptOnly, requirements({ targetStage: 'concept' }), role('architecture'))).toBeNull()
  })

  it('технологический шлюз: координация по IFC не отменяет совпадения пакета', () => {
    // Гений на ArchiCAD в проекте на Revit не проходит, каким бы ни был IFC.
    expect(worksInStack({ software: ['archicad'] }, ['revit'])).toBe(false)
    expect(worksInStack({ software: ['revit'] }, ['revit'])).toBe(true)
    // Пакет не задан — шлюза нет.
    expect(worksInStack({ software: ['rhino'] }, [])).toBe(true)
  })

  it('отсекает по пакету, даже если специалист координируется по IFC', () => {
    const brilliant = specialist({
      software: ['archicad'],
      ifcLevel: 'coordination',
      portfolioRating: 10,
    })

    expect(failedGate(brilliant, requirements({ software: ['revit'] }), role('architecture'))).toBe(
      'software_exchange',
    )
  })

  it('пропускает по пакету, когда клиент его не задал', () => {
    const isolated = specialist({ software: ['rhino'], ifcLevel: 'none' })
    expect(failedGate(isolated, requirements({ software: [] }), role('architecture'))).toBeNull()
  })

  it('отсекает, когда дисциплина та, а специализация не та', () => {
    // Конструктор по бетону на деревянном доме.
    const concrete = specialist({
      disciplines: ['structural'],
      specializations: ['structural_concrete'],
    })

    expect(
      failedGate(concrete, requirements(), role('structural', ['structural_concrete'])),
    ).toBeNull()
    expect(
      failedGate(concrete, requirements(), role('structural', ['structural_timber'])),
    ).toBe('specialization')
  })

  it('требует все специализации, когда роль в режиме all', () => {
    const partial = specialist({
      disciplines: ['mep'],
      specializations: ['mep_hvac', 'mep_electrical'],
    })

    const full = role('mep', ['mep_hvac', 'mep_electrical', 'mep_plumbing'], 'all')

    expect(failedGate(partial, requirements(), full)).toBe('specialization')
  })

  it('требует общий язык с клиентом', () => {
    const noCommon = specialist({ languages: ['el'] })
    expect(failedGate(noCommon, requirements({ languages: ['en'] }), role('architecture'))).toBe('language')
  })

  it('требует язык органов именно от согласований', () => {
    // Английского хватает клиенту, но не хватает органам Черногории.
    const englishOnly = specialist({ disciplines: ['architecture', 'permitting'], languages: ['en'] })

    expect(failedGate(englishOnly, requirements({ jurisdiction: 'ME' }), role('architecture'))).toBeNull()
    expect(failedGate(englishOnly, requirements({ jurisdiction: 'ME' }), role('permitting'))).toBe('language')
  })

  it('отсекает по пересечению часовых поясов', () => {
    const faraway = specialist({ utcOffset: -8 })
    expect(failedGate(faraway, requirements({ utcOffset: 1 }), role('architecture'))).toBe('timezone_overlap')
  })
})
