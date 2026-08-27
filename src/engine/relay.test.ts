import { describe, expect, it } from 'vitest'
import {
  canOpen,
  deliveryDeltaFor,
  dueDate,
  openable,
  planTickets,
  stagesOf,
  teammateRoles,
  topologicalOrder,
  type RelayTicket,
} from './relay'

const TEAM = ['architecture', 'structural', 'mep', 'survey', 'permitting'] as const

describe('план графа тикетов', () => {
  it('не заводит работу, которую некому делать', () => {
    const plan = planTickets('villa', 'permit', ['architecture', 'structural'])
    const disciplines = new Set(plan.map((t) => t.discipline))

    expect(disciplines.has('permitting')).toBe(false)
    expect(disciplines.has('survey')).toBe(false)
    expect(disciplines.has('architecture')).toBe(true)
  })

  it('ведёт проект по стадиям до целевой', () => {
    const plan = planTickets('villa', 'permit', [...TEAM])
    expect(stagesOf(plan)).toEqual(['concept', 'permit'])

    const long = planTickets('villa', 'construction', [...TEAM])
    expect(stagesOf(long)).toEqual(['concept', 'permit', 'tender', 'construction'])
  })

  it('ставит геодезию раньше архитектуры, а согласования — последними', () => {
    const plan = planTickets('villa', 'permit', [...TEAM])
    const byKey = new Map(plan.map((t) => [t.key, t]))

    expect(byKey.get('permit:survey')!.dependsOn).not.toContain('permit:architecture')
    expect(byKey.get('permit:architecture')!.dependsOn).toContain('permit:survey')
    expect(byKey.get('permit:structural')!.dependsOn).toContain('permit:architecture')

    const permitting = byKey.get('permit:permitting')!
    expect(permitting.dependsOn).toEqual(
      expect.arrayContaining(['permit:architecture', 'permit:structural', 'permit:mep']),
    )
    expect(permitting.dependsOn).not.toContain('permit:permitting')
  })

  it('связывает стадии: следующая входит в предыдущую', () => {
    const plan = planTickets('villa', 'permit', [...TEAM])
    const survey = plan.find((t) => t.key === 'permit:survey')!

    // Геодезия — вход стадии разрешения, значит ждёт конца концепции.
    expect(survey.dependsOn).toContain('concept:architecture')
  })

  it('строит граф без циклов', () => {
    const plan = planTickets('mixed_use', 'construction', [
      'architecture',
      'structural',
      'mep',
      'landscape',
      'interiors',
      'survey',
      'permitting',
      'visualization',
    ])

    const asTickets: RelayTicket[] = plan.map((t) => ({
      id: t.key,
      status: 'blocked',
      dependsOn: t.dependsOn,
    }))

    expect(topologicalOrder(asTickets)).toHaveLength(plan.length)
  })

  it('замечает цикл, а не зацикливается', () => {
    const cyclic: RelayTicket[] = [
      { id: 'a', status: 'blocked', dependsOn: ['b'] },
      { id: 'b', status: 'blocked', dependsOn: ['a'] },
    ]

    expect(topologicalOrder(cyclic)).toEqual([])
  })
})

describe('стадийные гейты', () => {
  it('открывает только по принятым зависимостям, а не по предъявленным', () => {
    expect(canOpen([])).toBe(true)
    expect(canOpen(['accepted', 'accepted'])).toBe(true)
    expect(canOpen(['accepted', 'submitted'])).toBe(false)
    expect(canOpen(['revision'])).toBe(false)
  })

  it('открывает следующий тикет ровно тогда, когда предыдущий принят', () => {
    const tickets: RelayTicket[] = [
      { id: 'survey', status: 'submitted', dependsOn: [] },
      { id: 'arch', status: 'blocked', dependsOn: ['survey'] },
    ]

    expect(openable(tickets)).toEqual([])

    tickets[0].status = 'accepted'
    expect(openable(tickets)).toEqual(['arch'])
  })

  it('не открывает тикет, у которого принята только часть зависимостей', () => {
    const tickets: RelayTicket[] = [
      { id: 'arch', status: 'accepted', dependsOn: [] },
      { id: 'struct', status: 'open', dependsOn: ['arch'] },
      { id: 'permitting', status: 'blocked', dependsOn: ['arch', 'struct'] },
    ]

    expect(openable(tickets)).toEqual([])
  })
})

describe('счётчики поставки', () => {
  const opened = new Date('2026-03-01T09:00:00Z')

  it('считает срок от открытия по SLA', () => {
    expect(dueDate(opened, 7).toISOString()).toBe('2026-03-08T09:00:00.000Z')
  })

  it('засчитывает приёмку в срок и с первого раза', () => {
    const delta = deliveryDeltaFor({
      openedAt: opened,
      firstResponseAt: new Date('2026-03-01T11:00:00Z'),
      acceptedAt: new Date('2026-03-05T09:00:00Z'),
      dueAt: dueDate(opened, 7),
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
      firstResponseAt: new Date('2026-03-03T09:00:00Z'),
      acceptedAt: new Date('2026-03-20T09:00:00Z'),
      dueAt: dueDate(opened, 7),
      revisionRounds: 2,
    })

    expect(delta.onTimeTickets).toBe(0)
    expect(delta.firstTimeRightTickets).toBe(0)
    expect(delta.revisionRounds).toBe(2)
    expect(delta.deliveredTickets).toBe(1)
  })

  it('не выдумывает время отклика, если ответа не было', () => {
    const delta = deliveryDeltaFor({
      openedAt: opened,
      firstResponseAt: null,
      acceptedAt: new Date('2026-03-05T09:00:00Z'),
      dueAt: dueDate(opened, 7),
      revisionRounds: 0,
    })

    expect(delta.responseMinutes).toBe(0)
  })
})

describe('обезличивание', () => {
  it('отдаёт роли соседей, а не людей', () => {
    const team = [
      { specialist: { id: 'me' }, discipline: 'architecture' as const },
      { specialist: { id: 'other' }, discipline: 'structural' as const },
      { specialist: { id: 'third' }, discipline: 'mep' as const },
    ]

    const roles = teammateRoles(team, 'me')

    expect(roles).toEqual(['structural', 'mep'])
    // Возвращается дисциплина и только она: ни идентификатора, ни имени.
    expect(JSON.stringify(roles)).not.toContain('other')
  })
})
