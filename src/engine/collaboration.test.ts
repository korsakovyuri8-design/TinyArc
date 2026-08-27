import { describe, expect, it } from 'vitest'
import { MAX_FACTOR, MIN_FACTOR, pairFactor, pairKey, teamFactor } from './collaboration'

const history = (patch: Partial<Parameters<typeof pairFactor>[0] & object> = {}) => ({
  projects: 0,
  requestsAnswered: 0,
  conflicts: 0,
  ...patch,
})

describe('сработанность пары', () => {
  it('без истории нейтральна', () => {
    expect(pairFactor(undefined)).toBe(1)
    expect(pairFactor(null)).toBe(1)
    expect(pairFactor(history())).toBe(1)
  })

  it('растёт от совместных проектов и упирается в потолок', () => {
    expect(pairFactor(history({ projects: 1 }))).toBeGreaterThan(1)
    expect(pairFactor(history({ projects: 3 }))).toBeGreaterThan(pairFactor(history({ projects: 1 })))
    expect(pairFactor(history({ projects: 100 }))).toBeLessThanOrEqual(MAX_FACTOR)
  })

  it('падает от споров, дошедших до арбитра', () => {
    expect(pairFactor(history({ conflicts: 1 }))).toBeLessThan(1)
    expect(pairFactor(history({ conflicts: 100 }))).toBeGreaterThanOrEqual(MIN_FACTOR)
  })

  it('спор весит тяжелее одного удачного проекта', () => {
    // Пара, которая на каждом объекте упирается в арбитраж, — это расход бюро.
    expect(pairFactor(history({ projects: 1, conflicts: 1 }))).toBeLessThan(1)
  })

  it('совместный опыт весит больше закрытых запросов', () => {
    expect(pairFactor(history({ projects: 3 }))).toBeGreaterThan(
      pairFactor(history({ requestsAnswered: 8 })),
    )
  })

  it('никогда не выходит за узкие границы', () => {
    for (const h of [
      history({ projects: 999, requestsAnswered: 999 }),
      history({ conflicts: 999 }),
      history({ projects: -5, conflicts: -5 }),
    ]) {
      const factor = pairFactor(h)
      expect(factor).toBeGreaterThanOrEqual(MIN_FACTOR)
      expect(factor).toBeLessThanOrEqual(MAX_FACTOR)
    }
  })
})

describe('ключ пары', () => {
  it('не зависит от порядка', () => {
    expect(pairKey('b', 'a')).toBe(pairKey('a', 'b'))
  })
})

describe('сработанность состава', () => {
  it('состав меньше двух человек нейтрален', () => {
    expect(teamFactor([], new Map())).toBe(1)
    expect(teamFactor(['a'], new Map())).toBe(1)
  })

  it('без истории нейтрален при любом размере', () => {
    expect(teamFactor(['a', 'b', 'c', 'd'], new Map())).toBe(1)
  })

  it('одна плохая пара не утягивает весь состав к краю', () => {
    const map = new Map([[pairKey('a', 'b'), history({ conflicts: 99 })]])
    const factor = teamFactor(['a', 'b', 'c', 'd', 'e'], map)

    // Из десяти пар испорчена одна: состав проседает на её долю, а не целиком.
    expect(factor).toBeLessThan(1)
    expect(factor).toBeCloseTo(0.99, 5)
    // До нижней границы отсюда далеко — в этом и смысл среднего.
    expect(factor - MIN_FACTOR).toBeGreaterThan(1 - factor)
  })

  it('сработавшийся состав выше несработавшегося', () => {
    const proven = new Map([
      [pairKey('a', 'b'), history({ projects: 3 })],
      [pairKey('a', 'c'), history({ projects: 3 })],
      [pairKey('b', 'c'), history({ projects: 3 })],
    ])

    expect(teamFactor(['a', 'b', 'c'], proven)).toBeGreaterThan(teamFactor(['a', 'b', 'c'], new Map()))
  })

  it('повторы в составе не считаются парой с самим собой', () => {
    expect(teamFactor(['a', 'a'], new Map())).toBe(1)
  })
})
