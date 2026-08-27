/**
 * Цифровой менеджер проекта.
 *
 * Роль здесь ровно одна: следить и сигналить. Он не рисует чертежи, не считает
 * нагрузки и не решает споры — он замечает, что тикет открыт и не взят, что
 * срок горит, что работа предъявлена и лежит непринятой, что кто-то поднял
 * конфликт. Дальше действует человек.
 *
 * Граница проведена сознательно: исполнение — юридическая ответственность,
 * а наблюдение — нет. Чертежи делают люди, которых подобрал алгоритм.
 *
 * Модуль чистый: на вход — тикеты и «сейчас», на выход — список сигналов.
 * Время передаётся аргументом, чтобы поведение было воспроизводимым в тестах.
 */

import type { TicketStatus } from './relay'

export type AlertKind =
  | 'conflict'
  | 'overdue'
  | 'unclaimed'
  | 'due_soon'
  | 'awaiting_acceptance'

export type PmTicket = {
  id: string
  projectId: string
  title: string
  status: TicketStatus
  openedAt: Date | null
  claimedAt: Date | null
  submittedAt: Date | null
  dueAt: Date | null
  conflictRaisedAt: Date | null
}

export type Alert = {
  kind: AlertKind
  ticketId: string
  projectId: string
  title: string
  /** Сколько часов длится ситуация. Для сортировки и для текста сигнала. */
  hours: number
}

/** Открытый и не взятый в работу дольше этого — уже не «человек занят». */
export const UNCLAIMED_AFTER_HOURS = 8

/** Предъявлено и лежит непринятым дольше этого — это уже наша просрочка. */
export const ACCEPTANCE_SLA_HOURS = 24

/** За сколько часов до срока начинать предупреждать. */
export const DUE_SOON_HOURS = 8

/** Порядок разбора: сначала то, где уже стоит работа, потом то, что встанет. */
const SEVERITY: Record<AlertKind, number> = {
  conflict: 0,
  overdue: 1,
  unclaimed: 2,
  awaiting_acceptance: 3,
  due_soon: 4,
}

export const ALERT_LABELS: Record<AlertKind, string> = {
  conflict: 'Конфликт — нужен арбитр',
  overdue: 'Просрочен',
  unclaimed: 'Открыт, но не взят в работу',
  awaiting_acceptance: 'Ждёт приёмки бюро',
  due_soon: 'Срок близко',
}

function hoursBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getTime() - from.getTime()) / 3_600_000)
}

export function pmAlerts(tickets: PmTicket[], now: Date): Alert[] {
  const alerts: Alert[] = []

  for (const ticket of tickets) {
    const base = { ticketId: ticket.id, projectId: ticket.projectId, title: ticket.title }

    if (ticket.conflictRaisedAt) {
      alerts.push({ ...base, kind: 'conflict', hours: hoursBetween(ticket.conflictRaisedAt, now) })
      // Конфликт перекрывает остальное: пока он не решён, сроки обсуждать рано.
      continue
    }

    if (ticket.status === 'accepted') continue

    if (ticket.status === 'submitted' && ticket.submittedAt) {
      const waiting = hoursBetween(ticket.submittedAt, now)
      if (waiting >= ACCEPTANCE_SLA_HOURS) {
        alerts.push({ ...base, kind: 'awaiting_acceptance', hours: waiting })
      }
      // Предъявленный тикет уже не просрочка исполнителя — мяч на нашей стороне.
      continue
    }

    if (ticket.status === 'open' && ticket.openedAt) {
      const idle = hoursBetween(ticket.openedAt, now)
      if (idle >= UNCLAIMED_AFTER_HOURS) {
        alerts.push({ ...base, kind: 'unclaimed', hours: idle })
      }
    }

    if (ticket.dueAt && ticket.status !== 'blocked') {
      if (now > ticket.dueAt) {
        alerts.push({ ...base, kind: 'overdue', hours: hoursBetween(ticket.dueAt, now) })
      } else if (hoursBetween(now, ticket.dueAt) <= DUE_SOON_HOURS) {
        alerts.push({ ...base, kind: 'due_soon', hours: hoursBetween(now, ticket.dueAt) })
      }
    }
  }

  return alerts.sort((a, b) => SEVERITY[a.kind] - SEVERITY[b.kind] || b.hours - a.hours)
}

/**
 * Кого пинговать по сигналу. Это и есть «передача эстафеты»: система не ждёт,
 * что люди сами заметят, что их выход.
 */
export function alertAudience(kind: AlertKind): 'specialist' | 'bureau' {
  return kind === 'awaiting_acceptance' || kind === 'conflict' ? 'bureau' : 'specialist'
}
