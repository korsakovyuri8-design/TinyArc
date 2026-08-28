import { describe, expect, it } from 'vitest'
import { SPECIALIZATIONS, DISCIPLINES } from '@/engine/taxonomy'
import type { AssemblyGap } from '@/engine/types'
import { clientExplanation, parseGap, roleName } from './gap'

const gap = (patch: Partial<AssemblyGap> = {}): AssemblyGap => ({
  discipline: 'structural',
  specializations: ['structural_timber'],
  mode: 'any',
  candidates: 0,
  ...patch,
})

describe('нехватка состава для заказчика', () => {
  it('называет роль по-русски', () => {
    expect(roleName(gap())).toBe('Конструкции — Дерево, каркас, CLT')
  })

  it('«все» читается как «и», «любая» — как «или»', () => {
    const all = gap({
      discipline: 'mep',
      specializations: ['mep_hvac', 'mep_electrical'],
      mode: 'all',
    })
    const any = gap({ ...all, mode: 'any' })

    expect(roleName(all)).toContain(' и ')
    expect(roleName(any)).toContain(' или ')
  })

  it('дисциплина без специализаций называется одним словом', () => {
    expect(roleName(gap({ discipline: 'survey', specializations: [] }))).toBe('Геодезия')
  })

  /**
   * Главное здесь. Клиент — владелец участка, а не оператор системы, и
   * внутренние имена в его кабинете читаются как сбой, а не как точность.
   */
  it('ни одного внутреннего имени не уходит заказчику', () => {
    // Ключи таксономии — строчный snake_case. Русские подписи их не содержат:
    // «MEP» внутри «Инженерия (MEP)» — это заглавная аббревиатура, и она
    // остаётся заглавной, потому что фраза не приводит роль к нижнему
    // регистру. Приводила — и «Инженерия (MEP)» читалась как «инженерия (mep)».
    const internal = [...SPECIALIZATIONS, ...DISCIPLINES]

    for (const mode of ['all', 'any'] as const) {
      for (const candidates of [0, 3]) {
        const { headline, body } = clientExplanation(
          gap({ discipline: 'mep', specializations: ['mep_hvac', 'mep_off_grid'], mode, candidates }),
          'ME',
        )

        const text = `${headline} ${body}`
        for (const name of internal) expect(text).not.toContain(name)
      }
    }
  })

  it('пустая роль и дефицитная объясняются по-разному', () => {
    const empty = clientExplanation(gap({ candidates: 0 }), 'ME').body
    const scarce = clientExplanation(gap({ candidates: 4 }), 'ME').body

    expect(empty).toContain('такого специалиста в пуле сейчас нет')
    expect(scarce).toContain('4')
    expect(scarce).not.toContain('в пуле сейчас нет')
  })

  it('называет страну по-русски', () => {
    expect(clientExplanation(gap(), 'GR').body).toContain('Греция')
  })

  it('не обещает срока', () => {
    const { body } = clientExplanation(gap(), 'ME')

    for (const promise of ['недел', 'дн.', 'в течение', 'скоро']) {
      expect(body).not.toContain(promise)
    }
  })
})

describe('разбор сохранённой нехватки', () => {
  it('читает то, что записал движок', () => {
    expect(parseGap(JSON.stringify(gap()))).toEqual(gap())
  })

  it('пустая строка — это отсутствие нехватки, а не ошибка', () => {
    expect(parseGap('')).toBeNull()
  })

  it('мусор не роняет страницу проекта', () => {
    expect(parseGap('{не json')).toBeNull()
    expect(parseGap('{"что-то":1}')).toBeNull()
  })
})
