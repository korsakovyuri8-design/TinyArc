/**
 * Комплект документации: то, за что заказчик заплатил.
 *
 * До сих пор он не видел ни одного файла. Артефакты жили на тикетах, тикеты —
 * у исполнителей, а заказчику доставалась подпись статуса: «Закрыт». Человек,
 * купивший комплект документации, получал слово вместо комплекта.
 *
 * Что сюда входит и что нет. Входит принятая работа: непринятое — это ещё не
 * документация, а черновик в чужой папке. Не входят сгенерированные
 * изображения: они помечены в записях как полученные моделью и в комплект не
 * входят ни на одной стадии (п.12а). Они остаются материалом работы, и
 * заказчик видит их отдельно, если видит вообще.
 */

import { DOC_STAGE_ORDER, type Discipline, type DocStage } from '@/engine/taxonomy'
import { prisma } from '../db'

export type PackageFile = {
  id: string
  name: string
  url: string
  storageKey: string | null
  kind: string
  discipline: Discipline
  createdAt: Date
}

export type PackageStage = {
  stage: DocStage
  /** Подтверждена ли стадия заказчиком: до этого комплект по ней не окончателен. */
  approved: boolean
  files: PackageFile[]
}

/**
 * Комплект по стадиям.
 *
 * Собирается по мере закрытия стадий, а не выдаётся разом в конце. Заказчик
 * заплатил за стадию — он получает её файлы, когда она закрыта, и не ждёт
 * последней. Ожидание всего комплекта до самого конца — это привычка
 * бумажного бюро, а не необходимость.
 */
export async function packageOf(projectId: string): Promise<PackageStage[]> {
  const [tickets, approvals] = await Promise.all([
    prisma.ticket.findMany({
      where: { projectId, status: 'accepted' },
      select: {
        stage: true,
        discipline: true,
        // Выборка поимённая: полная строка тикета несёт исполнителя, а через
        // него — почту и ключ доступа. Клиенту это не показывается (п.13).
        artifacts: {
          where: { source: 'human' },
          select: {
            id: true,
            name: true,
            url: true,
            storageKey: true,
            kind: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    }),
    prisma.stageApproval.findMany({ where: { projectId }, select: { stage: true } }),
  ])

  const approved = new Set(approvals.map((a) => a.stage))
  const byStage = new Map<DocStage, PackageFile[]>()

  for (const ticket of tickets) {
    const stage = ticket.stage as DocStage
    const files = byStage.get(stage) ?? []

    for (const artifact of ticket.artifacts) {
      files.push({ ...artifact, discipline: ticket.discipline as Discipline })
    }

    byStage.set(stage, files)
  }

  return [...byStage.entries()]
    .map(([stage, files]) => ({ stage, approved: approved.has(stage), files }))
    .filter((s) => s.files.length > 0)
    .sort((a, b) => DOC_STAGE_ORDER[a.stage] - DOC_STAGE_ORDER[b.stage])
}

/** Сколько файлов в комплекте. Нужно, чтобы не показывать пустой раздел. */
export function fileCount(stages: PackageStage[]): number {
  return stages.reduce((sum, s) => sum + s.files.length, 0)
}
