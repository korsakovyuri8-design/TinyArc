import type {
  Assistant,
  ConflictInput,
  ConflictSummary,
  SpecDraft,
  SpecInput,
} from './types'

/**
 * Режим без модели: черновик собирается по шаблону из фактов проекта.
 *
 * Он намеренно не притворяется умным. Зато он полезен и без ключа: половина
 * работы над постановкой — это перенести в неё контекст, который и так есть в
 * системе, и шаблон делает ровно это. Оставшуюся половину пишет человек.
 */
export class StubAssistant implements Assistant {
  readonly mode = 'stub'

  async draftSpec(input: SpecInput): Promise<SpecDraft> {
    const lines = [
      `${input.ticketTitle}. Стадия: ${input.stage}.`,
      '',
      `Объект: ${input.typology}, ${input.storeys} эт., ${input.areaSqm} м², ${input.jurisdiction}.`,
      `Участок: ${input.terrain}. Сети: ${input.gridConnection}. Материал: ${input.materialSystem}.`,
    ]

    if (input.specializations.length > 0) {
      lines.push(`Роль требует: ${input.specializations.join(', ')}.`)
    }

    if (input.direction) {
      lines.push('', `Направление проекта: ${input.direction.title}. ${input.direction.summary}`)
    }

    if (input.inboundArtifacts.length > 0) {
      lines.push('', `Входные материалы: ${input.inboundArtifacts.join(', ')}.`)
    }

    lines.push('', 'Границы задачи и состав выпуска — дописать.')

    return {
      spec: lines.join('\n'),
      checklist: [
        'Состав выпуска перечислен',
        'Что передаётся дальше по графу — названо',
        'Ограничения участка учтены',
      ],
    }
  }

  async summariseConflict(input: ConflictInput): Promise<ConflictSummary> {
    // Без модели пересказывать нечего: отдаём исходное, не выдумывая позиции.
    const bySpecialist = input.comments.filter((c) => c.author === 'specialist').at(-1)

    return {
      positions: [
        input.conflictNote || 'Причина не описана.',
        bySpecialist?.body ?? 'Второй стороны в переписке нет.',
      ],
      question: `Что делать по задаче «${input.ticketTitle}»?`,
    }
  }
}
