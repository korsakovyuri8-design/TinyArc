/**
 * Помощники бюро.
 *
 * Граница проведена концептом (п.12а) и здесь соблюдается буквально: модель
 * готовит текст, который человек читает и правит, и не производит ничего, что
 * уходит клиенту или в комплект документации.
 *
 * Что сюда не попадает и не попадёт:
 *
 *  · отбор специалистов — он взвешенный и объяснимый, и подмена его моделью
 *    убила бы разбор балла, на котором держится доверие клиента (п.9);
 *  · приёмка работы — принимает бюро, и это ответственность, а не операция;
 *  · проектные разделы — чертежи и расчёты делают люди (п.12а).
 */

export type SpecInput = {
  projectTitle: string
  typology: string
  storeys: number
  areaSqm: number
  jurisdiction: string
  terrain: string
  gridConnection: string
  materialSystem: string
  stage: string
  discipline: string
  /** Требуемые специализации роли — постановка должна их учитывать. */
  specializations: string[]
  ticketTitle: string
  /** Выбранное клиентом направление, если оно есть. */
  direction: { title: string; summary: string } | null
  /** Что пришло на вход от предшественников по графу. */
  inboundArtifacts: string[]
}

export type SpecDraft = {
  /** Черновик постановки. Бюро правит и сохраняет — сам он никуда не уходит. */
  spec: string
  /** Что должно оказаться на выходе. Проверяется человеком при приёмке. */
  checklist: string[]
}

export type ConflictInput = {
  ticketTitle: string
  conflictNote: string
  comments: { author: 'bureau' | 'specialist'; body: string }[]
}

export type ConflictSummary = {
  /** Позиции сторон, по одной строке. Без оценки, кто прав. */
  positions: string[]
  /** Вопрос, на который арбитру нужно ответить. */
  question: string
}

export interface Assistant {
  readonly mode: string
  draftSpec(input: SpecInput): Promise<SpecDraft>
  summariseConflict(input: ConflictInput): Promise<ConflictSummary>
}
