/**
 * Blind Relay Protocol: работа с базой (концепт, п.11).
 *
 * Функции здесь — единственный способ сдвинуть тикет. Ни одна из них не создаёт
 * канала между двумя специалистами: комментарий всегда принадлежит тикету, а
 * автор бывает только двух видов — бюро и исполнитель этого тикета.
 */

import { deliveryDeltaFor, dueDate, openable, type RelayTicket } from '@/engine/relay'
import { prisma } from '../db'

export class NotYours extends Error {
  constructor() {
    super('Тикет назначен не вам.')
    this.name = 'NotYours'
  }
}

export class NotOpen extends Error {
  constructor(status: string) {
    super(`Тикет в статусе «${status}»: это действие сейчас недоступно.`)
    this.name = 'NotOpen'
  }
}

async function relayTickets(projectId: string): Promise<RelayTicket[]> {
  const tickets = await prisma.ticket.findMany({
    where: { projectId },
    include: { dependsOn: true },
  })

  return tickets.map((t) => ({
    id: t.id,
    status: t.status as RelayTicket['status'],
    dependsOn: t.dependsOn.map((d) => d.prerequisiteId),
  }))
}

/**
 * Открывает тикеты, у которых приняты все зависимости.
 *
 * Вызывается после каждой приёмки и после сборки команды. Другого способа
 * перевести тикет в работу нет — руками статус не ставится.
 */
export async function applyGates(projectId: string): Promise<string[]> {
  const ready = openable(await relayTickets(projectId))
  if (ready.length === 0) return []

  const now = new Date()

  for (const id of ready) {
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id } })

    await prisma.ticket.update({
      where: { id },
      data: { status: 'open', openedAt: now, dueAt: dueDate(now, ticket.slaDays) },
    })
  }

  return ready
}

/** Комментарий на уровне тикета — единственный канал коммуникации в системе. */
export async function comment(
  ticketId: string,
  author: { role: 'bureau' | 'specialist'; specialistId?: string },
  body: string,
): Promise<void> {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })

  if (author.role === 'specialist') {
    if (!author.specialistId || ticket.specialistId !== author.specialistId) throw new NotYours()
    if (ticket.status === 'blocked') throw new NotOpen(ticket.status)
  }

  await prisma.ticketComment.create({
    data: {
      ticketId,
      authorRole: author.role,
      specialistId: author.role === 'specialist' ? author.specialistId : null,
      body,
    },
  })

  // Время отклика считается по первому содержательному ответу исполнителя (п.12).
  if (author.role === 'specialist' && ticket.openedAt && !ticket.firstResponseAt) {
    await prisma.ticket.update({ where: { id: ticketId }, data: { firstResponseAt: new Date() } })
  }
}

/** Предъявление работы. Приёмка — отдельное действие и делает её бюро. */
export async function submit(ticketId: string, specialistId: string): Promise<void> {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })

  if (ticket.specialistId !== specialistId) throw new NotYours()
  if (ticket.status !== 'open' && ticket.status !== 'revision') throw new NotOpen(ticket.status)

  const now = new Date()

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: 'submitted',
      submittedAt: now,
      firstResponseAt: ticket.firstResponseAt ?? now,
    },
  })
}

/** Возврат на круг. Питает Revision Rate и First Time Right (п.12). */
export async function requestRevision(ticketId: string, note: string): Promise<void> {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })
  if (ticket.status !== 'submitted') throw new NotOpen(ticket.status)

  await prisma.$transaction([
    prisma.ticket.update({
      where: { id: ticketId },
      data: { status: 'revision', revisionRounds: { increment: 1 } },
    }),
    prisma.ticketComment.create({
      data: { ticketId, authorRole: 'bureau', body: note },
    }),
  ])
}

/**
 * Приёмка. Здесь и только здесь меняются счётчики специалиста — из времён
 * самого тикета, а не из чьей-либо оценки (п.12).
 */
export async function accept(ticketId: string): Promise<void> {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })
  if (ticket.status !== 'submitted') throw new NotOpen(ticket.status)

  const acceptedAt = new Date()
  const delta = deliveryDeltaFor({
    openedAt: ticket.openedAt,
    firstResponseAt: ticket.firstResponseAt,
    acceptedAt,
    dueAt: ticket.dueAt,
    revisionRounds: ticket.revisionRounds,
  })

  await prisma.$transaction(async (tx) => {
    await tx.ticket.update({
      where: { id: ticketId },
      data: { status: 'accepted', acceptedAt },
    })

    if (ticket.specialistId) {
      await tx.specialist.update({
        where: { id: ticket.specialistId },
        data: {
          deliveredTickets: { increment: delta.deliveredTickets },
          onTimeTickets: { increment: delta.onTimeTickets },
          firstTimeRightTickets: { increment: delta.firstTimeRightTickets },
          responseMinutesTotal: { increment: delta.responseMinutes },
          revisionRoundsTotal: { increment: delta.revisionRounds },
        },
      })
    }
  })

  await applyGates(ticket.projectId)
  await refreshProjectStatus(ticket.projectId)
}

/** Статус проекта выводится из тикетов, а не ставится руками. */
export async function refreshProjectStatus(projectId: string): Promise<void> {
  const tickets = await prisma.ticket.findMany({
    where: { projectId },
    select: { status: true },
  })

  if (tickets.length === 0) return

  const allAccepted = tickets.every((t) => t.status === 'accepted')
  const anyStarted = tickets.some((t) => t.status !== 'blocked')

  await prisma.project.update({
    where: { id: projectId },
    data: { status: allAccepted ? 'delivered' : anyStarted ? 'delivering' : 'assembled' },
  })
}

/**
 * Что специалист видит по своим тикетам.
 *
 * Постановка задачи выдаётся вместе с открытием тикета: до гейта у специалиста
 * есть название и стадия, но не содержание — входные артефакты ещё не готовы.
 */
export async function ticketsOf(specialistId: string) {
  const tickets = await prisma.ticket.findMany({
    where: { specialistId },
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    include: {
      project: { select: { id: true, title: true, jurisdiction: true, typology: true } },
      dependsOn: { include: { prerequisite: { select: { discipline: true, status: true } } } },
    },
  })

  return tickets.map((t) => ({
    ...t,
    spec: t.status === 'blocked' ? '' : t.spec,
    // Соседи по графу видны как дисциплины, не как люди (п.11).
    waitingOn: t.dependsOn
      .filter((d) => d.prerequisite.status !== 'accepted')
      .map((d) => d.prerequisite.discipline),
  }))
}
