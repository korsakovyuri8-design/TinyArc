import { ALERT_ACTIONS, ALERT_LABELS } from '@/engine/pm'
import type {
  Assistant,
  BriefInput,
  BriefParse,
  CompletenessCheck,
  CompletenessInput,
  ConflictInput,
  ConflictSummary,
  NudgeDraft,
  NudgeInput,
  PortfolioInput,
  PortfolioProposal,
  QueueInput,
  QueuePlan,
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
 *
 * Слова английские: продукт существует на английском, и бриф пишут на нём.
 * Русские остались рядом намеренно — они ничего не стоят, а владелец участка,
 * дописывающий пару фраз на родном языке, встречается чаще, чем кажется.
 */
const KEYWORDS: Record<string, Record<string, string[]>> = {
  typology: {
    villa: ['villa', 'house', 'cottage', 'mansion', 'вилл', 'дом ', 'коттедж'],
    townhouse: ['townhouse', 'town house', 'terraced', 'row house', 'таунхаус'],
    multi_family: ['multi-family', 'multi family', 'apartment', 'residential block', 'многоквартир', 'апартамент'],
    mixed_use: ['mixed-use', 'mixed use', 'commercial', 'ground floor', 'смешан', 'коммерц'],
  },
  jurisdiction: {
    ME: ['montenegro', 'tivat', 'budva', 'kotor', 'bar ', 'podgorica', 'черногор', 'тиват'],
    RS: ['serbia', 'belgrade', 'novi sad', 'серби', 'белград'],
    GR: ['greece', 'athens', 'thessaloniki', 'crete', 'греци', 'афин'],
  },
  terrain: {
    slope: ['slope', 'sloping', 'hillside', 'level difference', 'склон', 'уклон', 'рельеф'],
    flood_prone: ['flood', 'flooding', 'waterfront', 'подтопл', 'затопл', 'паводок'],
  },
  gridConnection: {
    off_grid: ['off-grid', 'off grid', 'autonomous', 'no mains', 'solar', 'автоном', 'солнечн'],
  },
  materialSystem: {
    concrete: ['concrete', 'cast-in-place', 'reinforced', 'монолит', 'бетон'],
    masonry: ['masonry', 'brick', 'block', 'кладк', 'кирпич'],
    timber: ['timber', 'wood', 'clt', 'frame', 'дерев', 'брус'],
    steel: ['steel', 'metal', 'light-gauge', 'металл', 'сталь'],
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
      `${input.ticketTitle}. Stage: ${input.stage}.`,
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
      lines.push('', `Input material: ${input.inboundArtifacts.join(', ')}.`)
    }

    lines.push('', 'The bounds of the task and the deliverables — to be written in.')

    return {
      spec: lines.join('\n'),
      checklist: [
        'The deliverables are listed',
        'What passes on down the graph is named',
        'Site constraints are accounted for',
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
      ['typology', 'typology'],
      ['jurisdiction', 'country'],
      ['storeys', 'storeys'],
      ['areaSqm', 'floor area'],
      ['terrain', 'site terrain'],
      ['materialSystem', 'material'],
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
    if (input.works.length === 0) gaps.push('the profile holds not a single work')
    if (input.works.every((w) => !w.roleDescription)) gaps.push('the role in the works is not described')
    if (input.specializations.length === 0) gaps.push('no specialisation is marked')

    return {
      rating: 0,
      reasoning:
        `Works in the profile: ${input.works.length}. Disciplines: ${input.disciplines.join(', ') || '—'}. ` +
        'Without a model the portfolio is not assessed — open the link and set the rating yourself.',
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
      missing: input.artifacts.length === 0 ? ['not a single file is attached to the ticket'] : [],
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

  async draftNudge(input: NudgeInput): Promise<NudgeDraft> {
    // Без модели напоминание собирается из того, что и так известно: почему
    // пишем, сколько это длится и по какой задаче. Упрёка в шаблоне нет —
    // напоминание должно сдвинуть работу, а не открыть спор.
    const hours = Math.round(input.hours)

    const opening = {
      unclaimed: `Задача «${input.ticketTitle}» открыта ${hours} ч и не взята в работу.`,
      overdue: `По задаче «${input.ticketTitle}» прошёл срок — ${hours} ч назад.`,
      due_soon: `По задаче «${input.ticketTitle}» срок через ${hours} ч.`,
    }[input.kind]

    const ask = {
      unclaimed: 'Are you taking this on, or should it go to someone else?',
      overdue: 'Name the date by which the work will be handed in.',
      due_soon: 'Will you make the deadline? If not — what is in the way.',
    }[input.kind]

    return { body: `${opening}\n\n${ask}`, ask }
  }

  async planQueue(input: QueueInput): Promise<QueuePlan> {
    // Порядок сигналов уже посчитан движком, и переставлять его здесь нечем.
    // Заглушка честно делает одно: превращает очередь в список действий.
    if (input.alerts.length === 0) {
      return { first: 'The queue is empty.', steps: [], notes: '' }
    }

    const head = input.alerts[0]!

    return {
      first: `${ALERT_ACTIONS[head.kind]} — «${head.title}», ${head.projectTitle}.`,
      steps: input.alerts
        .slice(0, 8)
        .map((a) => `${ALERT_ACTIONS[a.kind]}: «${a.title}» (${a.projectTitle}, ${Math.round(a.hours)} ч).`),
      notes:
        'Without a model the queue is not worked through — this is a retelling of it in order of urgency, ' +
        `посчитанному движком: ${ALERT_LABELS[head.kind].toLowerCase()} идёт первым.`,
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
