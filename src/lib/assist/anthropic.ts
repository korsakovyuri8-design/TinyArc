import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import type {
  Assistant,
  ConflictInput,
  ConflictSummary,
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

    const response = await this.client.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      thinking: { type: 'adaptive' },
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            'Напиши черновик постановки для одной атомарной задачи.',
            'Исполнитель видит только свою задачу: то, что не написано, он не узнает.',
            '',
            facts,
          ].join('\n'),
        },
      ],
      output_config: { format: zodOutputFormat(SpecSchema) },
    })

    const parsed = response.parsed_output
    if (!parsed) throw new Error('Модель вернула ответ, который не разобрался в схему.')

    return parsed
  }

  async summariseConflict(input: ConflictInput): Promise<ConflictSummary> {
    const thread = input.comments
      .map((c) => `${c.author === 'bureau' ? 'Бюро' : 'Специалист'}: ${c.body}`)
      .join('\n')

    const response = await this.client.messages.parse({
      model: MODEL,
      max_tokens: 2000,
      thinking: { type: 'adaptive' },
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            'Сведи спор по задаче к позициям сторон и одному вопросу для арбитра.',
            'Не решай спор и не указывай, кто прав: решает человек.',
            '',
            `Задача: ${input.ticketTitle}`,
            `Причина обращения: ${input.conflictNote}`,
            '',
            'Переписка по задаче:',
            thread || '(пусто)',
          ].join('\n'),
        },
      ],
      output_config: { format: zodOutputFormat(ConflictSchema) },
    })

    const parsed = response.parsed_output
    if (!parsed) throw new Error('Модель вернула ответ, который не разобрался в схему.')

    return parsed
  }
}
