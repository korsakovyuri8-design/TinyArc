/**
 * Почта.
 *
 * Режим задаётся окружением и виден из конфигурации, а не выясняется на
 * человеке. Неизвестное значение роняет приложение, а не откатывается на
 * заглушку молча: «кажется, письма уходят» — худшее из состояний для канала,
 * которым выдаётся доступ.
 */

import { absolute, siteUrl } from '../site'
import { ResendMailer, configFromEnv } from './resend'
import { StubMailer } from './stub'
import type { Mailer } from './types'

export * from './types'
export { StubMailer } from './stub'

const globalForMail = globalThis as unknown as { bureauMailer?: Mailer }

function build(): Mailer {
  const mode = process.env.BUREAU_MAIL ?? 'stub'

  if (mode === 'stub') return new StubMailer()
  if (mode === 'resend') return new ResendMailer(configFromEnv(process.env))

  throw new Error(
    `BUREAU_MAIL="${mode}": такого режима нет. Доступны "stub" и "resend"; новый подключается адаптером рядом с ними.`,
  )
}

export function mailer(): Mailer {
  globalForMail.bureauMailer ??= build()
  return globalForMail.bureauMailer
}

/**
 * Письмо с ключом доступа.
 *
 * Ключ — это и есть учётные данные: регистрации как отдельного действия в
 * системе нет. Поэтому текст короткий и без ссылок, по которым можно кликнуть
 * не глядя.
 */
export async function sendAccessKey(
  to: string,
  who: 'client' | 'specialist',
  key: string,
): Promise<void> {
  const where = who === 'client' ? 'кабинет проекта' : 'доску работ'

  await mailer().send({
    to,
    subject: 'TinyArc Cloud Bureau — ключ доступа',
    body: [
      `Ключ доступа: ${key}`,
      '',
      `Введите его на ${absolute('/enter')}, чтобы открыть ${where}.`,
      'Ключ заменяет пароль — не пересылайте его.',
      '',
      'TinyArc Cloud Bureau',
      siteUrl(),
    ].join('\n'),
  })
}
