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

import { fill } from './i18n/fill'

export type Bucket = { count: number; resetAt: number }

export type Verdict = { allowed: boolean; retryAfterSeconds: number }

export type Limit = {
  /** Сколько отправок формы вообще, включая отклонённые проверками. */
  limit: number
  windowMs: number
  /**
   * Сколько отправок, дошедших до дорогой работы.
   *
   * Отделено от `limit` потому, что цена у них разная. Отклонённая форма стоит
   * одного разбора схемы; принятая — прогона по всему пулу и сотен строк в
   * базе. Пока это был один счётчик, человек с двумя опечатками в брифе
   * упирался в предел на третьей попытке и слышал «слишком часто» вместо
   * «поправьте поле».
   */
  completed?: number
}

const HOUR = 60 * 60 * 1000
const MINUTE = 60 * 1000

/**
 * Пороги подобраны по цене запроса, а не по «ощущению спама».
 *
 * Бриф и заявка дороги: прогон по пулу и запись сотен строк. Вход по ключу
 * дёшев, но это подбор ключа. Вход в панель — подбор пароля.
 */
export const LIMITS = {
  brief: { limit: 20, windowMs: HOUR, completed: 3 },
  application: { limit: 20, windowMs: HOUR, completed: 3 },
  enter: { limit: 10, windowMs: 15 * MINUTE },
  // Заказчик уже вошёл по ключу, поэтому предел мягкий: он защищает от
  // случайного двойного нажатия и от заваливания панели, а не от чужака.
  clientMessage: { limit: 10, windowMs: HOUR },
  opsLogin: { limit: 5, windowMs: 15 * MINUTE },
  /*
   * Напоминание ключа. Дёшево для нас и заметно для человека, которому оно
   * приходит: форма отправляет письмо на чужой адрес по одному нажатию.
   * Поэтому дорогой счётчик считает именно ушедшие письма, а не попытки.
   */
  recover: { limit: 10, windowMs: HOUR, completed: 3 },
} as const satisfies Record<string, Limit>

export type LimitName = keyof typeof LIMITS

/**
 * Ключ дорогого счётчика.
 *
 * Отдельное окно, а не поле в том же ведре: у дешёвых попыток и дорогих
 * прогонов разные пределы, и складывать их в один счётчик означало бы снова
 * наказывать за опечатку.
 */
export function completedKey(key: string): string {
  return `${key}#completed`
}

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

/**
 * «Слишком часто» на языке того, кто это читает.
 *
 * Переводчик приходит аргументом, а не берётся здесь: модуль чистый и о
 * запросе ничего не знает. По умолчанию — тождество, то есть исходный русский:
 * вызывающий, которому язык не важен, ничего не передаёт и получает прежнее.
 */
export function retryMessage(
  retryAfterSeconds: number,
  t: (text: string) => string = (text) => text,
): string {
  const minutes = Math.ceil(retryAfterSeconds / 60)

  return minutes <= 1
    ? t('Слишком часто. Попробуйте через минуту.')
    : fill(t('Слишком часто. Попробуйте через {minutes} мин.'), { minutes })
}
