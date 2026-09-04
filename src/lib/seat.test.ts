import { describe, expect, it } from 'vitest'
import { PORTFOLIO_THRESHOLD } from '@/engine/taxonomy'
import { SEAT_TONES, seatOf } from './seat'

/** Человек, у которого всё в порядке. Каждый случай портит ровно одно поле. */
const good = {
  status: 'active',
  subscription: 'founding',
  portfolioRating: 9,
  weeklyCapacityHours: 20,
}

describe('место в отборе', () => {
  it('у того, кто прошёл всё, место есть', () => {
    const seat = seatOf(good)
    expect(seat.inSelection).toBe(true)
    expect(seat.tone).toBe('pass')
    expect(seat.turn).toBe(null)
  })

  /*
   * Ради этого случая функция и написана. Приглашённый импортом дозаполняет
   * профиль и уходит на разбор — а доска говорит ему «тикеты появятся, когда
   * движок поставит вас в команду». Движок не может: в пуле его нет.
   */
  it('ушедший на разбор ждёт бюро, а не задач', () => {
    const seat = seatOf({ ...good, status: 'pending', portfolioRating: 0 })
    expect(seat.inSelection).toBe(false)
    expect(seat.turn).toBe('bureau')
    expect(seat.body).toContain(`${PORTFOLIO_THRESHOLD}/10`)
  })

  it('приглашённому говорят про профиль, а не про порог', () => {
    const seat = seatOf({ ...good, status: 'invited', portfolioRating: 0 })
    expect(seat.turn).toBe('you')
    expect(seat.headline.toLowerCase()).toContain('profile')
  })

  /*
   * Порядок гейтов повторяет движок, и деньги идут раньше портфолио не для
   * красоты: отказ по деньгам не должен выглядеть отказом по квалификации.
   */
  it('закрытый доступ называется деньгами, даже когда портфолио тоже слабое', () => {
    const seat = seatOf({ ...good, subscription: 'none', portfolioRating: 1 })
    expect(seat.headline.toLowerCase()).toContain('access')
    expect(seat.body).toContain('not about the quality of your work')
  })

  it('слабое портфолио названо порогом', () => {
    const seat = seatOf({ ...good, portfolioRating: PORTFOLIO_THRESHOLD - 0.1 })
    expect(seat.inSelection).toBe(false)
    expect(seat.tone).toBe('fail')
  })

  it('ноль часов — ход человека, а не приговор', () => {
    const seat = seatOf({ ...good, weeklyCapacityHours: 0 })
    expect(seat.inSelection).toBe(false)
    expect(seat.turn).toBe('you')
    expect(seat.tone).toBe('wait')
  })

  it('порог ровно на границе пропускает', () => {
    expect(seatOf({ ...good, portfolioRating: PORTFOLIO_THRESHOLD }).inSelection).toBe(true)
  })

  it('отказ по портфолио не обсуждается: ход ничей', () => {
    expect(seatOf({ ...good, status: 'rejected' }).turn).toBe(null)
  })

  it('незнакомый статус читается как снятие с отбора, а не как место в пуле', () => {
    const seat = seatOf({ ...good, status: 'something_new' })
    expect(seat.inSelection).toBe(false)
  })

  it('у каждого случая есть тон из закрытого списка и непустые слова', () => {
    const cases = [
      good,
      { ...good, status: 'invited' },
      { ...good, status: 'pending' },
      { ...good, status: 'rejected' },
      { ...good, status: 'paused' },
      { ...good, subscription: 'none' },
      { ...good, portfolioRating: 0 },
      { ...good, weeklyCapacityHours: 0 },
    ]

    for (const person of cases) {
      const seat = seatOf(person)
      expect(SEAT_TONES).toContain(seat.tone)
      expect(seat.headline.length).toBeGreaterThan(0)
      expect(seat.body.length).toBeGreaterThan(0)
      // Место в пуле и названная помеха — взаимоисключающие вещи.
      expect(seat.inSelection).toBe(seat.tone === 'pass')
    }
  })
})
