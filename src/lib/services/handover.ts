/**
 * Выход специалиста из проекта и передача роли.
 *
 * До сих пор выпавший участник останавливал проект насмерть: отказаться он не
 * мог, а назначить замену бюро не вправе — команду собирает алгоритм (п.7).
 * Единственным исходом была тишина, потом просрочка, потом разбирательство.
 *
 * Замена берётся из ранжированного списка того же прогона: порядок посчитан
 * тогда же, когда собирался состав, и следующий по рангу — это продолжение
 * прежнего решения, а не новое. Гейты проверяются заново по сегодняшнему
 * профилю (см. engine/replacement).
 *
 * Что переходит и что остаётся. Переходят незакрытые задачи роли. Остаётся
 * принятое: сданная и принятая работа принадлежит тому, кто её сделал, и его
 * метрикам — переписывать историю ради стройности карточки нельзя (п.12).
 */

import { packagesOf, pickReplacement } from '@/engine/replacement'
import { SPECIALIZATIONS, type Specialization } from '@/engine/taxonomy'
import type { RequiredRole } from '@/engine/taxonomy'
import { parseList, toProfile, toRequirements } from '../rows'
import { prisma } from '../db'
import { comment } from './relay'

/** Статусы задач, которые ещё не закрыты и потому переходят к заменяющему. */
const OPEN_STATUSES = ['blocked', 'open', 'in_progress', 'revision'] as const

export type HandoverResult =
  | { replaced: true; from: string; to: string; tickets: number }
  | { replaced: false; reason: 'no_candidates' | 'none_passes'; discipline: string }

export class HandoverRefused extends Error {}

/**
 * Специалист выходит из роли на проекте.
 *
 * Отказ не бесплатен для проекта, поэтому он и не мгновенный жест: причина
 * обязательна и остаётся в тикетах. Это не оценка человека — поля оценки в
 * системе нет, — а факт, который увидит и бюро, и тот, кто придёт на замену.
 */
export async function stepOut(
  specialistId: string,
  projectId: string,
  reason: string,
): Promise<HandoverResult> {
  if (!reason.trim()) {
    throw new HandoverRefused('Leaving is not recorded without a reason: whoever replaces you will read it.')
  }

  const slot = await prisma.teamSlot.findFirst({
    where: { projectId, specialistId },
    include: { run: true },
  })

  if (!slot) throw new HandoverRefused('You do not hold a role on this project.')

  const [project, allSlots, ranked, withdrawn] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { id: projectId } }),
    prisma.teamSlot.findMany({ where: { projectId }, include: { specialist: true } }),
    prisma.candidate.findMany({
      where: { runId: slot.runId, discipline: slot.discipline, passed: true },
      orderBy: { rank: 'asc' },
      select: { specialistId: true, rank: true },
    }),
    // Кто уже уходил с этого проекта. Предлагать роль тому, кто от неё
    // отказался, — не «второй шанс», а неуважение к его же словам.
    prisma.withdrawal.findMany({ where: { projectId }, select: { specialistId: true } }),
  ])

  const role: RequiredRole = {
    discipline: slot.discipline as RequiredRole['discipline'],
    specializations: parseList<Specialization>(slot.roleSpecializationsJson, SPECIALIZATIONS),
    mode: slot.roleMode === 'all' ? 'all' : 'any',
  }

  const staying = allSlots.filter((s) => s.specialistId !== specialistId)

  // Профили кандидатов читаем сейчас, а не берём из прогона: гейты проверяются
  // по сегодняшнему состоянию, иначе на проект придёт человек, у которого
  // месяц назад была ёмкость.
  const candidateRows = await prisma.specialist.findMany({
    where: { id: { in: ranked.map((c) => c.specialistId) }, status: 'active' },
  })

  const choice = pickReplacement({
    ranked,
    taken: [...allSlots.map((s) => s.specialistId), ...withdrawn.map((w) => w.specialistId)],
    leaving: specialistId,
    profiles: new Map(candidateRows.map((row) => [row.id, toProfile(row)])),
    requirements: toRequirements(project),
    role,
    teamPackages: packagesOf(staying.map((s) => toProfile(s.specialist))),
  })

  const open = await prisma.ticket.findMany({
    where: { projectId, specialistId, status: { in: [...OPEN_STATUSES] } },
    select: { id: true },
  })

  if (!choice.found) {
    // Замены нет. Роль остаётся без исполнителя, задачи — без адресата, и это
    // должно быть видно, а не спрятано: проект возвращается бюро.
    await prisma.$transaction([
      prisma.withdrawal.create({
        data: {
          projectId,
          specialistId,
          discipline: slot.discipline,
          reason: reason.trim(),
        },
      }),
      prisma.teamSlot.delete({ where: { id: slot.id } }),
      prisma.ticket.updateMany({
        where: { id: { in: open.map((t) => t.id) } },
        data: { specialistId: null, status: 'blocked' },
      }),
    ])

    for (const ticket of open) {
      await comment(
        ticket.id,
        { role: 'bureau' },
        `The contributor has left the project: ${reason.trim()} No replacement was found in the run — the task is waiting on the bureau.`,
      )
    }

    return { replaced: false, reason: choice.reason, discipline: slot.discipline }
  }

  await prisma.$transaction([
    prisma.withdrawal.create({
      data: {
        projectId,
        specialistId,
        discipline: slot.discipline,
        reason: reason.trim(),
        replacedById: choice.specialistId,
      },
    }),
    prisma.teamSlot.update({
      where: { id: slot.id },
      data: { specialistId: choice.specialistId },
    }),
    prisma.ticket.updateMany({
      where: { id: { in: open.map((t) => t.id) } },
      // Статус сбрасывается на «открыт»: заменяющий берёт задачу сам, как
      // любую другую. Унаследовать чужое «в работе» значит соврать в метриках
      // обоим — время реакции считается от взятия.
      data: { specialistId: choice.specialistId, status: 'open', claimedAt: null },
    }),
  ])

  for (const ticket of open) {
    await comment(
      ticket.id,
      { role: 'bureau' },
      `The role has been handed over: the previous contributor left the project. Reason: ${reason.trim()}`,
    )
  }

  return {
    replaced: true,
    from: specialistId,
    to: choice.specialistId,
    tickets: open.length,
  }
}

/** Проекты, где человек ведёт роль. Нужен экрану выхода. */
export async function rolesOf(specialistId: string) {
  return prisma.teamSlot.findMany({
    where: { specialistId },
    include: { project: { select: { id: true, title: true, status: true } } },
    orderBy: { createdAt: 'asc' },
  })
}
