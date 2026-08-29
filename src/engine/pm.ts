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
  conflict: 'Conflict — an arbiter is needed',
  overdue: 'Overdue',
  unclaimed: 'Open, not yet taken on',
  awaiting_acceptance: 'Awaiting acceptance by the bureau',
  due_soon: 'Deadline is near',
}

/**
 * Что делать по сигналу.
 *
 * Действие на каждый вид ровно одно: сигнал, на который есть три равноценных
 * ответа, — это не сигнал, а повод подумать, и в очередь менеджера он попадать
 * не должен. Формулировки нарочно в повелительном наклонении: строку читает
 * человек, который разбирает очередь, а не отчёт.
 */
export const ALERT_ACTIONS: Record<AlertKind, string> = {
  conflict: 'Read both positions and rule on it',
  overdue: 'Write in the ticket: the deadline has passed, a new date is needed',
  unclaimed: 'Write in the ticket or reassemble the role',
  awaiting_acceptance: 'Accept it or send it back for revision',
  due_soon: 'Ask in the ticket whether they will make the deadline',
}

/** Виды, по которым бюро пишет исполнителю. Остальное решается у нас. */
export const NUDGE_KINDS = ['unclaimed', 'overdue', 'due_soon'] as const

export type NudgeKind = (typeof NUDGE_KINDS)[number]

export function isNudgeKind(kind: AlertKind): kind is NudgeKind {
  return (NUDGE_KINDS as readonly AlertKind[]).includes(kind)
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
 * Проекты, отсортированные по тому, насколько в них встала работа.
 *
 * Плоский список тикетов отвечает на вопрос «что горит», но не на вопрос «где
 * горит»: пять сигналов на одном проекте и пять сигналов на пяти разных — это
 * разные ситуации, и разбирать их надо по-разному. Менеджер сводит очередь до
 * проектов, потому что клиенту он отвечает за проект целиком.
 */
export type ProjectHeat = {
  projectId: string
  /** Худший сигнал по проекту — по нему проект и стоит в очереди. */
  worst: AlertKind
  /** Сколько сигналов всего. */
  total: number
  /** Часы по самому старому сигналу: сколько уже стоит. */
  hours: number
}

export function projectHeat(alerts: Alert[]): ProjectHeat[] {
  const byProject = new Map<string, ProjectHeat>()

  for (const alert of alerts) {
    const current = byProject.get(alert.projectId)

    if (!current) {
      byProject.set(alert.projectId, {
        projectId: alert.projectId,
        worst: alert.kind,
        total: 1,
        hours: alert.hours,
      })
      continue
    }

    current.total += 1
    if (SEVERITY[alert.kind] < SEVERITY[current.worst]) current.worst = alert.kind
    if (alert.hours > current.hours) current.hours = alert.hours
  }

  return [...byProject.values()].sort(
    (a, b) => SEVERITY[a.worst] - SEVERITY[b.worst] || b.hours - a.hours,
  )
}

/**
 * Кого пинговать по сигналу. Это и есть «передача эстафеты»: система не ждёт,
 * что люди сами заметят, что их выход.
 */
export function alertAudience(kind: AlertKind): 'specialist' | 'bureau' {
  return kind === 'awaiting_acceptance' || kind === 'conflict' ? 'bureau' : 'specialist'
}
