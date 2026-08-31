/**
 * Ограничение частоты на стороне сервера.
 *
 * Отдельно от `rate-limit.ts`: там политика — пороги, ключи и слова, — здесь
 * доступ к заголовкам запроса и сам счёт.
 *
 * Счёт идёт в базе, а не в памяти процесса. В памяти он жил честно и временно:
 * при двух инстансах окно у каждого своё, и предел молча умножается на их
 * число; перезапуск контейнера обнуляет накопленное, а на бесплатном плане
 * контейнер перезапускается сам. Ограничитель, который забывает попытки от
 * событий на нашей стороне, защищает ровно до первой выкладки.
 *
 * Счёт ведётся условным обновлением — тем же приёмом, что и переходы
 * состояния тикета. Прочитать окно, решить и записать нельзя: между чтением и
 * записью успевает второй запрос, и предел в этот момент перестаёт быть
 * пределом. Условие стоит внутри самой записи, и база отвечает не «сколько
 * там сейчас», а «удалось ли занять место».
 */

import { headers } from 'next/headers'
import { prisma } from './db'
import {
  LIMITS,
  PASSED,
  completedKey,
  refusal,
  type Limit,
  type LimitName,
  type Verdict,
} from './rate-limit'

/** Раз в сколько обращений подметаем истёкшие окна. */
const SWEEP_EVERY = 500
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

/**
 * Занять место в окне.
 *
 * Три попытки записи, и ни одна не читает состояние заранее:
 *
 * 1. Окно живо и место есть — увеличить счётчик. Условие «счётчик меньше
 *    предела» стоит в самой записи, поэтому два одновременных запроса не могут
 *    оба занять последнее место.
 * 2. Окно истекло — начать новое. Условие «время вышло» тоже в записи: если
 *    его успел начать другой, здесь изменится ноль строк, и мы вернёмся к
 *    первому случаю следующим запросом.
 * 3. Окна нет вовсе — создать. Гонку двух созданий ловит первичный ключ.
 *
 * Ничего не вышло — значит место занято: читаем момент открытия и отвечаем
 * человеку остатком.
 */
async function take(key: string, limit: number, windowMs: number): Promise<Verdict> {
  const now = new Date()

  const stepped = await prisma.rateWindow.updateMany({
    where: { key, resetAt: { gt: now }, count: { lt: limit } },
    data: { count: { increment: 1 } },
  })

  if (stepped.count === 1) return PASSED

  const restarted = await prisma.rateWindow.updateMany({
    where: { key, resetAt: { lte: now } },
    data: { count: 1, resetAt: new Date(now.getTime() + windowMs) },
  })

  if (restarted.count === 1) return PASSED

  try {
    await prisma.rateWindow.create({
      data: { key, count: 1, resetAt: new Date(now.getTime() + windowMs) },
    })

    return PASSED
  } catch {
    // Окно завёл другой запрос в этот же момент. Дальше оно общее.
  }

  const window = await prisma.rateWindow.findUnique({
    where: { key },
    select: { resetAt: true },
  })

  if (!window) return PASSED

  return refusal(window.resetAt.getTime(), now.getTime())
}

/** Сколько дорогих отправок разрешено, если у предела есть второй счётчик. */
function expensive(limit: Limit): number | undefined {
  return 'completed' in limit ? (limit as { completed?: number }).completed : undefined
}

/**
 * Подмести истёкшие окна.
 *
 * Строка окна живёт до следующей попытки того же отправителя, а её может не
 * быть никогда: адреса не повторяются. Без подметания таблица растёт числом
 * посетителей за всю жизнь продукта, ничего при этом не защищая.
 */
async function sweep(): Promise<void> {
  await prisma.rateWindow
    .deleteMany({ where: { resetAt: { lt: new Date() } } })
    .catch(() => undefined)
}

export async function allow(name: LimitName): Promise<Verdict> {
  calls += 1
  if (calls % SWEEP_EVERY === 0) await sweep()

  const key = `${name}:${await origin()}`
  const limit = LIMITS[name]

  const attempt = await take(key, limit.limit, limit.windowMs)
  if (!attempt.allowed) return attempt

  /*
   * Дорогой счётчик только проверяется, но не тратится.
   *
   * Тратит его `spend`, и только когда работа действительно началась.
   * Отклонённая форма стоит одного разбора схемы, а принятая — прогона по
   * всему пулу; списывать за них одинаково значит наказывать человека за
   * опечатку в поле.
   */
  const completed = expensive(limit)
  if (completed === undefined) return attempt

  const window = await prisma.rateWindow.findUnique({
    where: { key: completedKey(key) },
    select: { count: true, resetAt: true },
  })

  const now = Date.now()

  if (window && now < window.resetAt.getTime() && window.count >= completed) {
    return refusal(window.resetAt.getTime(), now)
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
  await prisma.rateWindow
    .deleteMany({ where: { key: `${name}:${await origin()}` } })
    .catch(() => undefined)
}

/**
 * Списать дорогую отправку.
 *
 * Зовётся после того, как форма прошла проверки и работа пошла. До этого
 * момента отправка ничего не стоит, и брать за неё из бюджета нечестно.
 */
export async function spend(name: LimitName): Promise<void> {
  const limit = LIMITS[name]
  const completed = expensive(limit)
  if (completed === undefined) return

  await take(completedKey(`${name}:${await origin()}`), completed, limit.windowMs)
}
