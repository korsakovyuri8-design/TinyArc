/**
 * Ограничение частоты на стороне сервера.
 *
 * Отдельно от src/lib/rate-limit.ts: там чистая логика и тесты, здесь — доступ
 * к заголовкам запроса и счётчик процесса.
 */

import { headers } from 'next/headers'
import { LIMITS, hit, sweep, type Bucket, type LimitName, type Verdict } from './rate-limit'

const store = new Map<string, Bucket>()

/** Раз в сколько обращений подчищаем истёкшие окна. */
const SWEEP_EVERY = 200
let calls = 0

/**
 * Кто отправил запрос.
 *
 * За обратным прокси настоящий адрес приходит заголовком. Заголовок можно
 * подделать, поэтому ограничение частоты — это защита от нагрузки и перебора,
 * а не от целенаправленной атаки: последнюю останавливают уровнем ниже, на
 * периметре хостинга.
 */
async function origin(): Promise<string> {
  const jar = await headers()

  const forwarded = jar.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || jar.get('x-real-ip')?.trim() || 'unknown'
}

export async function allow(name: LimitName): Promise<Verdict> {
  const now = Date.now()

  calls += 1
  if (calls % SWEEP_EVERY === 0) sweep(store, now)

  return hit(store, `${name}:${await origin()}`, LIMITS[name], now)
}
