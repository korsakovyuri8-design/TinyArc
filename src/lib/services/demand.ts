/**
 * Спрос, который мы не взяли.
 *
 * Прогон, не собравший команду, до сих пор заканчивался ничем: проект оставался
 * в черновике, клиент видел сообщение, бюро — ничего. Между тем это самая
 * дорогая информация, какая у бюро есть на запуске: не «кого бы нанять вообще»,
 * а «за какой заказ нам уже заплатили бы, будь у нас этот человек».
 *
 * Отличается от дыр в пуле (engine/readiness) тем, что считается по живым
 * брифам, а не по перебору сценариев. Дыра говорит, чего не хватает в принципе;
 * этот список — чего не хватило конкретному человеку с участком.
 */

import type { AssemblyGap } from '@/engine/types'
import type { Jurisdiction } from '@/engine/taxonomy'
import { parseGap } from '../gap'
import { prisma } from '../db'

export type LostProject = {
  projectId: string
  title: string
  jurisdiction: Jurisdiction
  /** incomplete — роль не закрыта; no_signatory — некому подписать. */
  outcome: string
  gap: AssemblyGap | null
  since: Date
}

/**
 * Проекты, у которых последний прогон не собрал команду.
 *
 * «Последний» здесь принципиально: прогон повторяют после того, как пул
 * пополнился, и проект, собравшийся со второго раза, в этом списке делать
 * нечего.
 */
export async function lostProjects(): Promise<LostProject[]> {
  const projects = await prisma.project.findMany({
    where: { status: 'draft' },
    select: {
      id: true,
      title: true,
      jurisdiction: true,
      createdAt: true,
      runs: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { outcome: true, gapJson: true, createdAt: true },
      },
    },
  })

  return projects
    .flatMap((project) => {
      const run = project.runs[0]
      if (!run || run.outcome === 'ok' || run.outcome === 'rejected') return []

      return [
        {
          projectId: project.id,
          title: project.title,
          jurisdiction: project.jurisdiction as Jurisdiction,
          outcome: run.outcome,
          gap: parseGap(run.gapJson),
          since: run.createdAt,
        },
      ]
    })
    .sort((a, b) => a.since.getTime() - b.since.getTime())
}
