import { describe, expect, it } from 'vitest'
import {
  FEE_REFERENCE_SQM,
  feeFactor,
  feeFor,
  margin,
  owed,
  rateFor,
  type PayoutRate,
} from './payout'

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

describe('пересчёт гонорара по размеру объекта', () => {
  it('на объекте обычного размера платится названное число', () => {
    expect(feeFactor(FEE_REFERENCE_SQM)).toBe(1)
    expect(feeFor(rates, 'architecture', 'concept', FEE_REFERENCE_SQM)).toBe(400)
  })

  it('больший объект стоит дороже, меньший — дешевле', () => {
    // Вдвое меньший здесь не годится: двести метров уже упираются в нижний
    // предел пересчёта, и проверка мерила бы не пропорцию, а порог.
    expect(feeFor(rates, 'structural', 'permit', 800)).toBe(1800)
    expect(feeFor(rates, 'structural', 'permit', 280)).toBe(630)
  })

  /*
   * Половина работы над разделом от площади не зависит вовсе: посадка,
   * согласование решения, выпуск. Ставка, падающая пропорционально до нуля,
   * означала бы отказ людей от маленьких объектов, а не дешёвый проект.
   */
  it('на очень маленьком объекте гонорар не проваливается пропорционально', () => {
    expect(feeFactor(40)).toBe(0.6)
    expect(feeFor(rates, 'architecture', 'concept', 40)).toBe(240)
  })

  it('на очень большом объекте множитель упирается в потолок', () => {
    expect(feeFactor(5000)).toBe(3)
    expect(feeFor(rates, 'structural', 'permit', 5000)).toBe(2700)
  })

  /*
   * Тот же случай, ради которого написан `rateFor`: незаданное умножению не
   * подлежит. Ноль здесь означал бы бесплатную работу.
   */
  it('незаданная ставка остаётся незаданной после пересчёта', () => {
    expect(feeFor(rates, 'mep', 'permit', 400)).toBeNull()
  })
})
