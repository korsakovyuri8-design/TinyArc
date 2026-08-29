/**
 * Почта.
 *
 * Режим задаётся окружением и виден из конфигурации, а не выясняется на
 * человеке. Неизвестное значение роняет приложение, а не откатывается на
 * заглушку молча: «кажется, письма уходят» — худшее из состояний для канала,
 * которым выдаётся доступ.
 */

import { absolute, siteUrl } from '../site'
import { translate } from '../i18n/dict'
import { fill } from '../i18n/fill'
import { localePath, type Locale } from '../i18n/locale'
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
  locale: Locale,
): Promise<void> {
  const t = (text: string) => translate(text, locale)
  const where = who === 'client' ? t('кабинет проекта') : t('доску работ')

  await mailer().send({
    to,
    subject: `TinyArc Cloud Bureau — ${t('ключ доступа')}`,
    body: [
      `${t('Ключ доступа:')} ${key}`,
      '',
      fill(t('Введите его на {url}, чтобы открыть {where}.'), {
        url: absolute(localePath('/enter', locale)),
        where,
      }),
      t('Ключ заменяет пароль — не пересылайте его.'),
      '',
      'TinyArc Cloud Bureau',
      siteUrl(),
    ].join('\n'),
  })
}

/**
 * Напоминание ключа: письмо тому, кто его потерял.
 *
 * Ключ заменяет пароль, а пароль здесь не восстанавливают, потому что его нет.
 * Значит, потерянное письмо — это потерянный кабинет навсегда, если не сказать
 * человеку тот же ключ ещё раз тем же каналом.
 *
 * Новый ключ не выдаётся намеренно. Смена ключа при каждой забывчивости
 * означала бы, что старое письмо перестаёт работать, — а оно у человека,
 * возможно, есть, просто не нашлось за минуту.
 *
 * Строки письма приходят готовыми: что именно числится за адресом, решает
 * `remindKeys`, и решает это по правилу «ключ, который не работает, называть
 * незачем».
 */
export async function sendKeyReminder(
  to: string,
  lines: string[],
  locale: Locale,
): Promise<void> {
  const t = (text: string) => translate(text, locale)

  await mailer().send({
    to,
    subject: `TinyArc Cloud Bureau — ${t('ключ доступа')}`,
    body: [
      t('Вы попросили напомнить ключ. За этим адресом числится:'),
      '',
      ...lines,
      '',
      fill(t('Вход: {url}'), { url: absolute(localePath('/enter', locale)) }),
      t('Ключ заменяет пароль — не пересылайте его.'),
      '',
      t('Если ключ не просили вы — письмо можно не читать: по нему ничего не произошло.'),
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
