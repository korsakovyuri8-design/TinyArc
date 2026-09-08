/**
 * Кто ждёт, чтобы бюро открыло ему доступ.
 *
 * Появилось вместе с закрытым умолчанием доступа. Подтверждённый специалист с
 * закрытым доступом стоит в базе как `active` — то есть считается в пуле, —
 * но движок его не рассматривает вовсе, а на своей доске он читает «ход
 * бюро». Ход был за бюро, и бюро об этом нигде не говорили: человек ждал в
 * тишине, а панель показывала его как часть пула.
 *
 * Очередь считается той же функцией, что говорит человеку причину
 * (`seatOf`), а не отдельным запросом «где подписка пустая». Два места,
 * считающие одно и то же по-своему, однажды разъезжаются, и тогда одна
 * сторона видит очередь, а вторая — нет.
 *
 * Вместе с именем называется последствие: откроет бюро доступ — человек
 * войдёт в отбор или упрётся в следующий гейт. Без этого очередь одинаково
 * зовёт открывать доступ тому, кто завтра работает, и тому, у кого ноль
 * свободных часов, — а это разные звонки.
 */

import { seatOf } from '../seat'
import { prisma } from '../db'

export type AccessWait = {
  id: string
  displayName: string
  email: string
  /** С какого дня человек ждёт. */
  since: Date
  /** Войдёт ли он в отбор сразу, как доступ откроют. */
  readyToWork: boolean
  /** Что останется в пути, если не войдёт. `null` — не останется ничего. */
  nextGate: string | null
}

/**
 * Потолка нет намеренно.
 *
 * На той стороне человек, который прошёл разбор и ждёт одного нажатия;
 * срезанная строка — это тот, кому не открыли, потому что его не показали.
 * Число ограничено сверху разобранными заявками, а не историей бюро.
 */
export async function awaitingAccess(): Promise<AccessWait[]> {
  const rows = await prisma.specialist.findMany({
    where: { status: 'active', subscription: 'none' },
    select: {
      id: true,
      displayName: true,
      email: true,
      createdAt: true,
      status: true,
      subscription: true,
      portfolioRating: true,
      weeklyCapacityHours: true,
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })

  return rows
    .filter((row) => seatOf(row).gate === 'subscription')
    .map((row) => {
      /*
       * Что будет после нажатия — спрашивается у той же функции с открытым
       * доступом. Проверять гейты здесь заново значило бы завести второй
       * порядок проверок рядом с первым.
       */
      const after = seatOf({ ...row, subscription: 'founding' })

      return {
        id: row.id,
        displayName: row.displayName,
        email: row.email,
        since: row.createdAt,
        readyToWork: after.inSelection,
        nextGate: after.inSelection ? null : after.headline,
      }
    })
}
