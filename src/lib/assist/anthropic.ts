import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import type {
  Assistant,
  BriefInput,
  BriefParse,
  CompletenessCheck,
  CompletenessInput,
  ConflictInput,
  ConflictSummary,
  PortfolioInput,
  PortfolioProposal,
  RequestDraft,
  RequestDraftInput,
  SpecDraft,
  SpecInput,
} from './types'

const MODEL = 'claude-opus-5'

/**
 * Общая рамка для обоих помощников.
 *
 * Здесь же проведена граница ответственности: модель готовит текст для
 * человека и не решает. Это не вежливая формулировка — от неё зависит, чем
 * окажется результат: черновиком, который бюро правит, или решением, которое
 * бюро подписывает не читая.
 */
const SYSTEM = [
  'Ты помогаешь архитектурному бюро готовить тексты для внутренней работы.',
  'Здания до пяти этажей в Черногории, Сербии и Греции.',
  '',
  'Границы, которые не нарушаются:',
  '— ты не проектируешь: не назначаешь сечения, нагрузки, диаметры и марки;',
  '— ты не принимаешь работу и не оцениваешь людей;',
  '— результат — черновик, который правит человек, а не готовый документ.',
  '',
  'Пиши по-русски, кратко и по делу, без вводных и без похвал.',
  'Если данных не хватает, так и напиши — не додумывай факты об объекте.',
].join('\n')

const SpecSchema = z.object({
  spec: z
    .string()
    .describe('Постановка задачи: что сделать, в каких границах, что передать дальше.'),
  checklist: z
    .array(z.string())
    .describe('Что должно оказаться на выходе. Проверяемые пункты, не пожелания.'),
})

const BriefSchema = z.object({
  fields: z
    .object({
      typology: z.enum(['villa', 'townhouse', 'multi_family', 'mixed_use']).optional(),
      storeys: z.number().int().optional(),
      areaSqm: z.number().int().optional(),
      jurisdiction: z.enum(['ME', 'RS', 'GR']).optional(),
      terrain: z.enum(['flat', 'slope', 'flood_prone']).optional(),
      gridConnection: z.enum(['grid', 'off_grid']).optional(),
      materialSystem: z.enum(['concrete', 'masonry', 'timber', 'steel', 'hybrid']).optional(),
      targetStage: z.enum(['concept', 'permit', 'tender', 'construction']).optional(),
    })
    .describe('Только то, что прямо сказано в тексте. Не выводить и не додумывать.'),
  missing: z.array(z.string()).describe('Поля, которых в тексте нет. По-русски, коротко.'),
  notes: z.string().describe('Что ещё сказал клиент про участок и задачу.'),
})

const PortfolioSchema = z.object({
  rating: z.number().min(0).max(10).describe('Предложение рейтинга портфолио, 0–10.'),
  reasoning: z.string().describe('На чём основано. Проверяемо по содержимому профиля.'),
  gaps: z.array(z.string()).describe('Чего в портфолио не хватает, чтобы судить увереннее.'),
})

const CompletenessSchema = z.object({
  missing: z.array(z.string()).describe('Чего не хватает по постановке. Пусто — замечаний нет.'),
  worthChecking: z.array(z.string()).describe('Что посмотреть глазами перед приёмкой.'),
})

const RequestSchema = z.object({
  title: z.string().describe('Короткое название запроса, до семидесяти знаков.'),
  body: z.string().describe('Запрос так, чтобы адресат понял его без автора.'),
})

const ConflictSchema = z.object({
  positions: z
    .array(z.string())
    .describe('Позиции сторон, по одной строке на сторону. Без указания, кто прав.'),
  question: z.string().describe('Один вопрос, на который должен ответить арбитр.'),
})

export class AnthropicAssistant implements Assistant {
  readonly mode = 'anthropic'
  private readonly client: Anthropic

  constructor() {
    // Ключ resolve'ится SDK из окружения; проверка наличия — в preflight.
    this.client = new Anthropic()
  }

  async draftSpec(input: SpecInput): Promise<SpecDraft> {
    const facts = [
      `Проект: ${input.projectTitle}`,
      `Объект: ${input.typology}, ${input.storeys} эт., ${input.areaSqm} м², ${input.jurisdiction}`,
      `Участок: ${input.terrain}; сети: ${input.gridConnection}; материал: ${input.materialSystem}`,
      `Стадия: ${input.stage}`,
      `Дисциплина: ${input.discipline}`,
      input.specializations.length > 0
        ? `Специализация роли: ${input.specializations.join(', ')}`
        : null,
      `Задача: ${input.ticketTitle}`,
      input.direction
        ? `Направление, выбранное клиентом: ${input.direction.title} — ${input.direction.summary}. Это ориентир, а не требование.`
        : null,
      input.inboundArtifacts.length > 0
        ? `Входные материалы от смежников: ${input.inboundArtifacts.join(', ')}`
        : 'Входных материалов от смежников нет.',
    ]
      .filter(Boolean)
      .join('\n')

    return this.ask<SpecDraft>(
      [
        'Напиши черновик постановки для одной атомарной задачи.',
        'Исполнитель видит только свою задачу: то, что не написано, он не узнает.',
        '',
        facts,
      ].join('\n'),
      SpecSchema,
      4000,
    )
  }

