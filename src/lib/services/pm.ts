/**
 * Сигналы цифрового менеджера поверх базы.
 *
 * Логика решает engine/pm; здесь только чтение тикетов и склейка с названиями
 * проектов, чтобы панель бюро показывала строку, по которой можно действовать.
 */

import { pmAlerts, type Alert, type PmTicket } from '@/engine/pm'
import type { TicketStatus } from '@/engine/relay'
import { prisma } from '../db'

export type ProjectAlert = Alert & { projectTitle: string; discipline: string }

export async function alertsForBureau(now = new Date()): Promise<ProjectAlert[]> {
  const tickets = await prisma.ticket.findMany({
    where: { project: { status: { in: ['assembled', 'delivering'] } } },
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
