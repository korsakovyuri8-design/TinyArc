import type { Letter, Mailer } from './types'

export type ResendConfig = { apiKey: string; from: string }

/**
 * Отправка через Resend по HTTP.
 *
 * Провайдер выбран за отсутствие зависимости: обычный fetch вместо SMTP-клиента
 * и его сборки в образе. Заменяется адаптером рядом — интерфейс Mailer один.
 */
export class ResendMailer implements Mailer {
  readonly mode = 'resend'

  constructor(private readonly config: ResendConfig) {}

  async send(letter: Letter): Promise<void> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.config.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: this.config.from,
        to: [letter.to],
        subject: letter.subject,
        text: letter.body,
      }),
    })

    if (!response.ok) {
      // Текст ответа провайдера наружу не отдаём: в нём бывает адрес получателя.
      throw new Error(`Письмо не отправлено: провайдер ответил ${response.status}.`)
    }
  }
}

export function configFromEnv(env: Record<string, string | undefined>): ResendConfig {
  const apiKey = env.RESEND_API_KEY?.trim()
  const from = env.BUREAU_MAIL_FROM?.trim()

  // Настройка проверяется на старте: недонастроенная почта выглядит работающей
  // ровно до человека, которому нужен ключ доступа.
  if (!apiKey) throw new Error('BUREAU_MAIL="resend": не задан RESEND_API_KEY.')
  if (!from) throw new Error('BUREAU_MAIL="resend": не задан BUREAU_MAIL_FROM.')

  return { apiKey, from }
}
