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
