/**
 * Сигналы цифрового менеджера поверх базы.
 *
 * Логика решает engine/pm; здесь только чтение тикетов и склейка с названиями
 * проектов, чтобы панель бюро показывала строку, по которой можно действовать.
 */

import type { Prisma } from '@/generated/prisma/client'
import { pmAlerts, type Alert, type PmTicket } from '@/engine/pm'
import { openable, type RelayTicket, type TicketStatus } from '@/engine/relay'
import type { DocStage } from '@/engine/taxonomy'
import { prisma } from '../db'

export type ProjectAlert = Alert & { projectTitle: string; discipline: string }

export async function alertsForBureau(now = new Date()): Promise<ProjectAlert[]> {
  const [alerts, stalled] = await Promise.all([
    load({ project: { status: { in: ['assembled', 'delivering'] } } }, now),
    stalledGates(),
  ])

  return [...stalled, ...alerts]
}

/**
 * Задачи, которые гейт обязан был открыть и не открыл.
 *
 * Приёмка записывает переход транзакцией, а зависимые задачи открывает
 * следующим вызовом — вне её. Между ними помещается перезапуск контейнера и
 * заминка базы, и после такого разрыва проект стоит: стадия оплачена,
 * подтверждена, а работа никому не выдана. Заметить это было неоткуда —
 * никто ничего не ждёт, потому что никто ни о чём не знает.
 *
 * Гейт идемпотентен, поэтому лечение — просто позвать его ещё раз. Сигнал
 * нужен затем, чтобы было кому позвать.
 *
 * Три запроса на все живые проекты разом, а не по три на проект: очередь
 * бюро открывается по многу раз в день, и цена у неё должна оставаться
 * ценой одного открытия.
 */
export async function stalledGates(): Promise<ProjectAlert[]> {
  const projects = await prisma.project.findMany({
    where: { status: { in: ['assembled', 'delivering'] } },
    select: { id: true, title: true },
  })

  if (projects.length === 0) return []

  const ids = projects.map((p) => p.id)

  const [tickets, approvals, invoices] = await Promise.all([
    prisma.ticket.findMany({
      where: { projectId: { in: ids } },
      select: {
        id: true,
        projectId: true,
        title: true,
        status: true,
        stage: true,
        discipline: true,
        dependsOn: { select: { prerequisiteId: true } },
      },
    }),
    prisma.stageApproval.findMany({
      where: { projectId: { in: ids } },
      select: { projectId: true, stage: true },
    }),
    prisma.invoice.findMany({
      where: { projectId: { in: ids }, status: 'paid' },
      select: { projectId: true, stage: true },
    }),
  ])

  /** Группировка по проекту: движок считает по одному проекту за раз. */
  function group<T extends { projectId: string }>(rows: T[]): Map<string, T[]> {
    const map = new Map<string, T[]>()

    for (const row of rows) {
      const list = map.get(row.projectId)
      if (list) list.push(row)
      else map.set(row.projectId, [row])
    }

    return map
  }

  const ticketsOf = group(tickets)
  const approvedOf = group(approvals)
  const paidOf = group(invoices)

  const alerts: ProjectAlert[] = []

  for (const project of projects) {
    const own = ticketsOf.get(project.id) ?? []
    if (own.length === 0) continue

    const relay: RelayTicket[] = own.map((t) => ({
      id: t.id,
      status: t.status as TicketStatus,
      stage: t.stage as DocStage,
      dependsOn: t.dependsOn.map((d) => d.prerequisiteId),
    }))

    const ready = openable(
      relay,
      (approvedOf.get(project.id) ?? []).map((r) => r.stage as DocStage),
      (paidOf.get(project.id) ?? []).map((r) => r.stage as DocStage),
    )

    for (const id of ready) {
      const ticket = own.find((t) => t.id === id)!

      alerts.push({
        kind: 'gate_stalled',
        ticketId: id,
        projectId: project.id,
        title: ticket.title,
        // Часов у этого сигнала нет: момент, когда задача стала готовой и не
        // открылась, нигде не записан — его и не должно было существовать.
        hours: 0,
        projectTitle: project.title,
        discipline: ticket.discipline,
      })
    }
  }

  return alerts
}

/**
 * Сигналы по одному проекту.
 *
 * Отдельный запрос вместо фильтра по общей выборке: страница проекта не должна
 * тянуть очередь всего бюро ради пяти своих тикетов.
 */
export async function alertsForProject(
  projectId: string,
  now = new Date(),
): Promise<ProjectAlert[]> {
  return load({ projectId }, now)
}

async function load(where: Prisma.TicketWhereInput, now: Date): Promise<ProjectAlert[]> {
  const tickets = await prisma.ticket.findMany({
    where,
    select: {
      id: true,
      projectId: true,
      title: true,
      status: true,
      discipline: true,
      openedAt: true,
      claimedAt: true,
      submittedAt: true,
      dueAt: true,
      conflictRaisedAt: true,
      project: { select: { title: true } },
    },
  })

  const byId = new Map(tickets.map((t) => [t.id, t]))

  const input: PmTicket[] = tickets.map((t) => ({
    id: t.id,
    projectId: t.projectId,
    title: t.title,
    status: t.status as TicketStatus,
    openedAt: t.openedAt,
    claimedAt: t.claimedAt,
    submittedAt: t.submittedAt,
    dueAt: t.dueAt,
    conflictRaisedAt: t.conflictRaisedAt,
  }))

  return pmAlerts(input, now).map((alert) => {
    const ticket = byId.get(alert.ticketId)!

    return { ...alert, projectTitle: ticket.project.title, discipline: ticket.discipline }
  })
}
