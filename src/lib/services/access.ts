/**
 * Напоминание ключа доступа.
 *
 * Ключ здесь — это учётные данные целиком: пароля нет, регистрации нет, и
 * восстанавливать нечего. Значит, письмо, потерянное в почте, до сих пор
 * означало потерянный кабинет навсегда — при том что человек, оставивший
 * бриф, никуда не делся и его проект идёт.
 *
 * Два правила, ради которых это отдельный модуль, а не десять строк в форме:
 *
 * 1. Называется только тот ключ, который работает. Ключ заявки, ещё не
 *    прошедшей разбор, существует, но входа не даёт; прислать его значит
 *    отправить человека биться о дверь и решить, что его не пускают.
 * 2. Ответ формы одинаков всегда. Форма, отвечающая «такого адреса нет»,
 *    отвечает на другой вопрос — «есть ли у вас такой заказчик», — и отвечает
 *    его кому угодно.
 */

import { prisma } from '../db'
import { sendKeyReminder } from '../mail'
import { fill } from '../fill'

/** Статусы специалиста, при которых ключ действительно открывает доску. */
const KEY_WORKS = new Set(['active', 'invited'])

export type KeyOwner = {
  projects: { title: string; clientKey: string }[]
  specialist: { accessKey: string; status: string } | null
}

/**
 * Строки письма: что числится за адресом.
 *
 * Чистая функция — её и стоит проверять. Запрос к базе тривиален, а вот
 * правило «ключ, который не работает, не называем» ломается молча и заметно
 * только тому, кто получил письмо и не смог войти.
 */
export function keyLines(owner: KeyOwner): string[] {
  const lines: string[] = []

  for (const project of owner.projects) {
    lines.push(
      fill('Project “{title}” — key {key}', {
        title: project.title,
        key: project.clientKey,
      }),
    )
  }

  if (owner.specialist && KEY_WORKS.has(owner.specialist.status)) {
    lines.push(fill('Work board — key {key}', { key: owner.specialist.accessKey }))
  }

  return lines
}

/**
 * Напомнить ключи по адресу почты.
 *
 * Ничего не возвращает и ни о чём не сообщает вызывающему: результат — это
 * письмо или его отсутствие, и знать об этом форме не нужно. Так проще не
 * ошибиться потом, дописывая в неё сообщение.
 *
 * Письмо не уходит, если называть нечего: сообщение «за этим адресом ничего
 * не числится» — это тот же ответ на вопрос о чужом адресе, только доставленный
 * почтой.
 */
export async function remindKeys(email: string): Promise<void> {
  const address = email.trim().toLowerCase()
  if (!address) return

  const [projects, specialist] = await Promise.all([
    prisma.project.findMany({
      where: { clientEmail: address },
      select: { title: true, clientKey: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.specialist.findFirst({
      where: { email: address },
      select: { accessKey: true, status: true },
    }),
  ])

  const lines = keyLines({ projects, specialist })
  if (lines.length === 0) return

  await sendKeyReminder(address, lines)
}
