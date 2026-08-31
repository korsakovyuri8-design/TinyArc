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
  /**
   * Задача готова к открытию и не открыта.
   *
   * Единственный вид, который считает не этот модуль: чтобы понять готовность,
   * нужны подтверждённые и оплаченные стадии, а они живут в базе. Слова и
   * порядок разбора для него всё равно здесь — иначе вид сигнала окажется
   * наполовину в одном месте, наполовину в другом.
   *
   * Возникает он от разрыва между приёмкой и гейтом: переход состояния
   * записан транзакцией, а открытие зависимых задач идёт следующим вызовом.
   * Перезапуск контейнера или заминка базы между ними оставляют проект
   * стоять — всё оплачено, всё подтверждено, а работа никому не выдана, — и
   * заметить это было неоткуда: никто ничего не ждёт, потому что никто ни о
   * чём не знает.
   */
  | 'gate_stalled'

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
  // Впереди конфликта: спор останавливает одну задачу, незакрытый гейт —
  // весь проект, и остановку эту никто не заметил.
  gate_stalled: -1,
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
  gate_stalled: 'Ready to open and not open',
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
  gate_stalled: 'Run the gate on the project: the stage is paid and confirmed, and the task has not gone out',
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
  /*
   * Незакрытый гейт — целиком наше: работа ещё никому не выдана, и писать по
   * ней некому. Список «наших» видов ведётся явно, а не остатком: новый вид,
   * попавший в остаток по невнимательности, отправил бы напоминание человеку,
   * который об этой задаче ничего не знает.
   */
  const ours: AlertKind[] = ['awaiting_acceptance', 'conflict', 'gate_stalled']

  return ours.includes(kind) ? 'bureau' : 'specialist'
}
