/**
 * Фильтр списка пула.
 *
 * Углы, которые видно только здесь: пустое условие пропускает всех (иначе
 * страница откроется пустой), поиск не смотрит на регистр (имя оператор
 * помнит, написание — нет), а мусор из адресной строки отбрасывается, а не
 * роняет страницу.
 */

import { describe, expect, it } from 'vitest'
import { DISCIPLINES, JURISDICTIONS } from '@/engine/taxonomy'
import { EMPTY_CRITERIA, isNarrowed, matches, readCriteria, type PoolRow } from './pool-filter'

const STATUSES = ['active', 'paused', 'rejected'] as const

const allowed = {
  disciplines: DISCIPLINES,
  jurisdictions: JURISDICTIONS,
  statuses: STATUSES,
}

const row: PoolRow = {
  displayName: 'Miloš Popović',
  email: 'milos@example.com',
  status: 'active',
  disciplines: ['structural'],
  jurisdictions: ['ME', 'RS'],
}

describe('matches', () => {
  it('пустые условия пропускают всех', () => {
    expect(matches(row, EMPTY_CRITERIA)).toBe(true)
  })

  it('ищет по имени независимо от регистра', () => {
    expect(matches(row, { ...EMPTY_CRITERIA, query: 'popo' })).toBe(true)
    expect(matches(row, { ...EMPTY_CRITERIA, query: 'POPO' })).toBe(true)
  })

  it('ищет по адресу: оператор приходит из письма', () => {
    expect(matches(row, { ...EMPTY_CRITERIA, query: 'milos@example' })).toBe(true)
  })

  it('не находит того, кого нет', () => {
    expect(matches(row, { ...EMPTY_CRITERIA, query: 'jovanović' })).toBe(false)
  })

  it('сужает по дисциплине', () => {
    expect(matches(row, { ...EMPTY_CRITERIA, discipline: 'structural' })).toBe(true)
    expect(matches(row, { ...EMPTY_CRITERIA, discipline: 'mep' })).toBe(false)
  })

  it('сужает по стране', () => {
    expect(matches(row, { ...EMPTY_CRITERIA, jurisdiction: 'RS' })).toBe(true)
    expect(matches(row, { ...EMPTY_CRITERIA, jurisdiction: 'GR' })).toBe(false)
  })

  it('сужает по статусу', () => {
    expect(matches(row, { ...EMPTY_CRITERIA, status: 'active' })).toBe(true)
    expect(matches(row, { ...EMPTY_CRITERIA, status: 'paused' })).toBe(false)
  })

  it('условия складываются, а не заменяют друг друга', () => {
    expect(matches(row, { query: 'popo', discipline: 'structural', jurisdiction: 'ME', status: 'active' })).toBe(true)
    expect(matches(row, { query: 'popo', discipline: 'structural', jurisdiction: 'GR', status: 'active' })).toBe(false)
  })
})

describe('readCriteria', () => {
  it('берёт заданное', () => {
    expect(readCriteria({ q: ' popo ', discipline: 'structural', country: 'ME', status: 'active' }, allowed)).toEqual({
      query: 'popo',
      discipline: 'structural',
      jurisdiction: 'ME',
      status: 'active',
    })
  })

  it('отбрасывает значение, которого нет в словаре, а не падает', () => {
    expect(readCriteria({ discipline: 'astrology', country: 'XX', status: 'beloved' }, allowed)).toEqual(
      EMPTY_CRITERIA,
    )
  })

  it('пустая строка запроса — это отсутствие условий', () => {
    expect(readCriteria({}, allowed)).toEqual(EMPTY_CRITERIA)
    expect(isNarrowed(readCriteria({}, allowed))).toBe(false)
  })

  it('заданное условие видно по isNarrowed: иначе сброс некуда показать', () => {
    expect(isNarrowed(readCriteria({ q: 'popo' }, allowed))).toBe(true)
    expect(isNarrowed(readCriteria({ status: 'paused' }, allowed))).toBe(true)
  })

  it('повторённый параметр берётся первым, а не списком', () => {
    expect(readCriteria({ q: ['popo', 'jovan'] }, allowed).query).toBe('popo')
  })
})
