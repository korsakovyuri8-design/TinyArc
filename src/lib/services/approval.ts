/**
 * Подтверждение стадии заказчиком (концепт, п.12б).
 *
 * Бюро принимает работу у специалиста — это «сделано как заказано». Заказчик
 * подтверждает стадию — это «заказано было именно это». Второго до сих пор не
 * существовало: проект шёл от концепции к документации, ни разу не спросив
 * человека, который за него платит.
 *
 * На пилоте это всплывает одной фразой — «я этого не согласовывал», — и
 * возразить нечем: подтверждения нет ни в какой записи.
 */

import { DOC_STAGE_ORDER, type DocStage } from '@/engine/taxonomy'
import { awaitingClient } from '@/engine/relay'
import type { RelayTicket } from '@/engine/relay'
import { prisma } from '../db'

/** Дольше этого стадия ждёт заказчика — бюро пора спросить. */
export const APPROVAL_NUDGE_HOURS = 48

export class ApprovalRefused extends Error {}

export async function approvedStages(projectId: string): Promise<DocStage[]> {
  const rows = await prisma.stageApproval.findMany({
    where: { projectId },
    select: { stage: true },
  })

  return rows
    .map((r) => r.stage as DocStage)
    .sort((a, b) => DOC_STAGE_ORDER[a] - DOC_STAGE_ORDER[b])
}

async function relayTickets(projectId: string): Promise<RelayTicket[]> {
  const tickets = await prisma.ticket.findMany({
    where: { projectId },
    include: { dependsOn: true },
  })

  return tickets.map((t) => ({
    id: t.id,
    status: t.status as RelayTicket['status'],
    stage: t.stage as DocStage,
    dependsOn: t.dependsOn.map((d) => d.prerequisiteId),
  }))
}

/** Стадии, законченные бюро и ждущие слова заказчика. */
export async function stagesAwaitingClient(projectId: string): Promise<DocStage[]> {
  const [tickets, approved] = await Promise.all([
    relayTickets(projectId),
    approvedStages(projectId),
  ])

  return awaitingClient(tickets, approved)
}

/**
 * Заказчик подтверждает стадию.
 *
 * Подтвердить можно только то, что бюро уже приняло целиком: иначе человек
 * подписывается под работой, которой ещё нет, и подтверждение перестаёт
 * что-либо значить. Повторное подтверждение молча проходит — кнопку жмут
 * дважды чаще, чем кажется.
 */
export async function approveStage(
  projectId: string,
  stage: DocStage,
  note: string,
): Promise<void> {
  const ready = await stagesAwaitingClient(projectId)

  if (!ready.includes(stage)) {
    const already = (await approvedStages(projectId)).includes(stage)
    if (already) return

    throw new ApprovalRefused(
      'The bureau has not finished this stage yet. There is nothing to confirm.',
    )
  }

  /*
   * Уникальный ключ «проект + стадия» не даёт подтвердить дважды, и это
   * правильная защита — но её срабатывание не должно выглядеть поломкой.
   * Заказчик, нажавший кнопку дважды, получал грубую ошибку базы вместо
   * тишины, хотя стадия подтверждена и всё в порядке.
   */
  try {
    await prisma.stageApproval.create({
      data: { projectId, stage, note: note.trim() },
    })
  } catch {
    // Уже подтверждено — вторым нажатием или вторым запросом. Это не ошибка.
    return
  }
}

export type PendingApproval = {
  projectId: string
  projectTitle: string
  stage: DocStage
  /** Сколько часов стадия ждёт слова заказчика. */
  hours: number
}

/**
 * Стадии, ждущие заказчика, по всем проектам.
 *
 * Нужно бюро: молчание заказчика останавливает выпуск не хуже просрочки
 * исполнителя, и висеть оно должно на видном месте, а не в его кабинете.
 */
export async function awaitingApproval(now = new Date()): Promise<PendingApproval[]> {
  const projects = await prisma.project.findMany({
    where: { status: { in: ['assembled', 'delivering'] } },
    select: { id: true, title: true },
  })

  const pending: PendingApproval[] = []

  for (const project of projects) {
    const stages = await stagesAwaitingClient(project.id)
    if (stages.length === 0) continue

    // Отсчёт от приёмки последней задачи стадии: с этого момента мяч у клиента.
    for (const stage of stages) {
      const last = await prisma.ticket.findFirst({
        where: { projectId: project.id, stage, status: 'accepted' },
        orderBy: { acceptedAt: 'desc' },
        select: { acceptedAt: true },
      })

      pending.push({
        projectId: project.id,
        projectTitle: project.title,
        stage,
        hours: last?.acceptedAt
          ? (now.getTime() - last.acceptedAt.getTime()) / 3_600_000
          : 0,
      })
    }
  }

  return pending.sort((a, b) => b.hours - a.hours)
}
