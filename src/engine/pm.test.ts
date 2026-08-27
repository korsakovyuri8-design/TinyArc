import { describe, expect, it } from 'vitest'
import {
  ACCEPTANCE_SLA_HOURS,
  UNCLAIMED_AFTER_HOURS,
  alertAudience,
  pmAlerts,
  type PmTicket,
} from './pm'

const NOW = new Date('2026-03-10T12:00:00Z')
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000)
const hoursAhead = (h: number) => new Date(NOW.getTime() + h * 3_600_000)

function ticket(patch: Partial<PmTicket> = {}): PmTicket {
  return {
    id: 't1',
    projectId: 'p1',
    title: 'Фасады',
    status: 'in_progress',
    openedAt: hoursAgo(4),
    claimedAt: hoursAgo(3),
    submittedAt: null,
    dueAt: hoursAhead(20),
    conflictRaisedAt: null,
    ...patch,
  }
}

describe('цифровой менеджер', () => {
  it('молчит, когда всё идёт по плану', () => {
    expect(pmAlerts([ticket()], NOW)).toEqual([])
  })

  it('замечает открытый и не взятый в работу тикет', () => {
    const alerts = pmAlerts(
      [ticket({ status: 'open', claimedAt: null, openedAt: hoursAgo(UNCLAIMED_AFTER_HOURS + 1) })],
      NOW,
    )

    expect(alerts.map((a) => a.kind)).toContain('unclaimed')
  })

  it('не дёргает по тикету, открытому только что', () => {
    const alerts = pmAlerts([ticket({ status: 'open', claimedAt: null, openedAt: hoursAgo(1) })], NOW)
    expect(alerts.map((a) => a.kind)).not.toContain('unclaimed')
  })

  it('замечает просрочку', () => {
    const alerts = pmAlerts([ticket({ dueAt: hoursAgo(5) })], NOW)

    expect(alerts[0].kind).toBe('overdue')
    expect(alerts[0].hours).toBeCloseTo(5)
  })

  it('предупреждает заранее, а не только по факту', () => {
    expect(pmAlerts([ticket({ dueAt: hoursAhead(4) })], NOW).map((a) => a.kind)).toContain('due_soon')
    expect(pmAlerts([ticket({ dueAt: hoursAhead(40) })], NOW)).toEqual([])
  })

  it('не считает просрочкой исполнителя то, что предъявлено', () => {
    const alerts = pmAlerts(
      [ticket({ status: 'submitted', submittedAt: hoursAgo(2), dueAt: hoursAgo(1) })],
      NOW,
    )

    expect(alerts).toEqual([])
  })

  it('ловит собственную просрочку бюро по приёмке', () => {
    const alerts = pmAlerts(
      [ticket({ status: 'submitted', submittedAt: hoursAgo(ACCEPTANCE_SLA_HOURS + 2) })],
      NOW,
    )

    expect(alerts[0].kind).toBe('awaiting_acceptance')
    expect(alertAudience('awaiting_acceptance')).toBe('bureau')
  })

  it('конфликт перекрывает всё остальное по тикету', () => {
    const alerts = pmAlerts(
      [ticket({ conflictRaisedAt: hoursAgo(3), dueAt: hoursAgo(10), status: 'open' })],
      NOW,
    )

    expect(alerts).toHaveLength(1)
    expect(alerts[0].kind).toBe('conflict')
    expect(alertAudience('conflict')).toBe('bureau')
  })

  it('молчит по принятым и заблокированным', () => {
    expect(pmAlerts([ticket({ status: 'accepted', dueAt: hoursAgo(100) })], NOW)).toEqual([])
    expect(
      pmAlerts([ticket({ status: 'blocked', openedAt: null, dueAt: null, claimedAt: null })], NOW),
    ).toEqual([])
  })

  it('ставит вперёд то, где работа уже стоит', () => {
    const alerts = pmAlerts(
      [
        ticket({ id: 'soon', dueAt: hoursAhead(2) }),
        ticket({ id: 'late', dueAt: hoursAgo(6) }),
        ticket({ id: 'fight', conflictRaisedAt: hoursAgo(1) }),
      ],
      NOW,
    )

    expect(alerts.map((a) => a.kind)).toEqual(['conflict', 'overdue', 'due_soon'])
  })
})
