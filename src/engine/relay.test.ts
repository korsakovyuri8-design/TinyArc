import { describe, expect, it } from 'vitest'
import {
  awaitingClient,
  canOpen,
  deliveryDeltaFor,
  dueDate,
  openable,
  planTickets,
  stageComplete,
  stagesOf,
  teammateRoles,
  topologicalOrder,
  type RelayTicket,
} from './relay'

const TEAM = ['architecture', 'structural', 'mep', 'survey', 'permitting', 'visualization'] as const

describe('план графа тикетов', () => {
  it('дробит работу на атомарные задачи, а не на разделы', () => {
    const plan = planTickets('permit', [...TEAM])
    const architectureAtPermit = plan.filter(
      (t) => t.stage === 'permit' && t.discipline === 'architecture',
    )

    // Планы, фасады, разрезы, записка — четыре тикета, а не один «раздел».
    expect(architectureAtPermit.length).toBeGreaterThan(1)
    expect(architectureAtPermit.map((t) => t.title)).toContain('Фасады')
  })

  it('не заводит работу, которую некому делать', () => {
    const plan = planTickets('permit', ['architecture', 'structural'])
    const disciplines = new Set(plan.map((t) => t.discipline))

    expect(disciplines.has('permitting')).toBe(false)
    expect(disciplines.has('survey')).toBe(false)
    expect(disciplines.has('architecture')).toBe(true)
  })

  it('ведёт проект по стадиям до целевой', () => {
    expect(stagesOf(planTickets('permit', [...TEAM]))).toEqual(['concept', 'permit'])
    expect(stagesOf(planTickets('construction', [...TEAM]))).toEqual([
      'concept',
      'permit',
      'tender',
      'construction',
    ])
  })

  it('внутри дисциплины ведёт задачи цепочкой', () => {
    const plan = planTickets('permit', [...TEAM])
    const arch = plan.filter((t) => t.stage === 'permit' && t.discipline === 'architecture')

    // Фасады рисуют по планам, а не одновременно с ними.
    expect(arch[1].dependsOn).toEqual([arch[0].key])
    expect(arch[2].dependsOn).toEqual([arch[1].key])
  })

  it('ставит геодезию раньше архитектуры, а согласования — последними', () => {
    const plan = planTickets('permit', [...TEAM])
    const at = (d: string) => plan.filter((t) => t.stage === 'permit' && t.discipline === d)

    const survey = at('survey')
    const arch = at('architecture')
    const permitting = at('permitting')

    // Голова архитектуры ждёт хвост геодезии.
    expect(arch[0].dependsOn).toEqual([survey[survey.length - 1].key])
    // Согласования ждут хвосты всех остальных дисциплин стадии.
    expect(permitting[0].dependsOn).toContain(arch[arch.length - 1].key)
    expect(permitting[0].dependsOn).not.toContain(permitting[0].key)
  })

  it('связывает стадии: следующая входит в предыдущую', () => {
    const plan = planTickets('permit', [...TEAM])
    const survey = plan.filter((t) => t.stage === 'permit' && t.discipline === 'survey')
    const conceptKeys = plan.filter((t) => t.stage === 'concept').map((t) => t.key)

    expect(survey[0].dependsOn.length).toBeGreaterThan(0)
    for (const dependency of survey[0].dependsOn) expect(conceptKeys).toContain(dependency)
  })

  it('строит граф без циклов', () => {
    const plan = planTickets('construction', [
      'architecture',
      'structural',
      'mep',
      'landscape',
      'interiors',
      'survey',
      'permitting',
      'visualization',
    ])

    const tickets: RelayTicket[] = plan.map((t) => ({
      id: t.key,
      status: 'blocked',
      stage: t.stage,
      dependsOn: t.dependsOn,
    }))

    expect(topologicalOrder(tickets)).toHaveLength(plan.length)
  })

  it('замечает цикл, а не зацикливается', () => {
    expect(
      topologicalOrder([
        { id: 'a', status: 'blocked', stage: 'permit', dependsOn: ['b'] },
        { id: 'b', status: 'blocked', stage: 'permit', dependsOn: ['a'] },
      ]),
    ).toEqual([])
  })

  it('даёт разным задачам разные сроки', () => {
    const plan = planTickets('permit', [...TEAM])
    const slas = new Set(plan.map((t) => t.slaHours))

    // Посадка на участок и подача в органы — работа разного веса.
    expect(slas.size).toBeGreaterThan(1)
  })
})

describe('стадийные гейты', () => {
  it('открывает только по принятым зависимостям, а не по предъявленным', () => {
    expect(canOpen([])).toBe(true)
    expect(canOpen(['accepted', 'accepted'])).toBe(true)
    expect(canOpen(['accepted', 'submitted'])).toBe(false)
    expect(canOpen(['in_progress'])).toBe(false)
    expect(canOpen(['revision'])).toBe(false)
  })

  it('открывает следующий тикет ровно тогда, когда предыдущий принят', () => {
    const tickets: RelayTicket[] = [
      { id: 'survey', status: 'submitted', stage: 'permit', dependsOn: [] },
      { id: 'arch', status: 'blocked', stage: 'permit', dependsOn: ['survey'] },
    ]

    expect(openable(tickets)).toEqual([])

    tickets[0].status = 'accepted'
    expect(openable(tickets)).toEqual(['arch'])
  })

  it('не открывает тикет, у которого принята только часть зависимостей', () => {
    expect(
      openable([
        { id: 'arch', status: 'accepted', stage: 'permit', dependsOn: [] },
        { id: 'struct', status: 'in_progress', stage: 'permit', dependsOn: ['arch'] },
        { id: 'permitting', status: 'blocked', stage: 'permit', dependsOn: ['arch', 'struct'] },
      ]),
    ).toEqual([])
  })
})

