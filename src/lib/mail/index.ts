/**
 * Почта.
 *
 * Режим задаётся окружением и виден из конфигурации, а не выясняется на
 * человеке. Неизвестное значение роняет приложение, а не откатывается на
 * заглушку молча: «кажется, письма уходят» — худшее из состояний для канала,
 * которым выдаётся доступ.
 */

import { absolute, siteUrl } from '../site'
import { fill } from '../fill'
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
  const where = who === 'client' ? 'the project cabinet' : 'the work board'

  await mailer().send({
    to,
    subject: 'TinyArc Cloud Bureau — access key',
    body: [
      `Access key: ${key}`,
      '',
      fill('Enter it at {url} to open {where}.', {
        url: absolute('/enter'),
        where,
      }),
      'The key stands in for a password — do not forward it.',
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
export async function sendKeyReminder(to: string, lines: string[]): Promise<void> {

  await mailer().send({
    to,
    subject: 'TinyArc Cloud Bureau — access key',
    body: [
      'You asked us to remind you of your key. This address holds:',
      '',
      ...lines,
      '',
      fill('Sign in: {url}', { url: absolute('/enter') }),
      'The key stands in for a password — do not forward it.',
      '',
      'If you did not ask for this, there is nothing to do: nothing happened on your account.',
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
    subject: 'TinyArc Cloud Bureau — an invitation to the specialist pool',
    body: [
      `${displayName}, hello.`,
      '',
      'TinyArc Cloud Bureau is assembling a pool of specialists for projects in',
      'Montenegro, Serbia and Greece — buildings up to five storeys. We run the',
      'project end to end and pick the team for it by computation, not by acquaintance.',
      '',
      'To take part in selection you need to fill in your profile: discipline and',
      'specialisation, jurisdictions, software suite, languages, time zone and free',
      'capacity. Without those fields the algorithm will not see you — not because',
      'you do not fit, but because it has nothing to work with.',
      '',
      `Access key: ${key}`,
      `Profile: ${absolute('/enter')}`,
      '',
      'The key stands in for a password — do not forward it.',
      '',
      'TinyArc Cloud Bureau',
      siteUrl(),
    ].join('\n'),
  })
}
