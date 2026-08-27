import { describe, expect, it } from 'vitest'
import {
  MAX_STOREYS,
  PORTFOLIO_THRESHOLD,
  requiredDisciplines,
  scaleBandFor,
  stagesUpTo,
} from './taxonomy'

describe('таксономия', () => {
  it('относит площадь к диапазону по верхней границе', () => {
    expect(scaleBandFor(120)).toBe('upto_250')
    expect(scaleBandFor(250)).toBe('250_1000')
    expect(scaleBandFor(999)).toBe('250_1000')
    expect(scaleBandFor(3000)).toBe('3000_plus')
    expect(scaleBandFor(50_000)).toBe('3000_plus')
  })

  it('идёт по стадиям, а не прыгает в целевую', () => {
    expect(stagesUpTo('concept')).toEqual(['concept'])
    expect(stagesUpTo('permit')).toEqual(['concept', 'permit'])
    expect(stagesUpTo('construction')).toEqual(['concept', 'permit', 'tender', 'construction'])
  })

  it('определяет состав команды типологией, а не шаблоном', () => {
    const villa = requiredDisciplines('villa', 'concept')
    const mixed = requiredDisciplines('mixed_use', 'concept')

    expect(villa).toEqual(['architecture', 'structural', 'mep'])
    expect(mixed).toContain('interiors')
    expect(mixed).toContain('landscape')
    expect(mixed.length).toBeGreaterThan(villa.length)
  })

  it('добавляет согласования и геодезию со стадии разрешения', () => {
    expect(requiredDisciplines('villa', 'concept')).not.toContain('permitting')
    expect(requiredDisciplines('villa', 'permit')).toContain('permitting')
    expect(requiredDisciplines('villa', 'permit')).toContain('survey')
    // Стадии проходятся насквозь: рабочая документация тоже требует согласований.
    expect(requiredDisciplines('villa', 'construction')).toContain('permitting')
  })

  it('держит зафиксированные концептом пороги', () => {
    expect(PORTFOLIO_THRESHOLD).toBe(8)
    expect(MAX_STOREYS).toBe(5)
  })
})
