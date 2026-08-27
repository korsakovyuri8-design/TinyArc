import { describe, expect, it } from 'vitest'
import {
  MIN_AVAILABILITY,
  asHundred,
  availability,
  quality,
  relevance,
  scoreFor,
  timezoneOverlapHours,
} from './score'
import { deliveryMetrics, deliveryScore, historyWeight } from './metrics'
import { requirements, specialist } from './fixtures'

describe('метрики поставки', () => {
  it('не выдумывает метрики там, где истории нет', () => {
    expect(deliveryMetrics(specialist().delivery)).toBeNull()
    expect(deliveryScore(null)).toBe(0)
  })

  it('считает метрики из счётчиков тикетов', () => {
    const metrics = deliveryMetrics({
      deliveredTickets: 10,
      onTimeTickets: 9,
      firstTimeRightTickets: 7,
      responseMinutesTotal: 10 * 120,
      revisionRoundsTotal: 5,
    })

    expect(metrics).not.toBeNull()
    expect(metrics!.slaCompliance).toBeCloseTo(0.9)
    expect(metrics!.firstTimeRight).toBeCloseTo(0.7)
    expect(metrics!.responseHours).toBeCloseTo(2)
    expect(metrics!.revisionRate).toBeCloseTo(0.5)
  })

  it('даёт безупречной истории десятку', () => {
    const perfect = deliveryMetrics({
      deliveredTickets: 10,
      onTimeTickets: 10,
      firstTimeRightTickets: 10,
      responseMinutesTotal: 0,
      revisionRoundsTotal: 0,
    })

    expect(deliveryScore(perfect)).toBeCloseTo(10)
  })

  it('наращивает вес истории постепенно и упирается в потолок', () => {
    const counters = (n: number) => ({
      deliveredTickets: n,
      onTimeTickets: n,
      firstTimeRightTickets: n,
      responseMinutesTotal: 0,
      revisionRoundsTotal: 0,
    })

    expect(historyWeight(counters(0))).toBe(0)
    expect(historyWeight(counters(5))).toBeCloseTo(0.3)
    expect(historyWeight(counters(10))).toBeCloseTo(0.6)
    // Сто тикетов не дают больше шестидесяти процентов: портфолио не вытесняется совсем.
    expect(historyWeight(counters(100))).toBeCloseTo(0.6)
  })
})

describe('соответствие проекту', () => {
  it('даёт единицу полному совпадению по мягким измерениям', () => {
    expect(relevance(specialist(), requirements())).toBeCloseTo(1)
  })

  it('не обнуляет специалиста одним несовпадением', () => {
    const other = specialist({ typologies: ['mixed_use'] })
    const value = relevance(other, requirements({ typology: 'villa' }))

    expect(value).toBeLessThan(1)
    expect(value).toBeGreaterThanOrEqual(0.4)
  })

  it('держит нижнюю границу при полном промахе', () => {
    const mismatch = specialist({
      typologies: ['mixed_use'],
      scaleBands: ['3000_plus'],
      materialSystems: ['steel'],
      climateZones: ['alpine'],
      regulatoryTracks: ['standard'],
    })

    expect(relevance(mismatch, requirements({ areaSqm: 200 }))).toBeCloseTo(0.4)
  })

  it('засчитывает соседний диапазон площади наполовину', () => {
    const adjacent = specialist({ scaleBands: ['upto_250'] })
    const distant = specialist({ scaleBands: ['3000_plus'] })
    const req = requirements({ areaSqm: 400 })

    expect(relevance(adjacent, req)).toBeGreaterThan(relevance(distant, req))
  })
})

