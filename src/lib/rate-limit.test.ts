/**
 * Политика ограничителя.
 *
 * Сам счёт здесь не проверяется, и это перемена: он переехал из памяти
 * процесса в базу, потому что в памяти окно у каждого инстанса своё, а
 * перезапуск контейнера обнуляет накопленное. Считать его теперь умеет только
 * база — условным обновлением, — и подделка счёта картой в памяти
 * доказывала бы поведение, которого в продукте больше нет.
 *
 * Настоящий счёт проверяется на стенде: `e2e/limits.mts` бьёт по форме, пока
 * она не откажет, и смотрит на строку окна в базе.
 *
 * Здесь остаётся то, что от базы не зависит: соотношение порогов и слова,
 * которыми отказ произносится.
 */

import { describe, expect, it } from 'vitest'
import { LIMITS, PASSED, completedKey, refusal, retryMessage } from './rate-limit'

describe('пороги', () => {
  it('держит пороги дорогих форм ниже дешёвых', () => {
    // Бриф запускает прогон по всему пулу, вход по ключу не делает ничего.
    // Сравнивается дорогой счётчик: попыток у формы больше, чем у входа, и это
    // правильно — попытка формы не стоит ничего, пока не прошла проверки.
    expect(LIMITS.brief.completed).toBeLessThan(LIMITS.enter.limit)
    expect(LIMITS.application.completed).toBeLessThan(LIMITS.enter.limit)
  })

  /*
   * Два счётчика на одну форму.
   *
   * Отклонённая форма стоит разбора схемы, принятая — прогона по всему пулу.
   * Пока это был один счётчик, человек с двумя опечатками в брифе упирался в
   * предел на третьей попытке и слышал «слишком часто» вместо «поправьте поле».
   * Такую регрессию на глаз не видно: форма работает, просто иногда не для всех.
   */
  it('у брифа предел попыток заметно выше предела прогонов', () => {
    expect(LIMITS.brief.completed).toBeLessThan(LIMITS.brief.limit)
    expect(LIMITS.application.completed).toBeLessThan(LIMITS.application.limit)
  })

  /*
   * Пароль панели — единственный предел, который стоит против подбора, а не
   * против нагрузки. Он обязан быть самым строгим: всё остальное защищает
   * работу, он — вход.
   */
  it('пароль панели строже всех остальных пределов', () => {
    for (const [name, limit] of Object.entries(LIMITS)) {
      if (name === 'opsLogin') continue
      expect(LIMITS.opsLogin.limit, name).toBeLessThanOrEqual(limit.limit)
    }
  })

  it('окно у каждого предела положительное', () => {
    for (const [name, limit] of Object.entries(LIMITS)) {
      expect(limit.windowMs, name).toBeGreaterThan(0)
      expect(limit.limit, name).toBeGreaterThan(0)
    }
  })
})

describe('дорогой счётчик отделён от дешёвого', () => {
  it('ключ у него другой', () => {
    expect(completedKey('brief:ip')).not.toBe('brief:ip')
  })

  it('и он выводится из дешёвого, а не собирается заново', () => {
    expect(completedKey('brief:ip')).toContain('brief:ip')
  })
})

describe('отказ', () => {
  it('считает остаток окна в секундах', () => {
    expect(refusal(1_000_000 + 30_000, 1_000_000).retryAfterSeconds).toBe(30)
  })

  /*
   * «Попробуйте через ноль секунд» — не ответ. Момент открытия окна может
   * оказаться в прошлом на доли секунды, и округление вниз давало бы ноль.
   */
  it('никогда не отвечает нулём', () => {
    expect(refusal(1_000_000, 1_000_000).retryAfterSeconds).toBe(1)
    expect(refusal(999_000, 1_000_000).retryAfterSeconds).toBe(1)
  })

  it('отказ есть отказ', () => {
    expect(refusal(2_000_000, 1_000_000).allowed).toBe(false)
    expect(PASSED.allowed).toBe(true)
  })

  it('говорит человеку, когда возвращаться', () => {
    expect(retryMessage(30)).toContain('a minute')
    expect(retryMessage(600)).toContain('10 min')
  })
})
