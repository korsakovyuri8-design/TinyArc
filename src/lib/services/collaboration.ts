/**
 * Учёт сработанности пар.
 *
 * Считается из того, что и так происходит: закрытых запросов между
 * дисциплинами, споров, дошедших до арбитра, и совместно доведённых проектов.
 * Поля «оцените коллегу» здесь нет и не будет — это тот же принцип, что и с
 * метриками специалиста (п.12).
 */

import { pairKey, type PairHistory } from '@/engine/collaboration'
import { prisma } from '../db'

/** Пара всегда хранится в одном порядке, поэтому её не нужно искать дважды. */
function ordered(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a]
}

async function bump(
  a: string,
  b: string,
  field: 'projects' | 'requestsAnswered' | 'conflicts',
): Promise<void> {
  // Человек не работает в паре с самим собой, даже когда закрывает две роли.
  if (a === b) return

  const [aId, bId] = ordered(a, b)

  await prisma.collaboration.upsert({
    where: { aId_bId: { aId, bId } },
    create: { aId, bId, [field]: 1 },
    update: { [field]: { increment: 1 } },
  })
}

export async function recordRequestAnswered(asked: string, answered: string): Promise<void> {
  await bump(asked, answered, 'requestsAnswered')
}

export async function recordConflict(a: string, b: string): Promise<void> {
  await bump(a, b, 'conflicts')
}

/**
 * Засчитывает совместный проект всем парам состава.
 *
 * Вызывается один раз, когда проект закрыт целиком: «работали вместе» — это
 * про доведённую работу, а не про то, что людей поставили в один список.
 */
export async function recordProjectTogether(projectId: string): Promise<void> {
  const slots = await prisma.teamSlot.findMany({
    where: { projectId },
    select: { specialistId: true },
  })

  const ids = [...new Set(slots.map((s) => s.specialistId))]

  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      await bump(ids[i], ids[j], 'projects')
    }
  }
}

/**
 * История по парам внутри пула — вход сборки команды.
 *
 * Читается один раз на прогон: движку нужна карта, а не запрос на каждую пару.
 */
export async function historyFor(specialistIds: string[]): Promise<Map<string, PairHistory>> {
  if (specialistIds.length === 0) return new Map()

  const rows = await prisma.collaboration.findMany({
    where: { aId: { in: specialistIds }, bId: { in: specialistIds } },
  })

  return new Map(
    rows.map((row) => [
      pairKey(row.aId, row.bId),
      { projects: row.projects, requestsAnswered: row.requestsAnswered, conflicts: row.conflicts },
    ]),
  )
}
