/**
 * Помощники бюро.
 *
 * Граница проведена концептом (п.12а) и здесь соблюдается буквально: модель
 * готовит текст, который человек читает и правит, и не производит ничего, что
 * уходит клиенту или в комплект документации.
 *
 * Что сюда не попадает:
 *
 *  · сам отбор — формула взвешенная и объяснимая, и подмена её моделью убила
 *    бы разбор балла, на котором держится ответ клиенту «почему не я выбираю»
 *    (п.9). Рейтинг портфолио при этом помощник предлагать может: это одно
 *    число на входе, которое подтверждает человек, и объяснимость цела;
 *  · нажатие «принять» — это ответственность, а не операция. Проверить
 *    комплектность перед ним помощник может и должен;
 *  · проектные разделы — чертежи, нагрузки и разводку делают люди (п.12а).
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

/** Свободный текст клиента → черновик полей брифа. */
export type BriefInput = { text: string }

export type BriefFields = {
  typology?: string
  storeys?: number
  areaSqm?: number
  jurisdiction?: string
  terrain?: string
  gridConnection?: string
  materialSystem?: string
  targetStage?: string
}

export type BriefParse = {
  fields: BriefFields
  /** Чего в тексте не было. Клиент дозаполняет сам — додумывать нельзя. */
  missing: string[]
  notes: string
}

export type PortfolioInput = {
  displayName: string
  portfolioUrl: string
  disciplines: string[]
  specializations: string[]
  jurisdictions: string[]
  maxStoreys: number
  works: { title: string; kind: string; roleDescription: string; areaSqm?: number | null }[]
}

export type PortfolioProposal = {
  /** Предложение, 0–10. Ставит его в базу человек, а не помощник. */
  rating: number
  /** На чём основано. Без этого предложение непроверяемо. */
  reasoning: string
  /** Чего в портфолио не хватает, чтобы судить увереннее. */
  gaps: string[]
}

export type CompletenessInput = {
  ticketTitle: string
  spec: string
  discipline: string
  stage: string
  artifacts: { name: string; kind: string }[]
}

export type CompletenessCheck = {
  /** Чего не хватает по постановке. Пусто — замечаний нет. */
  missing: string[]
  /** Что стоит посмотреть глазами перед приёмкой. */
  worthChecking: string[]
}

export type RequestDraftInput = {
  fromDiscipline: string
  toDiscipline: string
  ticketTitle: string
  /** Как специалист описал проблему своими словами. */
  rough: string
}

export type RequestDraft = {
  title: string
  body: string
}

export interface Assistant {
  readonly mode: string
  draftSpec(input: SpecInput): Promise<SpecDraft>
  summariseConflict(input: ConflictInput): Promise<ConflictSummary>
  /** Разбор свободного описания клиента в поля брифа. */
  parseBrief(input: BriefInput): Promise<BriefParse>
  /** Предложение рейтинга портфолио для разбора заявки. Решает человек. */
  proposePortfolioRating(input: PortfolioInput): Promise<PortfolioProposal>
  /** Что не сходится с постановкой до того, как бюро нажало «принять». */
  checkCompleteness(input: CompletenessInput): Promise<CompletenessCheck>
  /** Черновик запроса смежнику: адресат должен понять его без автора. */
  draftRequest(input: RequestDraftInput): Promise<RequestDraft>
}
