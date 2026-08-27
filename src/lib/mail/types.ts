export type Letter = {
  to: string
  subject: string
  /** Простой текст. Вёрстка писем — работа не этого этапа. */
  body: string
}

export interface Mailer {
  readonly mode: string
  send(letter: Letter): Promise<void>
}
