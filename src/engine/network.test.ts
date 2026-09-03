import { describe, expect, it } from 'vitest'
import {
  CONTRACTOR_THRESHOLD,
  type ContractorProfile,
} from './contractor'
import { MIN_TRADE_DEPTH, networkReadiness, tradeDepth } from './network'
import { TRADES, type Trade } from './trades'

const NO_HISTORY = {
  deliveredTickets: 0,
  onTimeTickets: 0,
  firstTimeRightTickets: 0,
  responseMinutesTotal: 0,
  revisionRoundsTotal: 0,
}

let counter = 0

function contractor(trades: Trade[], over: Partial<ContractorProfile> = {}): ContractorProfile {
  counter += 1

  return {
    id: `c${counter}`,
    displayName: `Builder ${counter}`,
    trades,
    jurisdictions: ['ME'],
    municipalities: [],
    typologies: ['villa'],
    scaleBands: ['250_1000'],
    portfolioRating: 9,
    insured: true,
    available: true,
    delivery: NO_HISTORY,
    ...over,
  }
}

/** Сеть, где все работы закрыты с запасом. */
function full(): ContractorProfile[] {
  return [contractor([...TRADES]), contractor([...TRADES])]
}

function forTrade(rows: ReturnType<typeof tradeDepth>, trade: Trade) {
  return rows.find((row) => row.trade === trade)
}

describe('глубина сети', () => {
  /*
   * Главное свойство: работа, которую не делает никто, обязана быть строкой с
   * нулём. Считать по заявленному значило бы не увидеть именно те дыры, ради
   * которых список и существует.
   */
  it('проходит по словарю работ, а не по заявленным', () => {
    const rows = tradeDepth([contractor(['roofing'])])

    expect(rows).toHaveLength(TRADES.length)
    expect(forTrade(rows, 'foundations')?.claimed).toBe(0)
    expect(forTrade(rows, 'foundations')?.severity).toBe('none')
    expect(forTrade(rows, 'foundations')?.reason).toBe('nobody')
  })

  it('пустая сеть — все работы пусты, и это сказано, а не выведено', () => {
    const rows = tradeDepth([])

    expect(rows.every((row) => row.severity === 'none' && row.reason === 'nobody')).toBe(true)
  })

  it('один подрядчик — не покрытие: работа держится на его занятости', () => {
    const rows = tradeDepth([contractor(['roofing'])])

    expect(forTrade(rows, 'roofing')?.eligible).toBe(1)
    expect(forTrade(rows, 'roofing')?.severity).toBe('thin')
  })

  it('порог глубины закрывает работу', () => {
    const network = Array.from({ length: MIN_TRADE_DEPTH }, () => contractor(['roofing']))
    const rows = tradeDepth(network)

    expect(forTrade(rows, 'roofing')?.severity).toBe('ok')
    expect(forTrade(rows, 'roofing')?.reason).toBeNull()
  })

  it('заявивших считает отдельно от годных', () => {
    const rows = tradeDepth([
      contractor(['roofing']),
      contractor(['roofing'], { insured: false }),
      contractor(['roofing'], { portfolioRating: 4 }),
    ])

    expect(forTrade(rows, 'roofing')?.claimed).toBe(3)
    expect(forTrade(rows, 'roofing')?.eligible).toBe(1)
  })
})

describe('какая причина названа', () => {
  /*
   * Порядок причин — по дешевизне лечения, а не по числу отсеянных. Один
   * просроченный полис важнее пяти слабых портфолио: первый закрывается
   * звонком сегодня, второе — наймом за месяцы.
   */
  it('просроченный полис назван раньше слабого портфолио, даже если слабых больше', () => {
    const rows = tradeDepth([
      contractor(['roofing'], { insured: false }),
      contractor(['roofing'], { portfolioRating: 3 }),
      contractor(['roofing'], { portfolioRating: 3 }),
      contractor(['roofing'], { portfolioRating: 3 }),
    ])

    expect(forTrade(rows, 'roofing')?.reason).toBe('insurance')
  })

  it('занятость названа, когда сильные и застрахованные есть, но заняты', () => {
    const rows = tradeDepth([contractor(['roofing'], { available: false })])

    expect(forTrade(rows, 'roofing')?.reason).toBe('availability')
  })

  it('слабое портфолио названо, когда сильных нет вовсе', () => {
    const rows = tradeDepth([
      contractor(['roofing'], { portfolioRating: CONTRACTOR_THRESHOLD - 0.1 }),
      contractor(['roofing'], { portfolioRating: 2 }),
    ])

    expect(forTrade(rows, 'roofing')?.reason).toBe('portfolio')
  })

  it('нехватка числа при живых подрядчиках — это поиск, а не причина отказа', () => {
    const rows = tradeDepth([contractor(['roofing'])])

    expect(forTrade(rows, 'roofing')?.severity).toBe('thin')
    expect(forTrade(rows, 'roofing')?.reason).toBe('nobody')
  })
})

describe('готовность сети одним числом', () => {
  it('полная сеть — единица', () => {
    expect(networkReadiness(full())).toBe(1)
  })

  it('пустая — ноль', () => {
    expect(networkReadiness([])).toBe(0)
  })

  it('работа на одном подрядчике считается закрытой наполовину', () => {
    const one = networkReadiness([contractor([...TRADES])])

    expect(one).toBeCloseTo(0.5)
  })

  it('растёт, когда дыру закрывают', () => {
    const before = networkReadiness([contractor(['roofing']), contractor(['roofing'])])
    const after = networkReadiness([
      contractor(['roofing']),
      contractor(['roofing']),
      contractor(['foundations']),
      contractor(['foundations']),
    ])

    expect(after).toBeGreaterThan(before)
  })
})
