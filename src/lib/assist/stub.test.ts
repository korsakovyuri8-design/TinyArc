import { describe, expect, it } from 'vitest'
import { StubAssistant } from './stub'
import type { SpecInput } from './types'

const input = (patch: Partial<SpecInput> = {}): SpecInput => ({
  projectTitle: 'Вилла в Тивате',
  typology: 'villa',
  storeys: 2,
  areaSqm: 420,
  jurisdiction: 'ME',
  terrain: 'slope',
  gridConnection: 'grid',
  materialSystem: 'concrete',
  stage: 'permit',
  discipline: 'structural',
  specializations: ['structural_concrete'],
  ticketTitle: 'Конструктивная схема',
  direction: { title: 'Террасирование', summary: 'Объём следует склону.' },
  inboundArtifacts: ['Планы этажей.ifc'],
  ...patch,
})

describe('черновик постановки без модели', () => {
  it('переносит в постановку контекст, который уже есть в системе', async () => {
    const draft = await new StubAssistant().draftSpec(input())

    expect(draft.spec).toContain('Конструктивная схема')
    expect(draft.spec).toContain('420')
    expect(draft.spec).toContain('slope')
    expect(draft.spec).toContain('Террасирование')
    expect(draft.spec).toContain('Планы этажей.ifc')
  })

  it('честно оставляет человеку то, что должен написать человек', async () => {
    const draft = await new StubAssistant().draftSpec(input())

    expect(draft.spec).toContain('дописать')
    expect(draft.checklist.length).toBeGreaterThan(0)
  })

  it('не падает без направления и без входных материалов', async () => {
    const draft = await new StubAssistant().draftSpec(
      input({ direction: null, inboundArtifacts: [], specializations: [] }),
    )

    expect(draft.spec).toContain('Конструктивная схема')
  })

  it('детерминирован', async () => {
    const a = await new StubAssistant().draftSpec(input())
    const b = await new StubAssistant().draftSpec(input())

    expect(a.spec).toBe(b.spec)
  })
})

describe('сводка спора без модели', () => {
  it('не выдумывает позиции, а отдаёт сказанное', async () => {
    const summary = await new StubAssistant().summariseConflict({
      ticketTitle: 'Топографическая съёмка',
      conflictNote: 'Вентканал упирается в дверь.',
      comments: [
        { author: 'bureau', body: 'Уточните оси.' },
        { author: 'specialist', body: 'Оси 3–4, проём 900.' },
      ],
    })

    expect(summary.positions[0]).toContain('Вентканал')
    expect(summary.positions[1]).toContain('Оси 3–4')
    expect(summary.question).toContain('Топографическая съёмка')
  })

  it('переживает пустую переписку', async () => {
    const summary = await new StubAssistant().summariseConflict({
      ticketTitle: 'Фасады',
      conflictNote: '',
      comments: [],
    })

    expect(summary.positions).toHaveLength(2)
    expect(summary.question).toContain('Фасады')
  })
})

describe('разбор свободного описания без модели', () => {
  const assistant = new StubAssistant()

  it('находит то, что прямо названо', async () => {
    const parsed = await assistant.parseBrief({
      text: 'Хочу виллу в Тивате, 2 этажа, около 400 м2, участок с сильным уклоном к морю, монолит.',
    })

    expect(parsed.fields.typology).toBe('villa')
    expect(parsed.fields.jurisdiction).toBe('ME')
    expect(parsed.fields.storeys).toBe(2)
    expect(parsed.fields.areaSqm).toBe(400)
    expect(parsed.fields.terrain).toBe('slope')
    expect(parsed.fields.materialSystem).toBe('concrete')
  })

  it('не додумывает того, чего в тексте нет', async () => {
    const parsed = await assistant.parseBrief({ text: 'Хочу построить дом.' })

    expect(parsed.fields.jurisdiction).toBeUndefined()
    expect(parsed.fields.areaSqm).toBeUndefined()
    expect(parsed.missing).toContain('страна')
    expect(parsed.missing).toContain('площадь')
  })

  it('сохраняет сказанное клиентом целиком', async () => {
    const text = 'Участок у воды, бывает паводок. Нужна автономка.'
    const parsed = await assistant.parseBrief({ text })

    expect(parsed.fields.terrain).toBe('flood_prone')
    expect(parsed.fields.gridConnection).toBe('off_grid')
    expect(parsed.notes).toBe(text)
  })
})

describe('разбор портфолио без модели', () => {
  it('не выставляет рейтинг, а отдаёт материал человеку', async () => {
    const proposal = await new StubAssistant().proposePortfolioRating({
      displayName: 'Проверка',
      portfolioUrl: 'https://example.com',
      disciplines: ['structural'],
      specializations: [],
      jurisdictions: ['ME'],
      maxStoreys: 4,
      works: [],
    })

    // Ноль здесь — это «не оценивалось», и текст говорит об этом прямо.
    expect(proposal.rating).toBe(0)
    expect(proposal.reasoning).toContain('Без модели')
    expect(proposal.gaps).toContain('в профиле нет ни одной работы')
    expect(proposal.gaps).toContain('не отмечена специализация')
  })
})

describe('проверка комплектности без модели', () => {
  it('замечает пустой тикет', async () => {
    const check = await new StubAssistant().checkCompleteness({
      ticketTitle: 'Фасады',
      spec: 'Выпустить:\n— фасады в осях\n— ведомость проёмов',
      discipline: 'architecture',
      stage: 'permit',
      artifacts: [],
    })

    expect(check.missing[0]).toContain('ни одного файла')
  })

  it('поднимает строки постановки, которых не видно в приложенном', async () => {
    const check = await new StubAssistant().checkCompleteness({
      ticketTitle: 'Фасады',
      spec: 'Выпустить:\n— фасады в осях\n— ведомость проёмов',
      discipline: 'architecture',
      stage: 'permit',
      artifacts: [{ name: 'фасады в осях.pdf', kind: 'sheet' }],
    })

    expect(check.missing).toHaveLength(0)
    expect(check.worthChecking.join(' ')).toContain('ведомость')
  })
})

describe('черновик запроса без модели', () => {
  it('делает из заметки название и текст, ничего не выдумывая', async () => {
    const draft = await new StubAssistant().draftRequest({
      fromDiscipline: 'mep',
      toDiscipline: 'architecture',
      ticketTitle: 'Отопление и вентиляция',
      rough: 'Вентканал упирается в дверь в осях 3-4. Нужно сдвинуть проём.',
    })

    expect(draft.title).toBe('Вентканал упирается в дверь в осях 3-4')
    expect(draft.body).toContain('Нужно сдвинуть проём')
    expect(draft.body).toContain('Отопление и вентиляция')
  })
})
