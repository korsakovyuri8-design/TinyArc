import { describe, expect, it } from 'vitest'
import { margin, owed, rateFor, type PayoutRate } from './payout'

const rates: PayoutRate[] = [
  { discipline: 'architecture', stage: 'concept', amount: 400 },
  { discipline: 'structural', stage: 'permit', amount: 900 },
]

describe('гонорар', () => {
  it('заданная ставка находится по паре «дисциплина + стадия»', () => {
    expect(rateFor(rates, 'architecture', 'concept')).toBe(400)
    expect(rateFor(rates, 'structural', 'permit')).toBe(900)
  })

  /*
   * Ради этого случая функция и написана. Ноль означал бы бесплатную работу,
   * то есть маржу, равную всей цене стадии, — и ошибка эта всегда в одну
   * сторону: бизнес выглядит прибыльнее, чем он есть.
   */
  it('незаданная ставка — это не ноль', () => {
    expect(rateFor(rates, 'mep', 'permit')).toBe(null)
    expect(rateFor(rates, 'architecture', 'permit')).toBe(null)
  })

  it('ставка одной стадии не подставляется на соседнюю', () => {
    expect(rateFor(rates, 'structural', 'concept')).toBe(null)
  })

  it('обязательства складываются, не смешивая известное с незаданным', () => {
    expect(owed([400, null, 900, null])).toEqual({ known: 1300, unknown: 2 })
    expect(owed([])).toEqual({ known: 0, unknown: 0 })
  })

  it('маржа считается только по полному расходу', () => {
    expect(margin(5000, owed([400, 900]))).toEqual({
      known: true,
      amount: 3700,
      share: 3700 / 5000,
    })
  })

  it('при незаданной ставке маржи нет, и сказано, скольких не хватает', () => {
    expect(margin(5000, owed([400, null, null]))).toEqual({ known: false, missing: 2 })
  })

  /*
   * Отрицательная маржа — это ответ, а не поломка. Порог цены (`pricing.ts`)
   * держит маленькие проекты у себестоимости, и «вот здесь мы работаем в
   * убыток» — ровно то, ради чего это и считается.
   */
  it('убыток показывается убытком, а не нулём', () => {
    const result = margin(1000, owed([1400]))
    expect(result).toEqual({ known: true, amount: -400, share: -0.4 })
  })

  it('при нулевой выручке доля не выдумывается', () => {
    expect(margin(0, owed([]))).toEqual({ known: true, amount: 0, share: null })
  })
})
