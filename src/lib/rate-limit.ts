/**
 * Ограничение частоты для публичных форм.
 *
 * Нужно не от «спама» в общем смысле: одна отправка брифа запускает прогон по
 * всему пулу и пишет сотни строк. Без ограничения публичная форма — это
 * усилитель, где один запрос стоит в сотни раз дороже, чем обходится
 * отправителю.
 *
 * Счётчик в памяти процесса. Для пилота этого достаточно и честно: при
 * нескольких инстансах окно считается у каждого своё. Замена — общий счётчик в
 * базе или Redis; интерфейс модуля от этого не меняется.
 */

export type Bucket = { count: number; resetAt: number }

export type Verdict = { allowed: boolean; retryAfterSeconds: number }

export type Limit = { limit: number; windowMs: number }

const HOUR = 60 * 60 * 1000
const MINUTE = 60 * 1000

/**
 * Пороги подобраны по цене запроса, а не по «ощущению спама».
 *
 * Бриф и заявка дороги: прогон по пулу и запись сотен строк. Вход по ключу
 * дёшев, но это подбор ключа. Вход в панель — подбор пароля.
 */
export const LIMITS = {
  brief: { limit: 3, windowMs: HOUR },
  application: { limit: 3, windowMs: HOUR },
  enter: { limit: 10, windowMs: 15 * MINUTE },
  // Заказчик уже вошёл по ключу, поэтому предел мягкий: он защищает от
  // случайного двойного нажатия и от заваливания панели, а не от чужака.
  clientMessage: { limit: 10, windowMs: HOUR },
  opsLogin: { limit: 5, windowMs: 15 * MINUTE },
} as const satisfies Record<string, Limit>

export type LimitName = keyof typeof LIMITS

/** Чистая функция: состояние приходит аргументом, время тоже. */
export function hit(
  store: Map<string, Bucket>,
  key: string,
  { limit, windowMs }: Limit,
  now: number,
): Verdict {
  const bucket = store.get(key)

  if (!bucket || now >= bucket.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfterSeconds: 0 }
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    }
  }

  bucket.count += 1
  return { allowed: true, retryAfterSeconds: 0 }
}

/** Убирает истёкшие окна, чтобы карта не росла бесконечно. */
export function sweep(store: Map<string, Bucket>, now: number): void {
  for (const [key, bucket] of store) {
    if (now >= bucket.resetAt) store.delete(key)
  }
}

export function retryMessage(retryAfterSeconds: number): string {
  const minutes = Math.ceil(retryAfterSeconds / 60)

  return minutes <= 1
    ? 'Слишком часто. Попробуйте через минуту.'
    : `Слишком часто. Попробуйте через ${minutes} мин.`
}
