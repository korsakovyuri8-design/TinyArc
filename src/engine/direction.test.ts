import { describe, expect, it } from 'vitest'
import { DIRECTIONS_SHOWN, directionByKey, directionsFor, promptFor } from './direction'
import type { ProjectShape } from './taxonomy'

const shape = (patch: Partial<ProjectShape> = {}): ProjectShape => ({
  typology: 'villa',
  targetStage: 'permit',
  materialSystem: 'concrete',
  terrain: 'flat',
  gridConnection: 'grid',
  ...patch,
})

const keys = (s: ProjectShape) => directionsFor(s).map((d) => d.key)

describe('направления по брифу', () => {
  it('показывает ровно столько, сколько это ещё выбор', () => {
    expect(directionsFor(shape())).toHaveLength(DIRECTIONS_SHOWN)
    expect(directionsFor(shape({ terrain: 'slope' }))).toHaveLength(DIRECTIONS_SHOWN)
  })

  it('не предлагает террасирование на ровном участке', () => {
    expect(keys(shape({ terrain: 'flat' }))).not.toContain('terraced')
    expect(keys(shape({ terrain: 'slope' }))).toContain('terraced')
  })

  it('предлагает поднятый уровень только там, где есть риск подтопления', () => {
    expect(keys(shape({ terrain: 'flood_prone' }))).toContain('stilts')
    expect(keys(shape({ terrain: 'flat' }))).not.toContain('stilts')
  })

  it('не предлагает павильоны там, где их не бывает', () => {
    expect(keys(shape({ typology: 'villa' }))).toContain('pavilions')
    expect(keys(shape({ typology: 'mixed_use' }))).not.toContain('pavilions')
  })

  it('не предлагает внутренний двор для mixed-use', () => {
    expect(keys(shape({ typology: 'mixed_use' }))).not.toContain('courtyard')
  })

  it('даёт разным проектам разные наборы', () => {
    const villa = keys(shape({ typology: 'villa', terrain: 'flat' }))
    const slope = keys(shape({ typology: 'villa', terrain: 'slope' }))
    const mixed = keys(shape({ typology: 'mixed_use', terrain: 'flat' }))

    expect(villa).not.toEqual(slope)
    expect(villa).not.toEqual(mixed)
  })

  it('на один и тот же бриф отвечает одинаково', () => {
    expect(keys(shape({ terrain: 'slope' }))).toEqual(keys(shape({ terrain: 'slope' })))
  })

  it('у каждого направления есть цена, а не только достоинства', () => {
    for (const direction of directionsFor(shape({ terrain: 'slope' }))) {
      expect(direction.tradeoff.length).toBeGreaterThan(20)
      expect(direction.summary.length).toBeGreaterThan(20)
    }
  })
})

describe('описание для генератора', () => {
  it('собирается из фактов проекта, а не из общих слов', () => {
    const prompt = promptFor(shape({ terrain: 'slope' }), 420, 2, 'mediterranean', 'terraced')

    expect(prompt).toContain('villa')
    expect(prompt).toContain('420')
    expect(prompt).toContain('2 storeys')
    expect(prompt).toContain('Mediterranean')
    expect(prompt).toContain('terraced')
  })

  it('не подмешивает глянец и чужие имена', () => {
    const prompt = promptFor(shape(), 400, 2, 'mediterranean', 'compact').toLowerCase()

    for (const word of ['luxury', 'award', 'zaha', 'ando', 'render by', 'trending']) {
      expect(prompt).not.toContain(word)
    }
  })

  it('падает на неизвестном направлении, а не выдумывает описание', () => {
    expect(() => promptFor(shape(), 400, 2, 'mediterranean', 'нет-такого')).toThrow()
  })
})

describe('поиск направления по ключу', () => {
  it('возвращает подпись для выбранного варианта', () => {
    expect(directionByKey('courtyard')?.title).toBe('Courtyard')
  })

  it('на неизвестный ключ отвечает пустотой, а не выдумкой', () => {
    expect(directionByKey('нет-такого')).toBeNull()
  })
})
