/**
 * Список помощников — значением, а не только типом.
 *
 * Нужен проверке: тип до неё не доживает, а помощник, которого никто не
 * зовёт, ничем не отличается от работающего — он есть в интерфейсе, покрыт
 * заглушкой и проходит типы.
 */
export const ASSISTANT_METHODS = [
  'draftSpec',
  'summariseConflict',
  'parseBrief',
  'proposePortfolioRating',
  'checkCompleteness',
  'draftRequest',
  'draftNudge',
  'planQueue',
] as const

export type AssistantMethod = (typeof ASSISTANT_METHODS)[number]
