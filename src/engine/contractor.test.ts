import { describe, expect, it } from 'vitest'
import {
  CONTRACTOR_THRESHOLD,
  SHORTLIST_SIZE,
  contractorGate,
  scoreContractor,
  shortlist,
  type ContractorNeed,
  type ContractorProfile,
} from './contractor'
import type { BuildShape } from './trades'

const shape: BuildShape = {
  typology: 'villa',
  storeys: 2,
  areaSqm: 400,
  materialSystem: 'concrete',
  terrain: 'flat',
  gridConnection: 'grid',
}

const need: ContractorNeed = {
  trade: 'foundations',
  jurisdiction: 'ME',
  municipality: 'Bar',
  shape,
}

const NO_HISTORY = {
  deliveredTickets: 0,
  onTimeTickets: 0,
  firstTimeRightTickets: 0,
  responseMinutesTotal: 0,
  revisionRoundsTotal: 0,
}

function contractor(over: Partial<ContractorProfile> = {}): ContractorProfile {
  return {
    id: 'c1',
    displayName: 'Builder',
    trades: ['foundations', 'structure'],
    jurisdictions: ['ME'],
    municipalities: ['Bar'],
    typologies: ['villa'],
    scaleBands: ['250_1000'],
    portfolioRating: 9,
    insured: true,
    available: true,
    delivery: NO_HISTORY,
    ...over,
  }
}

describe('гейты подрядчика', () => {
  it('подходящий проходит', () => {
    expect(contractorGate(contractor(), need)).toBeNull()
  })

  it('без права работать в стране — не проходит', () => {
    expect(contractorGate(contractor({ jurisdictions: ['RS'] }), need)).toBe('jurisdiction')
  })

  /*
   * Порядок причин важен: полис проверяется раньше портфолио, чтобы сильному
   * подрядчику с просроченной страховкой не сказали, что он не прошёл отбор.
   */
  it('страховка проверяется раньше портфолио', () => {
    const weak = contractor({ insured: false, portfolioRating: 3 })

    expect(contractorGate(weak, need)).toBe('insurance')
  })

  it('чужая работа — не проходит', () => {
    expect(contractorGate(contractor({ trades: ['roofing'] }), need)).toBe('trade')
  })

  it('порог по портфолио тот же, что у специалиста', () => {
    expect(contractorGate(contractor({ portfolioRating: CONTRACTOR_THRESHOLD - 0.1 }), need)).toBe(
      'portfolio',
    )
    expect(contractorGate(contractor({ portfolioRating: CONTRACTOR_THRESHOLD }), need)).toBeNull()
  })

  it('занятый не проходит', () => {
    expect(contractorGate(contractor({ available: false }), need)).toBe('availability')
  })
})

describe('балл подрядчика', () => {
  const needed = ['foundations', 'structure', 'roofing'] as const

  it('на пустой истории качество — это портфолио, а не выдуманный рейтинг', () => {
    const scored = scoreContractor(contractor({ portfolioRating: 8.6 }), need, [...needed])

    expect(scored.quality).toBeCloseTo(8.6)
  })

  it('местный опыт поднимает балл, а не решает всё', () => {
    const local = scoreContractor(contractor(), need, [...needed])
    const stranger = scoreContractor(contractor({ municipalities: [] }), need, [...needed])

    expect(local.score).toBeGreaterThan(stranger.score)
    expect(stranger.score).toBeGreaterThan(0)
  })

  it('чужая типология роняет соответствие, но не обнуляет', () => {
    const wrong = scoreContractor(contractor({ typologies: ['mixed_use'] }), need, [...needed])

    expect(wrong.relevance).toBeGreaterThanOrEqual(0.4)
    expect(wrong.relevance).toBeLessThan(1)
  })

  it('считается, сколько нужных работ подрядчик закрывает: меньше стыков — лучше', () => {
    expect(scoreContractor(contractor(), need, [...needed]).coveredTrades).toBe(2)
  })
})

describe('короткий список', () => {
  const needed = ['foundations'] as const

  it('трое, а не двадцать: двадцать — это отбор обратно на заказчика', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      contractor({ id: `c${i}`, portfolioRating: 8 + i * 0.1 }),
    )

    expect(shortlist(many, need, [...needed]).ranked).toHaveLength(SHORTLIST_SIZE)
  })

  /*
   * Прошедших считается больше, чем показывается, и это число обязано быть
   * отдельным: «двенадцать ведут работу → трое в списке» без него читается как
   * девять отказов, и бюро идёт искать дыру, которой нет.
   */
  it('прошедшие считаются до потолка, а не по длине списка', () => {
    const many = Array.from({ length: 12 }, (_, i) => contractor({ id: `c${i}` }))
    const list = shortlist(many, need, [...needed])

    expect(list.passed).toBe(12)
    expect(list.ranked).toHaveLength(SHORTLIST_SIZE)
  })

  it('лучший — первый', () => {
    const list = shortlist(
      [
        contractor({ id: 'weak', portfolioRating: 8.1 }),
        contractor({ id: 'strong', portfolioRating: 9.8 }),
      ],
      need,
      [...needed],
    )

    expect(list.ranked[0].contractorId).toBe('strong')
  })

  it('причины отказа посчитаны по именам: бюро видит, чего не хватает в сети', () => {
    const list = shortlist(
      [
        contractor({ id: 'a', jurisdictions: ['RS'] }),
        contractor({ id: 'b', insured: false }),
        contractor({ id: 'c', trades: ['roofing'] }),
        contractor({ id: 'd' }),
      ],
      need,
      [...needed],
    )

    expect(list.pooled).toBe(4)
    expect(list.rejected.jurisdiction).toBe(1)
    expect(list.rejected.insurance).toBe(1)
    expect(list.ranked).toHaveLength(1)
  })

  /*
   * Найдено на стенде: сводка показывала «1 без страховки» на каждой из
   * четырнадцати работ — один подрядчик с просроченным полисом попадал в
   * причины даже там, где он такую работу не ведёт вовсе. Бюро читало это как
   * четырнадцать дыр в сети вместо одной.
   */
  it('не ведущий работу — не кандидат, а не отклонённый', () => {
    const list = shortlist(
      [
        contractor({ id: 'roofer', trades: ['roofing'], insured: false }),
        contractor({ id: 'ok' }),
      ],
      need,
      [...needed],
    )

    expect(list.outOfScope).toBe(1)
    expect(list.rejected.insurance).toBe(0)
    expect(list.rejected.trade).toBe(0)
  })

  it('причина засчитывается тому, кто мог бы эту работу сделать', () => {
    const list = shortlist([contractor({ id: 'lapsed', insured: false })], need, [...needed])

    expect(list.outOfScope).toBe(0)
    expect(list.rejected.insurance).toBe(1)
  })

  it('никого не прошло — список пуст, а не заполнен кем попало', () => {
    const list = shortlist([contractor({ insured: false })], need, [...needed])

    expect(list.ranked).toEqual([])
  })

  /*
   * Структурная защита, а не правило поведения: у подрядчика нет поля, которым
   * можно купить позицию, и добавить его — значит сломать этот тест вместе с
   * доверием ко всему отбору.
   */
  it('позицию в выдаче нельзя купить: такого поля не существует', () => {
    const keys = Object.keys(contractor())

    expect(keys).not.toContain('paid')
    expect(keys).not.toContain('sponsored')
    expect(keys).not.toContain('promoted')
    expect(keys.some((key) => /paid|sponsor|promot|boost|featur/i.test(key))).toBe(false)
  })
})
