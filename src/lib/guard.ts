/**
 * Ограничение частоты на стороне сервера.
 *
 * Отдельно от src/lib/rate-limit.ts: там чистая логика и тесты, здесь — доступ
 * к заголовкам запроса и счётчик процесса.
 */

import { headers } from 'next/headers'
import {
  LIMITS,
  completedKey,
  hit,
  sweep,
  type Bucket,
  type LimitName,
  type Verdict,
} from './rate-limit'

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

  const key = `${name}:${await origin()}`
  const limit = LIMITS[name]

  const attempt = hit(store, key, limit, now)
  if (!attempt.allowed) return attempt

  /*
   * Дорогой счётчик только проверяется, но не тратится.
   *
   * Тратит его `spend`, и только когда работа действительно началась.
   * Отклонённая форма стоит одного разбора схемы, а принятая — прогона по
   * всему пулу; списывать за них одинаково значит наказывать человека за
   * опечатку в поле.
   */
  const completed = 'completed' in limit ? (limit as { completed?: number }).completed : undefined
  if (completed === undefined) return attempt

  const bucket = store.get(completedKey(key))
  if (bucket && now < bucket.resetAt && bucket.count >= completed) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    }
  }

  return attempt
}

/**
 * Забыть накопленные попытки.
 *
 * Зовётся после успешного действия. Ограничитель на пароле защищает от
 * подбора, а подбор — это неудачные попытки: оператор, вошедший с пятого
 * устройства, атакой не является. Пока счётчик не сбрасывался успехом, его
 * выбирала обычная работа, и панель закрывалась перед своими.
 *
 * Защиту это не ослабляет: сбросить счётчик может только тот, кто знает
 * пароль, а тот, кто его подбирает, до сброса не доходит по определению.
 */
export async function forgive(name: LimitName): Promise<void> {
  store.delete(`${name}:${await origin()}`)
}

/**
 * Списать дорогую отправку.
 *
 * Зовётся после того, как форма прошла проверки и работа пошла. До этого
 * момента отправка ничего не стоит, и брать за неё из бюджета нечестно.
 */
export async function spend(name: LimitName): Promise<void> {
  const limit = LIMITS[name]
  const completed = 'completed' in limit ? (limit as { completed?: number }).completed : undefined
  if (completed === undefined) return

  hit(store, completedKey(`${name}:${await origin()}`), { ...limit, limit: completed }, Date.now())
}
