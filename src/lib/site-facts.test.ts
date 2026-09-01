import { describe, expect, it } from 'vitest'
import { siteFacts, type SiteInput } from './site-facts'

const empty: SiteInput = {
  jurisdiction: 'ME',
  municipality: null,
  zone: null,
  storeys: 2,
  areaSqm: 420,
  plotAreaSqm: null,
  footprintSqm: null,
  heightM: null,
  setbackFrontM: null,
  setbackSideM: null,
  setbackRearM: null,
  units: null,
  parkingSpaces: null,
  greenSqm: null,
}

describe('факты участка', () => {
  it('этажность есть всегда: она в брифе обязательна', () => {
    expect(siteFacts(empty).storeys).toBe(2)
  })

  /*
   * Главное свойство слоя. Ноль вместо неизвестного проходит проверку и врёт,
   * что участок застроен на ноль процентов, — а движок на пустоте честно
   * скажет «не хватает данных».
   */
  it('неизвестное остаётся неизвестным, а не превращается в ноль', () => {
    const facts = siteFacts(empty)

    expect(facts.coverageRatio).toBeUndefined()
    expect(facts.floorAreaRatio).toBeUndefined()
    expect(facts.heightM).toBeUndefined()
    expect(facts.parkingPerUnit).toBeUndefined()
  })

  it('плотность считается сразу, как только известна площадь участка', () => {
    const facts = siteFacts({ ...empty, plotAreaSqm: 1000 })

    expect(facts.floorAreaRatio).toBeCloseTo(0.42)
    // Пятна ещё нет — процент застройки не выдумывается из площади здания.
    expect(facts.coverageRatio).toBeUndefined()
  })

  it('процент застройки появляется вместе с пятном', () => {
    const facts = siteFacts({ ...empty, plotAreaSqm: 1000, footprintSqm: 260 })

    expect(facts.coverageRatio).toBeCloseTo(0.26)
  })

  it('участок нулевой площади — ошибка ввода, а не бесконечная плотность', () => {
    const facts = siteFacts({ ...empty, plotAreaSqm: 0, footprintSqm: 260 })

    expect(facts.coverageRatio).toBeUndefined()
    expect(facts.floorAreaRatio).toBeUndefined()
  })

  it('парковка считается на единицу, а не на здание', () => {
    const facts = siteFacts({ ...empty, units: 4, parkingSpaces: 6 })

    expect(facts.parkingPerUnit).toBeCloseTo(1.5)
  })

  it('пустая зона не отличается от отсутствующей', () => {
    expect(siteFacts({ ...empty, zone: '   ', municipality: 'Bar' })).toMatchObject({
      zone: undefined,
      municipality: 'Bar',
    })
  })
})
