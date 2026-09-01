import { describe, expect, it } from 'vitest'
import {
  LAYER_GENERALISES,
  STALE_AFTER_DAYS,
  blocking,
  check,
  missingInputs,
  rulesFor,
  type Rule,
  type RuleSource,
  type SiteFacts,
} from './compliance'

const NOW = new Date('2026-09-01T00:00:00Z')

function source(checkedAt: string, effectiveFrom = '2020-01-01'): RuleSource {
  return { document: 'Plan', article: '1', effectiveFrom, checkedAt }
}

function rule(over: Partial<Rule> & Pick<Rule, 'id' | 'subject'>): Rule {
  return {
    layer: 'zoning',
    scope: { jurisdiction: 'ME' },
    operator: 'max',
    value: 5,
    source: source('2026-06-01'),
    ...over,
  } as Rule
}

const site: SiteFacts = { jurisdiction: 'ME', municipality: 'Bar', zone: 'S2' }

describe('какое правило действует на участке', () => {
  it('узкое перекрывает широкое: план квартала сильнее странового', () => {
    const all = [
      rule({ id: 'country', subject: 'storeys', value: 5 }),
      rule({
        id: 'zone',
        subject: 'storeys',
        value: 3,
        scope: { jurisdiction: 'ME', municipality: 'Bar', zone: 'S2' },
      }),
    ]

    expect(rulesFor(all, site).map((r) => r.id)).toEqual(['zone'])
  })

  it('чужой муниципалитет не применяется', () => {
    const all = [
      rule({ id: 'tivat', subject: 'storeys', scope: { jurisdiction: 'ME', municipality: 'Tivat' } }),
    ]

    expect(rulesFor(all, site)).toEqual([])
  })

  it('чужая страна не применяется — сербский отступ в Баре не действует', () => {
    const all = [rule({ id: 'rs', subject: 'setback_front_m', scope: { jurisdiction: 'RS' } })]

    expect(rulesFor(all, site)).toEqual([])
  })

  it('при равной узости побеждает вступившее в силу позже', () => {
    const all = [
      rule({ id: 'old', subject: 'height_m', value: 12, source: source('2026-06-01', '2018-01-01') }),
      rule({ id: 'new', subject: 'height_m', value: 15, source: source('2026-06-01', '2024-01-01') }),
    ]

    expect(rulesFor(all, site).map((r) => r.id)).toEqual(['new'])
  })
})

describe('исход проверки', () => {
  it('в пределах — прошло', () => {
    const findings = check([rule({ id: 'a', subject: 'storeys', value: 5 })], { ...site, storeys: 4 }, NOW)

    expect(findings[0].verdict).toBe('pass')
  })

  it('за пределом — не прошло, и видно на сколько', () => {
    const findings = check([rule({ id: 'a', subject: 'storeys', value: 5 })], { ...site, storeys: 9 }, NOW)

    expect(findings[0].verdict).toBe('fail')
    expect(findings[0].actual).toBe(9)
    expect(findings[0].rule.value).toBe(5)
  })

  it('минимум читается в обратную сторону: отступ меньше нормы не проходит', () => {
    const all = [rule({ id: 'a', subject: 'setback_front_m', operator: 'min', value: 5 })]

    expect(check(all, { ...site, setbackFrontM: 3 }, NOW)[0].verdict).toBe('fail')
    expect(check(all, { ...site, setbackFrontM: 6 }, NOW)[0].verdict).toBe('pass')
  })

  /*
   * Главное свойство слоя. Нечем проверить — так и сказано; молчаливое
   * «прошло» отправило бы непроверенное в орган под нашей подписью.
   */
  it('нечем проверить — не «прошло», а «не хватает данных», с именем поля', () => {
    const findings = check([rule({ id: 'a', subject: 'coverage_ratio', value: 0.3 })], site, NOW)

    expect(findings[0].verdict).toBe('needs_input')
    expect(findings[0].missing).toBe('coverageRatio')
    expect(missingInputs(findings)).toEqual(['coverageRatio'])
  })

  it('недостающее называется один раз, даже когда правил несколько', () => {
    const all = [
      rule({ id: 'a', subject: 'storeys', value: 5 }),
      rule({ id: 'b', subject: 'height_m', value: 12 }),
    ]

    expect(missingInputs(check(all, site, NOW))).toEqual(['heightM', 'storeys'])
  })
})

describe('устаревшая сверка', () => {
  const fresh = rule({ id: 'fresh', subject: 'storeys', value: 5, source: source('2026-06-01') })
  const old = rule({ id: 'old', subject: 'height_m', value: 9, source: source('2020-01-01') })

  it('правило, не сверявшееся дольше года, помечено', () => {
    const findings = check([fresh, old], { ...site, storeys: 4, heightM: 20 }, NOW)

    expect(findings.find((f) => f.rule.id === 'fresh')?.stale).toBe(false)
    expect(findings.find((f) => f.rule.id === 'old')?.stale).toBe(true)
  })

  it('устаревшее не блокирует подачу: это наша работа, а не проблема заказчика', () => {
    const findings = check([fresh, old], { ...site, storeys: 9, heightM: 20 }, NOW)

    expect(findings.filter((f) => f.verdict === 'fail')).toHaveLength(2)
    expect(blocking(findings).map((f) => f.rule.id)).toEqual(['fresh'])
  })

  it('запись без разбираемой даты сверки считается несверенной', () => {
    const broken = rule({ id: 'broken', subject: 'storeys', value: 5, source: source('когда-то') })

    expect(check([broken], { ...site, storeys: 4 }, NOW)[0].stale).toBe(true)
  })

  it('граница ровно на пороге ещё не устарела', () => {
    const edge = new Date(NOW.getTime() - STALE_AFTER_DAYS * 86_400_000).toISOString()
    const at = rule({ id: 'edge', subject: 'storeys', value: 5, source: source(edge) })

    expect(check([at], { ...site, storeys: 4 }, NOW)[0].stale).toBe(false)
  })
})

describe('слои', () => {
  /*
   * Не косметика: от этого зависит стоимость открытия следующей страны.
   * Зонирование набирается заново в каждом муниципалитете, конструкции
   * переиспользуются с национальным приложением.
   */
  it('зонирование не обобщается, инженерные слои обобщаются', () => {
    expect(LAYER_GENERALISES.zoning).toBe(false)
    expect(LAYER_GENERALISES.structural).toBe(true)
    expect(LAYER_GENERALISES.energy).toBe(true)
    expect(LAYER_GENERALISES.fire).toBe(true)
  })
})
