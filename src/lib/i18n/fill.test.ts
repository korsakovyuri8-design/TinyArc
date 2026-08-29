import { describe, expect, it } from 'vitest'
import { fill } from './fill'
import { en } from './en'

describe('подстановка во фразу', () => {
  it('подставляет по имени', () => {
    expect(fill('Счёт на {amount} {currency}', { amount: 4000, currency: 'EUR' })).toBe(
      'Счёт на 4000 EUR',
    )
  })

  /*
   * Ошибка, ради которой это и написано.
   *
   * Местом подстановки была одиночная заглавная буква. По-русски работало; в
   * английском переводе первая же `A` нашлась в слове «An», и письмо ушло со
   * строкой «15548n invoice has been issued for the “EURoncept” stage».
   */
  it('не трогает буквы обычного текста', () => {
    const template = 'An invoice for the {stage} stage: {amount} {currency}.'

    expect(fill(template, { stage: 'Concept', amount: 15548, currency: 'EUR' })).toBe(
      'An invoice for the Concept stage: 15548 EUR.',
    )
  })

  it('порядок подстановок ничего не меняет', () => {
    const template = '{a} и {b}'

    expect(fill(template, { a: '{b}', b: 'два' })).toBe('{b} и два')
  })

  it('незаполненное место остаётся видимым', () => {
    // Пустота на этом месте незаметна, а `{amount}` посреди письма виден.
    expect(fill('Счёт на {amount}', {})).toBe('Счёт на {amount}')
  })
})

/*
 * Перевод обязан сохранять места подстановки.
 *
 * Переводчик, потерявший `{amount}`, оставляет письмо без суммы — и заметить
 * это можно только получив такое письмо. Проверяется по всему словарю разом.
 */
describe('целостность словаря', () => {
  it('в переводе те же места подстановки, что в исходной фразе', () => {
    const holes = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

    for (const [russian, english] of Object.entries(en)) {
      expect(holes(english), `перевод «${russian.slice(0, 45)}…» потерял подстановку`).toEqual(
        holes(russian),
      )
    }
  })

  it('перевод не совпадает с исходной фразой', () => {
    // Строка, скопированная в словарь без перевода, выглядит переведённой и
    // проходит проверку на кириллицу, если фраза была латиницей.
    for (const [russian, english] of Object.entries(en)) {
      if (/[А-Яа-яЁё]/.test(russian)) {
        expect(english, `«${russian.slice(0, 45)}…» не переведена`).not.toBe(russian)
      }
    }
  })
})
