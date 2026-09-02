import { describe, expect, it } from 'vitest'
import { MATERIAL_GROUPS, TRADES, materialGroupsFor, tradesFor, type BuildShape } from './trades'

const villa: BuildShape = {
  typology: 'villa',
  storeys: 2,
  areaSqm: 200,
  materialSystem: 'concrete',
  terrain: 'flat',
  gridConnection: 'grid',
}

describe('состав стройки', () => {
  it('работы берутся из закрытого словаря', () => {
    expect(tradesFor(villa).every((trade) => TRADES.includes(trade))).toBe(true)
  })

  it('перечень без повторов и в порядке словаря', () => {
    const trades = tradesFor({ ...villa, materialSystem: 'hybrid', terrain: 'slope', areaSqm: 900 })

    expect(new Set(trades).size).toBe(trades.length)
    expect([...trades].sort((a, b) => TRADES.indexOf(a) - TRADES.indexOf(b))).toEqual(trades)
  })

  /*
   * Каменщик у каркасного дома — это человек, которого позвали, а делать ему
   * нечего. Состав следует из системы, а не из привычки.
   */
  it('кладка есть у каменного и бетонного, но не у каркасного', () => {
    expect(tradesFor({ ...villa, materialSystem: 'masonry' })).toContain('masonry')
    expect(tradesFor({ ...villa, materialSystem: 'concrete' })).toContain('masonry')
    expect(tradesFor({ ...villa, materialSystem: 'timber' })).not.toContain('masonry')
    expect(tradesFor({ ...villa, materialSystem: 'steel' })).not.toContain('masonry')
  })

  it('склон добавляет благоустройство даже маленькой вилле', () => {
    expect(tradesFor(villa)).not.toContain('landscaping')
    expect(tradesFor({ ...villa, terrain: 'slope' })).toContain('landscaping')
  })

  it('многоквартирный дом получает благоустройство независимо от площади', () => {
    expect(tradesFor({ ...villa, typology: 'multi_family', areaSqm: 200 })).toContain('landscaping')
  })

  it('подключение к сетям есть всегда: автономка — это тоже подключение', () => {
    expect(tradesFor(villa)).toContain('utility_connection')
    expect(tradesFor({ ...villa, gridConnection: 'off_grid' })).toContain('utility_connection')
  })
})

describe('группы материалов', () => {
  it('берутся из закрытого словаря и без повторов', () => {
    const groups = materialGroupsFor({ ...villa, materialSystem: 'hybrid' })

    expect(groups.every((group) => MATERIAL_GROUPS.includes(group))).toBe(true)
    expect(new Set(groups).size).toBe(groups.length)
  })

  it('материальная система решает, что закупается несущего', () => {
    expect(materialGroupsFor({ ...villa, materialSystem: 'timber' })).toContain('timber')
    expect(materialGroupsFor({ ...villa, materialSystem: 'timber' })).not.toContain('concrete_rebar')
    expect(materialGroupsFor({ ...villa, materialSystem: 'steel' })).toContain('steel')
  })

  /*
   * Объёмов нет намеренно: приблизительная ведомость, названная точной, — это
   * спор на приёмке. Настоящие объёмы приходят из рабочей документации, а не
   * из коэффициента, вписанного по памяти.
   */
  it('ведомость говорит, что покупать, и молчит про сколько', () => {
    const groups = materialGroupsFor(villa)

    expect(groups.every((group) => typeof group === 'string')).toBe(true)
  })
})
