import { describe, expect, it } from 'vitest'
import { exchangesWith, failedGate, passes } from './filter'
import { requirements, specialist } from './fixtures'

describe('жёсткие гейты', () => {
  it('пропускает специалиста, проходящего все измерения', () => {
    expect(failedGate(specialist(), requirements(), 'architecture')).toBeNull()
  })

  it('отсекает по порогу портфолио раньше всего остального', () => {
    // Портфолио 7.9 и сломанная дисциплина одновременно: сообщить надо про порог.
    const weak = specialist({ portfolioRating: 7.9, disciplines: [] })
    expect(failedGate(weak, requirements(), 'architecture')).toBe('portfolio_threshold')
  })

  it('держит порог ровно на 8/10', () => {
    expect(passes(specialist({ portfolioRating: 8 }), requirements(), 'architecture')).toBe(true)
    expect(passes(specialist({ portfolioRating: 7.99 }), requirements(), 'architecture')).toBe(false)
  })

  it('требует опыт согласований именно в стране проекта', () => {
    const elsewhere = specialist({ jurisdictions: ['RS'], signsIn: ['RS'] })
    expect(failedGate(elsewhere, requirements({ jurisdiction: 'ME' }), 'architecture')).toBe('jurisdiction')
  })

  it('отсекает по этажности, если опыта на такой высоте нет', () => {
    const low = specialist({ maxStoreys: 2 })
    expect(failedGate(low, requirements({ storeys: 4 }), 'architecture')).toBe('storeys')
    expect(failedGate(low, requirements({ storeys: 2 }), 'architecture')).toBeNull()
  })

  it('требует ведения документации до целевой стадии', () => {
    const conceptOnly = specialist({ docStages: ['concept'] })
    expect(failedGate(conceptOnly, requirements({ targetStage: 'permit' }), 'architecture')).toBe('doc_stage')
    expect(failedGate(conceptOnly, requirements({ targetStage: 'concept' }), 'architecture')).toBeNull()
  })

  it('считает общий формат заменой общего пакета', () => {
    // Разные пакеты, но координация по IFC — обмен есть.
    expect(exchangesWith({ software: ['archicad'], ifcLevel: 'coordination' }, ['revit'])).toBe(true)
    // Разные пакеты и только импорт — обмена нет.
    expect(exchangesWith({ software: ['archicad'], ifcLevel: 'import' }, ['revit'])).toBe(false)
    // Совпал пакет — уровень IFC уже не важен.
    expect(exchangesWith({ software: ['revit'], ifcLevel: 'none' }, ['revit'])).toBe(true)
  })

  it('отсекает по обмену моделями', () => {
    const isolated = specialist({ software: ['rhino'], ifcLevel: 'none' })
    expect(failedGate(isolated, requirements({ software: ['revit'] }), 'architecture')).toBe('software_exchange')
  })

  it('требует общий язык с клиентом', () => {
    const noCommon = specialist({ languages: ['el'] })
    expect(failedGate(noCommon, requirements({ languages: ['en'] }), 'architecture')).toBe('language')
  })

  it('требует язык органов именно от согласований', () => {
    // Английского хватает клиенту, но не хватает органам Черногории.
    const englishOnly = specialist({ disciplines: ['architecture', 'permitting'], languages: ['en'] })

    expect(failedGate(englishOnly, requirements({ jurisdiction: 'ME' }), 'architecture')).toBeNull()
    expect(failedGate(englishOnly, requirements({ jurisdiction: 'ME' }), 'permitting')).toBe('language')
  })

  it('отсекает по пересечению часовых поясов', () => {
    const faraway = specialist({ utcOffset: -8 })
    expect(failedGate(faraway, requirements({ utcOffset: 1 }), 'architecture')).toBe('timezone_overlap')
  })
})