describe('счётчики поставки', () => {
  const opened = new Date('2026-03-01T09:00:00Z')

  it('считает срок от открытия по SLA в часах', () => {
    expect(dueDate(opened, 24).toISOString()).toBe('2026-03-02T09:00:00.000Z')
    expect(dueDate(opened, 48).toISOString()).toBe('2026-03-03T09:00:00.000Z')
  })

  it('меряет время реакции до принятия задачи, а не до первой реплики', () => {
    const delta = deliveryDeltaFor({
      openedAt: opened,
      claimedAt: new Date('2026-03-01T11:00:00Z'),
      acceptedAt: new Date('2026-03-02T08:00:00Z'),
      dueAt: dueDate(opened, 24),
      revisionRounds: 0,
    })

    expect(delta).toEqual({
      deliveredTickets: 1,
      onTimeTickets: 1,
      firstTimeRightTickets: 1,
      responseMinutes: 120,
      revisionRounds: 0,
    })
  })

  it('не засчитывает просрочку и круги правок', () => {
    const delta = deliveryDeltaFor({
      openedAt: opened,
      claimedAt: new Date('2026-03-03T09:00:00Z'),
      acceptedAt: new Date('2026-03-20T09:00:00Z'),
      dueAt: dueDate(opened, 24),
      revisionRounds: 2,
    })

    expect(delta.onTimeTickets).toBe(0)
    expect(delta.firstTimeRightTickets).toBe(0)
    expect(delta.revisionRounds).toBe(2)
    expect(delta.deliveredTickets).toBe(1)
  })

  it('не выдумывает время реакции, если тикет не брали в работу', () => {
    expect(
      deliveryDeltaFor({
        openedAt: opened,
        claimedAt: null,
        acceptedAt: new Date('2026-03-02T08:00:00Z'),
        dueAt: dueDate(opened, 24),
        revisionRounds: 0,
      }).responseMinutes,
    ).toBe(0)
  })
})

describe('обезличивание', () => {
  it('отдаёт роли соседей, а не людей', () => {
    const roles = teammateRoles(
      [
        { specialist: { id: 'me' }, discipline: 'architecture' },
        { specialist: { id: 'other' }, discipline: 'structural' },
        { specialist: { id: 'third' }, discipline: 'mep' },
      ],
      'me',
    )

    expect(roles).toEqual(['structural', 'mep'])
    expect(JSON.stringify(roles)).not.toContain('other')
  })
})

describe('подтверждение стадии заказчиком', () => {
  const project = (): RelayTicket[] => [
    { id: 'c1', status: 'accepted', stage: 'concept', dependsOn: [] },
    { id: 'c2', status: 'accepted', stage: 'concept', dependsOn: ['c1'] },
    { id: 'p1', status: 'blocked', stage: 'permit', dependsOn: ['c2'] },
  ]

  it('видит стадию, законченную бюро', () => {
    expect(stageComplete(project(), 'concept')).toBe(true)
    expect(stageComplete(project(), 'permit')).toBe(false)
  })

  it('стадия без задач законченной не считается', () => {
    expect(stageComplete(project(), 'tender')).toBe(false)
  })

  /**
   * Главное здесь. Зависимости приняты, но заказчик молчит — и следующая
   * стадия не открывается. Разрабатывать документацию по неподтверждённой
   * концепции значит готовить переделку.
   */
  it('не открывает следующую стадию, пока заказчик не подтвердил предыдущую', () => {
    expect(openable(project(), [])).toEqual([])
    expect(openable(project(), ['concept'])).toEqual(['p1'])
  })

  it('называет стадии, ждущие слова заказчика', () => {
    expect(awaitingClient(project(), [])).toEqual(['concept'])
    expect(awaitingClient(project(), ['concept'])).toEqual([])
  })

  it('внутри стадии подтверждение ничего не меняет', () => {
    // Первая стадия не ждёт ничьего подтверждения: до неё стадий нет.
    const fresh: RelayTicket[] = [
      { id: 'c1', status: 'accepted', stage: 'concept', dependsOn: [] },
      { id: 'c2', status: 'blocked', stage: 'concept', dependsOn: ['c1'] },
    ]

    expect(openable(fresh, [])).toEqual(['c2'])
  })

  it('порядок стадий соблюдается: подтверждение поздней не открывает раннюю', () => {
    const three: RelayTicket[] = [
      { id: 'c1', status: 'accepted', stage: 'concept', dependsOn: [] },
      { id: 'p1', status: 'blocked', stage: 'permit', dependsOn: ['c1'] },
      { id: 't1', status: 'blocked', stage: 'tender', dependsOn: ['p1'] },
    ]

    // Подтверждение стадии разрешений при неподтверждённой концепции ничего не
    // открывает: пропускать стадию нельзя ни с какой стороны.
    expect(openable(three, ['permit'])).toEqual([])
    expect(openable(three, ['concept'])).toEqual(['p1'])
  })
})
