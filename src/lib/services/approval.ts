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
import { TEXT_MAX, bounded } from '../text'

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
  const said = bounded(note, TEXT_MAX.note)
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
      data: { projectId, stage, note: said },
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

  if (projects.length === 0) return []

  /*
   * Три запроса на всю очередь, а не по три на проект.
   *
   * Прежде очередь спрашивала базу отдельно про каждый живой проект и ещё раз
   * про каждую его стадию. Замерено на живом Postgres: двадцать миллисекунд
   * при десяти проектах, двести двадцать при ста двадцати — линейно, и это
   * была самая дорогая часть панели, которую бюро открывает по многу раз в
   * день. Круговых обращений к базе здесь набиралось по три на проект, а
   * стоит каждое из них не столько, сколько работа, сколько сама дорога.
   */
  const ids = projects.map((p) => p.id)

  const [tickets, approvals] = await Promise.all([
    prisma.ticket.findMany({
      where: { projectId: { in: ids } },
      select: {
        id: true,
        projectId: true,
        status: true,
        stage: true,
        acceptedAt: true,
        dependsOn: { select: { prerequisiteId: true } },
      },
    }),
    prisma.stageApproval.findMany({
      where: { projectId: { in: ids } },
      select: { projectId: true, stage: true },
    }),
  ])

  /** Группировка по проекту: движок считает по одному проекту за раз. */
  function byProject<T extends { projectId: string }>(rows: T[]): Map<string, T[]> {
    const map = new Map<string, T[]>()

    for (const row of rows) {
      const list = map.get(row.projectId)
      if (list) list.push(row)
      else map.set(row.projectId, [row])
    }

    return map
  }

  const ticketsOf = byProject(tickets)
  const approvedOf = byProject(approvals)

  const pending: PendingApproval[] = []

  for (const project of projects) {
    const own = ticketsOf.get(project.id) ?? []
    if (own.length === 0) continue

    const relay: RelayTicket[] = own.map((t) => ({
      id: t.id,
      status: t.status as RelayTicket['status'],
      stage: t.stage as DocStage,
      dependsOn: t.dependsOn.map((d) => d.prerequisiteId),
    }))

    const approved = (approvedOf.get(project.id) ?? []).map((r) => r.stage as DocStage)

    for (const stage of awaitingClient(relay, approved)) {
      /*
       * Отсчёт от приёмки последней задачи стадии: с этого момента мяч у
       * клиента. Берётся из тех же задач, что уже прочитаны, — отдельный
       * запрос за максимумом был третьим обращением на каждую стадию.
       */
      const last = own
        .filter((t) => t.stage === stage && t.status === 'accepted' && t.acceptedAt)
        .reduce<Date | null>(
          (latest, t) => (!latest || t.acceptedAt! > latest ? t.acceptedAt! : latest),
          null,
        )

      pending.push({
        projectId: project.id,
        projectTitle: project.title,
        stage,
        hours: last ? (now.getTime() - last.getTime()) / 3_600_000 : 0,
      })
    }
  }

  return pending.sort((a, b) => b.hours - a.hours)
}
