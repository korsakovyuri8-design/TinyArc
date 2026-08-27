import { describe, expect, it } from 'vitest'
import { failedGate, narrowPackages, passes, sharesPackage } from './filter'
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

  it('не отсекает специалиста за пакет, заявленный клиентом', () => {
    // Клиент покупает комплект, а не право выбирать, в чём его начертят.
    // Сильный конструктор в другом пакете — потеря для проекта, а не нарушение.
    const other = specialist({ software: ['archicad'], portfolioRating: 10 })

    expect(failedGate(other, requirements({ software: ['revit'] }), role('architecture'))).toBeNull()
  })

  it('общий пакет проверяется по набору команды, а не по клиенту', () => {
    expect(sharesPackage({ software: ['archicad'] }, ['revit'])).toBe(false)
    expect(sharesPackage({ software: ['archicad', 'revit'] }, ['revit'])).toBe(true)
    // Команда ещё не начата — ограничивать нечем.
    expect(sharesPackage({ software: ['rhino'] }, [])).toBe(true)
  })

  it('общий набор сужается с каждым участником, а не остаётся набором ведущего', () => {
    // Ведущий с тремя пакетами: если не сужать, двое смежников пройдут каждый
    // по своему и останутся без общего между собой.
    const lead = narrowPackages({ software: ['revit', 'archicad', 'autocad'] }, null)
    expect(lead.sort()).toEqual(['archicad', 'autocad', 'revit'])

    const afterSecond = narrowPackages({ software: ['archicad', 'autocad'] }, lead)
    expect(afterSecond.sort()).toEqual(['archicad', 'autocad'])

    const afterThird = narrowPackages({ software: ['autocad'] }, afterSecond)
    expect(afterThird).toEqual(['autocad'])

    // Четвёртый только на Revit общего с командой уже не имеет.
    expect(sharesPackage({ software: ['revit'] }, afterThird)).toBe(false)
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
