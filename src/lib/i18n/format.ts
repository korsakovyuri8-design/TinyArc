/**
 * Числа и даты на языке страницы.
 *
 * Отдельный модуль, потому что забыть здесь дешевле всего: непереведённая
 * фраза видна глазом, а `29.08.2026` в английском кабинете выглядит
 * правильно ровно до дня, когда человек прочитает `08.09` как 8 сентября,
 * а не 9 августа. Разница в один день на сроке задачи — это сорванный срок.
 *
 * Английский берётся британским: `en-GB` даёт день-месяц-год, привычный и
 * в Черногории, и в Сербии, и в Греции, — в отличие от `en-US`, где порядок
 * обратный и та же дата читается наоборот.
 */

import type { Locale } from './locale'

const INTL: Record<Locale, string> = { ru: 'ru-RU', en: 'en-GB' }

export function dateTime(value: Date, locale: Locale): string {
  return value.toLocaleString(INTL[locale], { dateStyle: 'short', timeStyle: 'short' })
}

export function date(value: Date, locale: Locale): string {
  return value.toLocaleDateString(INTL[locale], { dateStyle: 'short' })
}

/** Сумма без валюты: символ ставит вызывающий, он же знает валюту счёта. */
export function amount(value: number, locale: Locale): string {
  return value.toLocaleString(INTL[locale])
}
