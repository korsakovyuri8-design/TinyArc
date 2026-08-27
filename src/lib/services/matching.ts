/**
 * Прогон сборки: движок решает, база запоминает.
 *
 * Разделение важное. Всё, что решает, кто попадёт в команду, живёт в
 * src/engine и не знает про базу. Здесь только чтение пула, запись результата и
 * заведение графа тикетов.
 */

import { assemble } from '@/engine/assemble'
import { planTickets } from '@/engine/relay'
import type { Assembly } from '@/engine/types'
import type { Discipline } from '@/engine/taxonomy'
import { prisma } from '../db'
import { toList, toProfile, toRequirements } from '../rows'
import { applyGates } from './relay'

/** Пул, из которого вообще можно выбирать: только подтверждённые специалисты. */
export async function activePool() {
  const rows = await prisma.specialist.findMany({ where: { status: 'active' } })
  return rows.map(toProfile)
}

export class AssemblyLocked extends Error {
  constructor(status: string) {
    super(
      `Проект в статусе «${status}»: пересобрать команду нельзя. Тикеты уже в работе, а их история — это метрики специалистов.`,
    )
    this.name = 'AssemblyLocked'
  }
}

/** Статусы, в которых пересборка ещё ничего не ломает. */
const REASSEMBLABLE = new Set(['draft', 'rejected', 'assembled'])

export async function runAssembly(projectId: string): Promise<{ runId: string; assembly: Assembly }> {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })

  if (!REASSEMBLABLE.has(project.status)) throw new AssemblyLocked(project.status)

  const pool = await activePool()
  const assembly = assemble(pool, toRequirements(project))

  const runId = await prisma.$transaction(async (tx) => {
    const run = await tx.matchRun.create({
      data: {
        projectId,
        pooledCount: assembly.pooledCount,
        survivedCount: assembly.survivedCount,
        outcome: assembly.outcome,
        notes: assembly.notes,
      },
    })

    // Разбор балла сохраняется целиком и навсегда: метрики специалиста
    // изменятся, а объяснение принятого решения меняться не должно (п.9).
    for (const candidate of assembly.candidates) {
      await tx.candidate.create({
        data: {
          runId: run.id,
          specialistId: candidate.specialist.id,
          discipline: candidate.discipline,
          roleSpecializationsJson: toList(candidate.role.specializations),
          roleMode: candidate.role.mode,
          passed: candidate.passed,
          failedGate: candidate.failedGate ?? '',
          portfolioRating: candidate.breakdown.portfolioRating,
          deliveryScore: candidate.breakdown.deliveryScore,
          historyWeight: candidate.breakdown.historyWeight,
          relevance: candidate.breakdown.relevance,
          quality: candidate.breakdown.quality,
          availability: candidate.breakdown.availability,
          score: candidate.breakdown.score,
          rank: candidate.rank,
        },
      })
    }

    // Прошлая сборка снимается целиком: половина старой команды и половина
    // новой — это не команда.
    await tx.ticket.deleteMany({ where: { projectId } })
    await tx.teamSlot.deleteMany({ where: { projectId } })

    if (assembly.outcome !== 'ok') {
      await tx.project.update({
        where: { id: projectId },
        data: {
          status: assembly.outcome === 'rejected' ? 'rejected' : 'draft',
          rejectionReason: assembly.notes,
        },
      })

      return run.id
    }

    for (const member of assembly.team) {
      await tx.teamSlot.create({
        data: {
          projectId,
          runId: run.id,
          specialistId: member.specialist.id,
          discipline: member.discipline,
          roleSpecializationsJson: toList(member.role.specializations),
          roleMode: member.role.mode,
          isSignatory: member.isSignatory,
          score: member.score,
        },
      })
    }

    const assignee = new Map<Discipline, string>(
      assembly.team.map((m) => [m.discipline, m.specialist.id]),
    )

    const plans = planTickets(
      toRequirements(project).targetStage,
      assembly.team.map((m) => m.discipline),
    )

    const idByKey = new Map<string, string>()

    for (const plan of plans) {
      const ticket = await tx.ticket.create({
        data: {
          projectId,
          discipline: plan.discipline,
          stage: plan.stage,
          title: plan.title,
          spec: plan.spec,
          slaHours: plan.slaHours,
          specialistId: assignee.get(plan.discipline) ?? null,
          status: 'blocked',
        },
      })

      idByKey.set(plan.key, ticket.id)
    }

    for (const plan of plans) {
      for (const dependency of plan.dependsOn) {
        const prerequisiteId = idByKey.get(dependency)
        if (!prerequisiteId) continue

        await tx.ticketDependency.create({
          data: { dependentId: idByKey.get(plan.key)!, prerequisiteId },
        })
      }
    }

    await tx.project.update({
      where: { id: projectId },
      data: { status: 'assembled', rejectionReason: '' },
    })

    return run.id
  })

  // Тикеты без зависимостей открывает тот же гейт, что и все остальные: особого
  // пути для первого шага нет.
  if (assembly.outcome === 'ok') await applyGates(projectId)

  return { runId, assembly }
}

/** Последний прогон проекта со всем разбором — это и есть «почему эта команда». */
export async function latestRun(projectId: string) {
  return prisma.matchRun.findFirst({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    include: {
      candidates: { include: { specialist: true } },
      slots: { include: { specialist: true } },
    },
  })
}
