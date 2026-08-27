import { describe, expect, it } from 'vitest'
import { LIMITS, hit, retryMessage, sweep, type Bucket } from './rate-limit'

const limit = { limit: 3, windowMs: 60_000 }

describe('ограничение частоты', () => {
  it('пропускает в пределах окна и отсекает сверх него', () => {
    const store = new Map<string, Bucket>()
    const now = 1_000_000

    expect(hit(store, 'a', limit, now).allowed).toBe(true)
    expect(hit(store, 'a', limit, now).allowed).toBe(true)
    expect(hit(store, 'a', limit, now).allowed).toBe(true)

    const blocked = hit(store, 'a', limit, now)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSeconds).toBe(60)
  })

  it('считает окна раздельно по ключам', () => {
    const store = new Map<string, Bucket>()
    const now = 1_000_000

    for (let i = 0; i < 3; i += 1) hit(store, 'a', limit, now)

    expect(hit(store, 'a', limit, now).allowed).toBe(false)
    expect(hit(store, 'b', limit, now).allowed).toBe(true)
  })

  it('открывает новое окно, когда старое истекло', () => {
    const store = new Map<string, Bucket>()
    const now = 1_000_000

    for (let i = 0; i < 3; i += 1) hit(store, 'a', limit, now)
    expect(hit(store, 'a', limit, now).allowed).toBe(false)

    expect(hit(store, 'a', limit, now + limit.windowMs).allowed).toBe(true)
  })

  it('сокращает остаток по мере хода времени', () => {
    const store = new Map<string, Bucket>()
    const now = 1_000_000

    for (let i = 0; i < 3; i += 1) hit(store, 'a', limit, now)

    expect(hit(store, 'a', limit, now + 30_000).retryAfterSeconds).toBe(30)
  })

  it('не копит истёкшие окна', () => {
    const store = new Map<string, Bucket>()
    const now = 1_000_000

    hit(store, 'a', limit, now)
    hit(store, 'b', limit, now + limit.windowMs)

    sweep(store, now + limit.windowMs + 1)
    expect(store.has('a')).toBe(false)
    expect(store.has('b')).toBe(true)
  })

  it('держит пороги дорогих форм ниже дешёвых', () => {
    // Бриф запускает прогон по всему пулу, вход по ключу не делает ничего.
    expect(LIMITS.brief.limit).toBeLessThan(LIMITS.enter.limit)
    expect(LIMITS.application.limit).toBeLessThan(LIMITS.enter.limit)
  })

  it('говорит человеку, когда возвращаться', () => {
    expect(retryMessage(30)).toContain('минуту')
    expect(retryMessage(600)).toContain('10 мин')
  })
})
