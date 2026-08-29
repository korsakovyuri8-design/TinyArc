import { describe, expect, it } from 'vitest'
import { LIMITS, completedKey, hit, retryMessage, sweep, type Bucket } from './rate-limit'

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
    // Сравнивается дорогой счётчик: попыток у формы больше, чем у входа, и это
    // правильно — попытка формы не стоит ничего, пока не прошла проверки.
    expect(LIMITS.brief.completed).toBeLessThan(LIMITS.enter.limit)
    expect(LIMITS.application.completed).toBeLessThan(LIMITS.enter.limit)
  })

  it('говорит человеку, когда возвращаться', () => {
    expect(retryMessage(30)).toContain('минуту')
    expect(retryMessage(600)).toContain('10 мин')
  })
})

/*
 * Два счётчика на одну форму.
 *
 * Отклонённая форма стоит разбора схемы, принятая — прогона по всему пулу.
 * Пока это был один счётчик, человек с двумя опечатками в брифе упирался в
 * предел на третьей попытке и слышал «слишком часто» вместо «поправьте поле».
 * Такую регрессию на глаз не видно: форма работает, просто иногда не для всех.
 */
describe('дорогие и дешёвые отправки', () => {
  it('у брифа предел попыток заметно выше предела прогонов', () => {
    expect(LIMITS.brief.completed).toBeLessThan(LIMITS.brief.limit)
    expect(LIMITS.application.completed).toBeLessThan(LIMITS.application.limit)
  })

  it('человек с опечатками не выбирает бюджет прогонов', () => {
    const store = new Map<string, Bucket>()
    const now = 0

    // Пять отправок подряд — столько же опечаток. Все проходят: платить за них
    // нечем, дорогая работа так и не началась.
    for (let i = 0; i < 5; i += 1) {
      expect(hit(store, 'brief:ip', LIMITS.brief, now).allowed).toBe(true)
    }

    // Дорогой счётчик при этом не тронут.
    expect(store.get(completedKey('brief:ip'))).toBeUndefined()
  })

  it('дорогой счётчик исчерпывается ровно за столько прогонов, сколько названо', () => {
    const store = new Map<string, Bucket>()
    const limit = { ...LIMITS.brief, limit: LIMITS.brief.completed }

    for (let i = 0; i < LIMITS.brief.completed; i += 1) {
      expect(hit(store, completedKey('brief:ip'), limit, 0).allowed).toBe(true)
    }

    expect(hit(store, completedKey('brief:ip'), limit, 0).allowed).toBe(false)
  })
})
