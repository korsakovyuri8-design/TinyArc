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

/**
 * Словари для разбора свободного текста без модели.
 *
 * Это поиск по ключевым словам, а не понимание. Он честно ошибается в сторону
 * «не нашёл»: пропустить поле и дать человеку заполнить его самому безопаснее,
 * чем угадать и подставить.
 */
const KEYWORDS: Record<string, Record<string, string[]>> = {
  typology: {
    villa: ['вилл', 'дом ', 'коттедж', 'особняк'],
    townhouse: ['таунхаус', 'townhouse', 'блокирован'],
    multi_family: ['многоквартир', 'жилой дом', 'апартамент'],
    mixed_use: ['смешан', 'mixed', 'коммерц', 'первый этаж'],
  },
  jurisdiction: {
    ME: ['черногор', 'тиват', 'будв', 'котор', 'бар ', 'подгориц'],
    RS: ['серби', 'белград', 'нови-сад', 'нови сад'],
    GR: ['греци', 'афин', 'салоник', 'крит'],
  },
  terrain: {
    slope: ['склон', 'уклон', 'рельеф', 'перепад'],
    flood_prone: ['подтопл', 'затопл', 'паводок', 'у воды'],
  },
  gridConnection: {
    off_grid: ['автоном', 'off-grid', 'без сетей', 'солнечн'],
  },
  materialSystem: {
    concrete: ['монолит', 'бетон', 'железобетон'],
    masonry: ['кладк', 'кирпич', 'блок'],
    timber: ['дерев', 'брус', 'clt', 'каркасн'],
    steel: ['металл', 'сталь', 'лстк'],
  },
}

function findAll(text: string): Record<string, string> {
  const lower = text.toLowerCase()
  const found: Record<string, string> = {}

  for (const [field, values] of Object.entries(KEYWORDS)) {
    for (const [value, words] of Object.entries(values)) {
      if (words.some((w) => lower.includes(w))) {
        found[field] = value
        break
      }
    }
  }

  return found
}

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

  async parseBrief(input: BriefInput): Promise<BriefParse> {
    const found = findAll(input.text)

    const storeys = input.text.match(/(\d+)\s*этаж/i)
    const area = input.text.match(/(\d{2,6})\s*(?:м2|м²|кв)/i)

    const fields = {
      ...found,
      ...(storeys ? { storeys: Number(storeys[1]) } : {}),
      ...(area ? { areaSqm: Number(area[1]) } : {}),
    }

    const wanted = [
      ['typology', 'типология'],
      ['jurisdiction', 'страна'],
      ['storeys', 'этажность'],
      ['areaSqm', 'площадь'],
      ['terrain', 'рельеф участка'],
      ['materialSystem', 'материал'],
    ] as const

    return {
      fields,
      missing: wanted.filter(([key]) => !(key in fields)).map(([, label]) => label),
      notes: input.text.trim(),
    }
  }

  async proposePortfolioRating(input: PortfolioInput): Promise<PortfolioProposal> {
    // Без модели портфолио не смотрится. Отдаём не оценку, а материал для
    // человека: сколько работ, какого рода, и чего в них не хватает.
    const gaps: string[] = []
    if (input.works.length === 0) gaps.push('в профиле нет ни одной работы')
    if (input.works.every((w) => !w.roleDescription)) gaps.push('не описана роль в работах')
    if (input.specializations.length === 0) gaps.push('не отмечена специализация')

    return {
      rating: 0,
      reasoning:
        `Работ в профиле: ${input.works.length}. Дисциплины: ${input.disciplines.join(', ') || '—'}. ` +
        'Без модели портфолио не оценивается — смотрите ссылку и ставьте рейтинг сами.',
      gaps,
    }
  }

  async checkCompleteness(input: CompletenessInput): Promise<CompletenessCheck> {
    // Сверяем по строчкам постановки, начинающимся с тире: их бюро и пишет как
    // список выпуска. Это грубо, но проверяемо и без модели.
    const wanted = input.spec
      .split('\n')
      .map((line) => line.replace(/^[—\-–•]\s*/, '').trim())
      .filter((line) => line.length > 3 && line !== input.spec.trim())

    const names = input.artifacts.map((a) => a.name.toLowerCase()).join(' ')

    return {
      missing: input.artifacts.length === 0 ? ['к тикету не приложено ни одного файла'] : [],
      worthChecking: wanted
        .filter((line) => !names.includes(line.toLowerCase().slice(0, 12)))
        .slice(0, 5),
    }
  }

  async draftRequest(input: RequestDraftInput): Promise<RequestDraft> {
    const first = input.rough.split(/[.!?\n]/)[0]?.trim() ?? input.rough.trim()

    return {
      title: first.slice(0, 70) || `Запрос по задаче «${input.ticketTitle}»`,
      body: [
        input.rough.trim(),
        '',
        `Контекст: задача «${input.ticketTitle}», раздел ${input.fromDiscipline}.`,
      ].join('\n'),
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