describe('доступность', () => {
  it('считает пересечение рабочего дня', () => {
    expect(timezoneOverlapHours(1, 1)).toBe(8)
    expect(timezoneOverlapHours(1, 5)).toBe(4)
    expect(timezoneOverlapHours(1, 9)).toBe(0)
  })

  it('обнуляется без свободной ёмкости', () => {
    const busy = specialist({ weeklyCapacityHours: 0 })
    expect(availability(busy, requirements())).toBe(0)
  })

  it('падает с ростом срока выхода на задачу', () => {
    const soon = specialist({ leadTimeDays: 0 })
    const late = specialist({ leadTimeDays: 25 })
    const req = requirements({ horizonDays: 30 })

    expect(availability(soon, req)).toBeGreaterThan(availability(late, req))
  })

  it('держит нижнюю границу для занятого, но не пустого специалиста', () => {
    // Один свободный час против десяти требуемых, выход почти на горизонте.
    const squeezed = specialist({ weeklyCapacityHours: 1, leadTimeDays: 28 })
    const factor = availability(squeezed, requirements({ horizonDays: 30 }))

    expect(factor).toBeGreaterThanOrEqual(MIN_AVAILABILITY)
    expect(factor).toBeLessThan(0.5)
  })

  it('не поднимает до границы того, кто не выйдет к сроку', () => {
    const tooLate = specialist({ leadTimeDays: 60 })
    expect(availability(tooLate, requirements({ horizonDays: 30 }))).toBe(0)
  })

  it('вычитает часы, уже занятые в этой же команде', () => {
    const person = specialist({ weeklyCapacityHours: 12 })
    const req = requirements({ requiredHoursPerWeek: 10 })

    expect(availability(person, req, 0)).toBeGreaterThan(availability(person, req, 10))
  })
})

describe('Quality × Availability', () => {
  it('у специалиста без истории Quality — это портфолио', () => {
    const fresh = specialist({ portfolioRating: 9 })
    const q = quality(fresh, requirements())

    expect(q.historyWeight).toBe(0)
    // Полное совпадение по мягким измерениям, поэтому relevance = 1.
    expect(q.quality).toBeCloseTo(9)
  })

  it('история поставок вытесняет портфолио', () => {
    const weakPortfolioStrongDelivery = specialist({
      portfolioRating: 8,
      delivery: {
        deliveredTickets: 10,
        onTimeTickets: 10,
        firstTimeRightTickets: 10,
        responseMinutesTotal: 0,
        revisionRoundsTotal: 0,
      },
    })

    const q = quality(weakPortfolioStrongDelivery, requirements())

    expect(q.historyWeight).toBeCloseTo(0.6)
    // 8 * 0.4 + 10 * 0.6 = 9.2
    expect(q.quality).toBeCloseTo(9.2)
  })

  it('недоступность нельзя компенсировать качеством: это произведение, не сумма', () => {
    const brilliantButBusy = specialist({ portfolioRating: 10, weeklyCapacityHours: 0 })
    const decentAndFree = specialist({ portfolioRating: 8, weeklyCapacityHours: 40 })
    const req = requirements()

    expect(scoreFor(brilliantButBusy, req).score).toBe(0)
    expect(scoreFor(decentAndFree, req).score).toBeGreaterThan(0)
  })

  it('возвращает разбор целиком, а не только итог', () => {
    const breakdown = scoreFor(specialist(), requirements())

    expect(breakdown).toMatchObject({
      portfolioRating: expect.any(Number),
      deliveryScore: expect.any(Number),
      historyWeight: expect.any(Number),
      relevance: expect.any(Number),
      quality: expect.any(Number),
      availability: expect.any(Number),
      score: expect.any(Number),
    })
    expect(breakdown.score).toBeCloseTo(breakdown.quality * breakdown.availability)
  })
})

describe('балл в сотне', () => {
  it('воспроизводит спецификацию отбора: гений на два часа проигрывает свободному профи', () => {
    // Архитектор А: скилл 98, доступность 0.3. Архитектор Б: скилл 90, 1.0.
    const genius = asHundred({
      portfolioRating: 9.8,
      deliveryScore: 0,
      historyWeight: 0,
      relevance: 1,
      quality: 9.8,
      availability: 0.3,
      score: 9.8 * 0.3,
    })

    const free = asHundred({
      portfolioRating: 9,
      deliveryScore: 0,
      historyWeight: 0,
      relevance: 1,
      quality: 9,
      availability: 1,
      score: 9,
    })

    expect(genius.skill).toBeCloseTo(98)
    expect(genius.final).toBeCloseTo(29.4)
    expect(free.skill).toBeCloseTo(90)
    expect(free.final).toBeCloseTo(90)

    // Алгоритм выдаёт Архитектора Б.
    expect(free.final).toBeGreaterThan(genius.final)
  })

  it('показывает совпадение процентом', () => {
    const breakdown = scoreFor(specialist({ portfolioRating: 10, weeklyCapacityHours: 40 }), requirements())
    expect(asHundred(breakdown).matchPercent).toBeGreaterThan(90)
  })
})
