import { describe, expect, it } from 'vitest'
import { fill } from './fill'

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
