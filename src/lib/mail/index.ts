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

/**
 * Приглашение в пул из базы бюро.
 *
 * Письмо не притворяется, что человек подавал заявку: он её не подавал, его
 * позвали. Поэтому здесь сказано, кто зовёт и что от него нужно, — и сказано
 * до ключа, а не после.
 *
 * Ключ идёт в том же письме. Отдельного пароля и регистрации нет: лишний шаг
 * между «мне написали» и «я в системе» стоит половины откликов.
 */
export async function sendInvitation(
  to: string,
  displayName: string,
  key: string,
): Promise<void> {
  await mailer().send({
    to,
    subject: 'TinyArc Cloud Bureau — приглашение в пул специалистов',
    body: [
      `${displayName}, здравствуйте.`,
      '',
      'TinyArc Cloud Bureau собирает пул специалистов на проекты в Черногории,',
      'Сербии и Греции — здания до пяти этажей. Мы ведём проект целиком и',
      'подбираем под него команду расчётом, а не по знакомству.',
      '',
      'Чтобы участвовать в отборе, нужно дозаполнить профиль: дисциплина и',
      'специализация, юрисдикции, пакет, языки, часовой пояс и свободная',
      'ёмкость. Без этих полей алгоритм вас не увидит — не потому, что вы не',
      'подходите, а потому, что ему не с чем работать.',
      '',
      `Ключ доступа: ${key}`,
      `Профиль: ${absolute('/enter')}`,
      '',
      'Ключ заменяет пароль — не пересылайте его.',
      '',
      'TinyArc Cloud Bureau',
      siteUrl(),
    ].join('\n'),
  })
}
