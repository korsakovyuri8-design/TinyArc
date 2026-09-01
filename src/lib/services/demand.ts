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

/** Сколько брифов без команды показывается списком. */
export const LOST_SHOWN = 100

export type LostDemand = {
  rows: LostProject[]
  /** Сколько их всего: список урезан, счёт — нет. */
  total: number
}

/**
 * Проекты, у которых последний прогон не собрал команду.
 *
 * «Последний» здесь принципиально: прогон повторяют после того, как пул
 * пополнился, и проект, собравшийся со второго раза, в этом списке делать
 * нечего.
 *
 * Список с потолком, и это единственная очередь бюро, которой потолок нужен по
 * природе. Остальные — счета, подтверждения, вопросы — убывают, когда бюро
 * работает; эта не убывает никогда: бриф, под который так и не нашлось
 * человека, остаётся черновиком навсегда, и на запуске, с тонким пулом, растёт
 * быстрее всех. Три с половиной тысячи таких брифов давали два мегабайта
 * разметки и секунду на главной странице панели — той, которую открывают
 * каждый день. Показываются ждущие дольше всех: пул пополняют под них.
 */
export async function lostProjects(): Promise<LostDemand> {
  /*
   * Черновик с прогоном — это и есть несобравшийся: удачный прогон переводит
   * проект в «собран», отказной — в «отказано». Поэтому счёт берётся запросом,
   * а не длиной списка, а разбор ниже остаётся страховкой, а не фильтром.
   */
  const where = { status: 'draft', runs: { some: {} } }

  const [total, projects] = await Promise.all([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      // Потолок снимается с начала очереди: дольше всех ждёт тот, кто пришёл
      // раньше, и прогон идёт следом за брифом.
      orderBy: { createdAt: 'asc' },
      take: LOST_SHOWN,
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
    }),
  ])

  const rows = projects
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

  return { rows, total }
}
