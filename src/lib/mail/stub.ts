import type { Letter, Mailer } from './types'

/**
 * Заглушка: пишет письмо в лог и никуда не отправляет.
 *
 * Она не притворяется работающей почтой. Ключ доступа при этом показывается
 * человеку на экране — именно поэтому режим «письма не уходят» остаётся
 * пригодным для пилота: доступ не теряется, просто выдаётся вживую.
 */
export class StubMailer implements Mailer {
  readonly mode = 'stub'
  /** Отправленное за время жизни процесса. Нужно панели бюро и тестам. */
  readonly outbox: Letter[] = []

  async send(letter: Letter): Promise<void> {
    this.outbox.push(letter)
    console.info(`[почта:stub] ${letter.to} — ${letter.subject}\n${letter.body}\n`)
  }
}