  /** Общая обёртка: одна форма запроса на все помощники. */
  private async ask<T>(prompt: string, schema: Parameters<typeof zodOutputFormat>[0], maxTokens = 3000): Promise<T> {
    const response = await this.client.messages.parse({
      model: MODEL,
      max_tokens: maxTokens,
      thinking: { type: 'adaptive' },
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
      output_config: { format: zodOutputFormat(schema) },
    })

    const parsed = response.parsed_output
    if (!parsed) throw new Error('Модель вернула ответ, который не разобрался в схему.')

    return parsed as T
  }

  async parseBrief(input: BriefInput): Promise<BriefParse> {
    return this.ask<BriefParse>(
      [
        'Разбери описание проекта в поля брифа.',
        'Заполняй только то, что прямо сказано. Не выводи из общих соображений:',
        'непроставленное поле клиент дозаполнит сам, а угаданное он не заметит.',
        '',
        input.text,
      ].join('\n'),
      BriefSchema,
    )
  }

  async proposePortfolioRating(input: PortfolioInput): Promise<PortfolioProposal> {
    return this.ask<PortfolioProposal>(
      [
        'Предложи рейтинг портфолио от нуля до десяти для разбора заявки специалиста.',
        'Это предложение: рейтинг ставит человек, и он должен видеть, на чём оно основано.',
        'Порог допуска в пул — восемь, поэтому цена ошибки в обе стороны высока.',
        '',
        `Имя: ${input.displayName}`,
        `Ссылка: ${input.portfolioUrl}`,
        `Дисциплины: ${input.disciplines.join(', ') || '—'}`,
        `Специализация: ${input.specializations.join(', ') || '—'}`,
        `Юрисдикции: ${input.jurisdictions.join(', ') || '—'}`,
        `Максимальная этажность: ${input.maxStoreys}`,
        '',
        'Работы в профиле:',
        input.works.length > 0
          ? input.works
              .map(
                (w) =>
                  `— ${w.title} (${w.kind})${w.areaSqm ? `, ${w.areaSqm} м²` : ''}: ${w.roleDescription || 'роль не описана'}`,
              )
              .join('\n')
          : '(пусто)',
      ].join('\n'),
      PortfolioSchema,
    )
  }

  async checkCompleteness(input: CompletenessInput): Promise<CompletenessCheck> {
    return this.ask<CompletenessCheck>(
      [
        'Сверь приложенные файлы с постановкой перед приёмкой.',
        'Ты не принимаешь работу: кнопку нажимает человек. Твоё дело — назвать то,',
        'что по постановке должно быть, а в списке файлов не видно.',
        'Судить о содержимом файлов по названиям нельзя — говори об этом прямо.',
        '',
        `Задача: ${input.ticketTitle} (${input.discipline}, стадия ${input.stage})`,
        '',
        'Постановка:',
        input.spec || '(пусто)',
        '',
        'Приложено:',
        input.artifacts.length > 0
          ? input.artifacts.map((a) => `— ${a.name} (${a.kind})`).join('\n')
          : '(ничего)',
      ].join('\n'),
      CompletenessSchema,
      2000,
    )
  }

  async draftRequest(input: RequestDraftInput): Promise<RequestDraft> {
    return this.ask<RequestDraft>(
      [
        'Приведи заметку специалиста в запрос смежной дисциплине.',
        'Адресат не видит ни задачи автора, ни его модели: запрос должен быть понятен сам по себе.',
        'Не добавляй фактов, которых в заметке нет — оси, размеры и отметки не выдумывай.',
        '',
        `От: ${input.fromDiscipline}. Кому: ${input.toDiscipline}.`,
        `Задача автора: ${input.ticketTitle}`,
        '',
        'Заметка:',
        input.rough,
      ].join('\n'),
      RequestSchema,
      2000,
    )
  }

  async summariseConflict(input: ConflictInput): Promise<ConflictSummary> {
    const thread = input.comments
      .map((c) => `${c.author === 'bureau' ? 'Бюро' : 'Специалист'}: ${c.body}`)
      .join('\n')

    return this.ask<ConflictSummary>(
      [
        'Сведи спор по задаче к позициям сторон и одному вопросу для арбитра.',
        'Не решай спор и не указывай, кто прав: решает человек.',
        '',
        `Задача: ${input.ticketTitle}`,
        `Причина обращения: ${input.conflictNote}`,
        '',
        'Переписка по задаче:',
        thread || '(пусто)',
      ].join('\n'),
      ConflictSchema,
      2000,
    )
  }
}
