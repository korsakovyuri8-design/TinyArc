/**
 * Заготовки состояния для сценариев.
 *
 * Сценарий, который ищет на стенде готовое состояние — открытую задачу,
 * неоплаченный счёт, — зависит от своего места в цепочке. Порядок однажды
 * поменяют, состояния не окажется, и проверки начнут молча пропускаться,
 * оставаясь зелёными: отсутствие подопытного выглядит как отсутствие проблемы.
 *
 * Поэтому состояние создаётся, а не ищется. Общее — здесь, чтобы два сценария
 * не создавали его двумя разными способами.
 */

import { DOC_STAGES, type DocStage } from '../src/engine/taxonomy'
import { priceStage } from '../src/engine/pricing'
import { prisma } from '../src/lib/db'

/** Неоплаченный счёт. Если такого на стенде нет — выставляется свой. */
export async function unpaidInvoice(): Promise<{ id: string } | null> {
  const issued = await prisma.invoice.findFirst({
    where: { status: 'issued' },
    select: { id: true },
  })

  if (issued) return issued

  for (const project of await prisma.project.findMany({
    select: { id: true, typology: true, jurisdiction: true, areaSqm: true, targetStage: true },
  })) {
    const live = await prisma.invoice.findMany({
      where: { projectId: project.id, status: { not: 'void' } },
      select: { stage: true },
    })

    const taken = new Set(live.map((row) => row.stage))
    const stage = DOC_STAGES.find((s) => !taken.has(s))
    if (!stage) continue

    const basis = priceStage(
      {
        typology: project.typology as never,
        jurisdiction: project.jurisdiction as never,
        areaSqm: project.areaSqm,
        targetStage: project.targetStage as DocStage,
      },
      stage,
    )

    return prisma.invoice.create({
      data: {
        projectId: project.id,
        stage,
        liveStage: stage,
        amount: basis.amount,
        currency: basis.currency,
        basisJson: JSON.stringify(basis),
      },
      select: { id: true },
    })
  }

  return null
}
