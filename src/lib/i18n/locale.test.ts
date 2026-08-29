import { describe, expect, it } from 'vitest'
import { DEFAULT_LOCALE, localePath, preferredLocale, splitLocale } from './locale'

describe('разбор пути', () => {
  it('снимает приставку языка', () => {
    expect(splitLocale('/en/brief')).toEqual({ locale: 'en', rest: '/brief' })
    expect(splitLocale('/en/legal/offer')).toEqual({ locale: 'en', rest: '/legal/offer' })
  })

  it('приставка без хвоста — это главная, а не пустой путь', () => {
    expect(splitLocale('/en')).toEqual({ locale: 'en', rest: '/' })
    expect(splitLocale('/en/')).toEqual({ locale: 'en', rest: '/' })
  })

  it('русский живёт по прежним адресам', () => {
    expect(splitLocale('/brief')).toEqual({ locale: DEFAULT_LOCALE, rest: '/brief' })
    expect(splitLocale('/')).toEqual({ locale: DEFAULT_LOCALE, rest: '/' })
  })

  /*
   * Приставка `/ru` не существует. Иначе у каждой страницы два адреса, оба
   * работают, и поисковый робот считает это дублем — а разделять их
   * каноническими ссылками ради ничего никто не станет.
   */
  it('не признаёт приставку языка по умолчанию', () => {
    expect(splitLocale('/ru/brief')).toEqual({ locale: DEFAULT_LOCALE, rest: '/ru/brief' })
  })

  it('не путает язык с обычным сегментом', () => {
    // Проект, тикет и ключ доступа начинаются с чего угодно.
    expect(splitLocale('/enter')).toEqual({ locale: DEFAULT_LOCALE, rest: '/enter' })
    expect(splitLocale('/energy')).toEqual({ locale: DEFAULT_LOCALE, rest: '/energy' })
  })
})

describe('сборка пути', () => {
  it('русский без приставки, английский с ней', () => {
    expect(localePath('/brief', 'ru')).toBe('/brief')
    expect(localePath('/brief', 'en')).toBe('/en/brief')
  })

  it('главная по-английски — это /en, а не /en/', () => {
    expect(localePath('/', 'en')).toBe('/en')
    expect(localePath('/', 'ru')).toBe('/')
  })

  it('разбор и сборка обратны друг другу', () => {
    for (const path of ['/', '/brief', '/legal/privacy', '/specialists/apply']) {
      for (const locale of ['ru', 'en'] as const) {
        expect(splitLocale(localePath(path, locale))).toEqual({ locale, rest: path })
      }
    }
  })
})

describe('язык браузера', () => {
  it('берёт первый понятный', () => {
    expect(preferredLocale('ru-RU,ru;q=0.9,en;q=0.8')).toBe('ru')
    expect(preferredLocale('en-GB,en;q=0.9')).toBe('en')
  })

  it('незнакомый язык ведёт к английскому, а не к русскому', () => {
    // Человек с немецким браузером скорее прочтёт английский. Русский
    // остаётся тем, кто его попросил или пришёл по прямой ссылке.
    expect(preferredLocale('de-DE,de;q=0.9')).toBe('en')
    expect(preferredLocale('sr-RS,sr;q=0.9')).toBe('en')
  })

  it('без заголовка — язык по умолчанию', () => {
    expect(preferredLocale(null)).toBe(DEFAULT_LOCALE)
    expect(preferredLocale('')).toBe(DEFAULT_LOCALE)
  })
})
