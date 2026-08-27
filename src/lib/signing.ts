/**
 * Подпись значения cookie.
 *
 * Вынесено из session.ts, чтобы проверяться тестом: session.ts тянет за собой
 * заголовки запроса и базу, а подпись — это чистая функция от строки и секрета.
 *
 * Зачем подпись вообще: значение cookie — это идентификатор, а серверной
 * сессии, которую можно отозвать, у нас нет. Без подписи любой, кто узнал чужой
 * идентификатор — из адреса страницы, из лога, из переписки, — ставит куку
 * руками и заходит.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

function signature(value: string, key: string): string {
  return createHmac('sha256', key).update(value).digest('base64url')
}

export function sign(value: string, key: string): string {
  return `${value}.${signature(value, key)}`
}

/** Значение без подписи, либо null, если подпись не сходится. */
export function unsign(signed: string | undefined | null, key: string): string | null {
  if (!signed) return null

  const cut = signed.lastIndexOf('.')
  if (cut <= 0) return null

  const value = signed.slice(0, cut)
  const provided = Buffer.from(signed.slice(cut + 1))
  const expected = Buffer.from(signature(value, key))

  // Длины сравниваем отдельно: timingSafeEqual на разных длинах бросает.
  if (provided.length !== expected.length) return null

  return timingSafeEqual(provided, expected) ? value : null
}

/** Сравнение секретов постоянного времени: разница в скорости — подсказка. */
export function secretsMatch(given: string, expected: string): boolean {
  const a = Buffer.from(given)
  const b = Buffer.from(expected)

  return a.length === b.length && timingSafeEqual(a, b)
}
