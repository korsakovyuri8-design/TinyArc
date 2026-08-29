/**
 * Числа и даты.
 *
 * Британский английский, а не американский: `en-GB` даёт день-месяц-год,
 * привычный и в Черногории, и в Сербии, и в Греции, — в отличие от `en-US`,
 * где порядок обратный и та же дата читается наоборот. Разница в один день на
 * сроке задачи — это сорванный срок, а не опечатка.
 */

const INTL = 'en-GB'

export function dateTime(value: Date): string {
  return value.toLocaleString(INTL, { dateStyle: 'short', timeStyle: 'short' })
}

export function date(value: Date): string {
  return value.toLocaleDateString(INTL, { dateStyle: 'short' })
}

/** Сумма без валюты: символ ставит вызывающий, он же знает валюту счёта. */
export function amount(value: number): string {
  return value.toLocaleString(INTL)
}
