import { describe, expect, it } from 'vitest'
import { CURRENCY, priceProject, priceStage, totalPrice, type PricedProject } from './pricing'

const project = (patch: Partial<PricedProject> = {}): PricedProject => ({
  typology: 'villa',
  jurisdiction: 'ME',
  areaSqm: 400,
  targetStage: 'permit',
  ...patch,
})

describe('цена стадии', () => {
  it('выводится из площади и ставки', () => {
    // 400 м² × 10 €/м² × 1 × 1 = 4000, порог 2200 не срабатывает.
    const basis = priceStage(project(), 'permit')

    expect(basis.amount).toBe(4000)
    expect(basis.atFloor).toBe(false)
    expect(basis.currency).toBe(CURRENCY)
  })

  it('не опускается ниже порога на маленьком объекте', () => {
    // 90 м² × 10 = 900 против порога 2200: работа та же, площадь меньше.
    const basis = priceStage(project({ areaSqm: 90 }), 'permit')

    expect(basis.amount).toBe(2200)
    expect(basis.atFloor).toBe(true)
  })

  it('растёт с числом владельцев, а не с площадью дважды', () => {
    const villa = priceStage(project({ typology: 'villa' }), 'permit').amount
    const multi = priceStage(project({ typology: 'multi_family' }), 'permit').amount

    expect(multi).toBeGreaterThan(villa)
    expect(multi).toBe(Math.round(villa * 1.2))
  })

  it('учитывает уровень цен страны', () => {
    const me = priceStage(project({ jurisdiction: 'ME' }), 'permit').amount
    const rs = priceStage(project({ jurisdiction: 'RS' }), 'permit').amount
    const gr = priceStage(project({ jurisdiction: 'GR' }), 'permit').amount

    expect(rs).toBeLessThan(me)
    expect(gr).toBeGreaterThan(me)
  })

  it('разрешение стоит дороже концепции: под ним стоит подпись', () => {
    const p = project()

    expect(priceStage(p, 'permit').amount).toBeGreaterThan(priceStage(p, 'concept').amount)
  })

  /*
   * Разбор — не украшение. Счёт без него можно только принять на веру, а это
   * ровно тот порядок, который продукт заменяет.
   */
  it('возвращает то, из чего цена сложилась', () => {
    const basis = priceStage(project(), 'permit')

    expect(basis.ratePerSqm).toBe(10)
    expect(basis.areaSqm).toBe(400)
    expect(basis.typologyFactor).toBe(1)
    expect(basis.jurisdictionFactor).toBe(1)
    expect(basis.floor).toBe(2200)
    expect(basis.amount).toBe(
      Math.round(basis.areaSqm * basis.ratePerSqm * basis.typologyFactor * basis.jurisdictionFactor),
    )
  })
})

describe('цена проекта', () => {
  it('считает стадии до целевой включительно и по порядку', () => {
    expect(priceProject(project({ targetStage: 'concept' })).map((b) => b.stage)).toEqual([
      'concept',
    ])

    expect(priceProject(project({ targetStage: 'tender' })).map((b) => b.stage)).toEqual([
      'concept',
      'permit',
      'tender',
    ])
  })

  it('не считает стадии за целевой: заказчик их не заказывал', () => {
    const stages = priceProject(project({ targetStage: 'permit' })).map((b) => b.stage)

    expect(stages).not.toContain('tender')
    expect(stages).not.toContain('construction')
  })

  it('итог — сумма стадий, и он больше любой из них', () => {
    const p = project({ targetStage: 'construction' })
    const stages = priceProject(p)

    expect(totalPrice(p)).toBe(stages.reduce((sum, b) => sum + b.amount, 0))
    for (const basis of stages) expect(totalPrice(p)).toBeGreaterThan(basis.amount)
  })

  it('одинаковый проект стоит одинаково: цена не зависит от прогона', () => {
    expect(totalPrice(project())).toBe(totalPrice(project()))
  })
})
