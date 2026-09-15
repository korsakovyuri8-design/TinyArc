import { describe, expect, it } from 'vitest'
import { validateProject } from './validate'
import { requirements } from './fixtures'

describe('продуктовая граница', () => {
  it('берёт проект внутри границы', () => {
    expect(validateProject(requirements()).ok).toBe(true)
  })

  it('берёт ровно пять этажей и отказывает на шести', () => {
    expect(validateProject(requirements({ storeys: 5 })).ok).toBe(true)

    const tall = validateProject(requirements({ storeys: 6 }))
    expect(tall.ok).toBe(false)
    expect(tall.ok === false && tall.reason).toContain('above the product boundary')
  })

  it('отказывает в зоне стандартного регулирования', () => {
    const heavy = validateProject(requirements({ regulatoryTrack: 'standard' }))

    expect(heavy.ok).toBe(false)
    expect(heavy.ok === false && heavy.reason).toContain('light-regulation')
  })

  it('отказывает в неоткрытой стране', () => {
    /*
     * Страна взята за пределами ЕЭП намеренно. Раньше здесь стояла Франция —
     * пока география бюро была из трёх стран, она годилась как «любая чужая».
     * С открытием ЕЭП проверка перестала проверять что-либо и падала, требуя
     * отказать там, где бюро теперь работает.
     *
     * Грузия за границей списка по существу, а не по недосмотру: признание
     * квалификаций по директиве на неё не распространяется, и подпись оттуда
     * в европейском деле не действует.
     */
    const elsewhere = validateProject(
      requirements({ jurisdiction: 'GE' as unknown as 'ME' }),
    )

    expect(elsewhere.ok).toBe(false)
  })

  it('не пропускает бессмысленные габариты', () => {
    expect(validateProject(requirements({ storeys: 0 })).ok).toBe(false)
    expect(validateProject(requirements({ areaSqm: 0 })).ok).toBe(false)
  })
})
