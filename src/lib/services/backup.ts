/**
 * Выгрузка базы и восстановление из неё.
 *
 * Формат и порядок таблиц — в `src/lib/backup.ts`; здесь только работа с
 * базой. Обе стороны идут страницами: держать базу в памяти целиком нельзя ни
 * при выгрузке, ни при восстановлении, а в тот день, когда это понадобится
 * по-настоящему, база будет больше, чем сегодня.
 */

import type { PrismaClient } from '@/generated/prisma/client'
import {
  BACKUP_FORMAT,
  TABLES,
  dateFields,
  decode,
  encode,
  revive,
  schemaText,
  type Header,
  type Table,
} from '../backup'

/** Записей за раз. Компромисс между числом запросов и памятью. */
const PAGE = 500

/**
 * Клиент базы, каким его видит выгрузка.
 *
 * Таблицы перебираются по именам из списка, а типизированного способа сказать
 * «любая таблица этого клиента» у Prisma нет: у каждой свой тип строки, и
 * именно этого мы здесь не хотим знать. Сужение до трёх методов — граница, за
 * которой типы кончаются, и она названа явно, а не спрятана в `any` по месту.
 */
type Table_ = {
  count(): Promise<number>
  findMany(args: unknown): Promise<Record<string, unknown>[]>
  createMany(args: unknown): Promise<{ count: number }>
}

export type Client = PrismaClient

/** Доступ к таблице по имени: имена приходят из нашего же списка. */
function tableOf(prisma: Client, table: Table): Table_ {
  const key = table.charAt(0).toLowerCase() + table.slice(1)

  return (prisma as unknown as Record<string, Table_>)[key]!
}

/**
 * Выгрузка строками.
 *
 * Первой идёт строка заголовка со счётчиками: по ней восстановление понимает,
 * что файл дочитан целиком, а человек — что в копии вообще есть.
 */
export async function* dump(prisma: Client): AsyncGenerator<string> {
  const counts: Record<string, number> = {}

  for (const table of TABLES) counts[table] = await tableOf(prisma, table).count()

  const header: Header = {
    backup: BACKUP_FORMAT,
    createdAt: new Date().toISOString(),
    counts,
  }

  yield encode({ header })

  for (const table of TABLES) {
    let skip = 0

    for (;;) {
      const rows = await tableOf(prisma, table).findMany({
        orderBy: { id: 'asc' },
        skip,
        take: PAGE,
      })

      if (rows.length === 0) break

      for (const row of rows) yield encode({ table, row })

      skip += rows.length
      if (rows.length < PAGE) break
    }
  }
}

export class RestoreRefused extends Error {}

/**
 * Восстановление в пустую базу.
 *
 * Непустая база — отказ, и это главное правило здесь. Восстановление поверх
 * живых данных выглядит как «дополнили копией», а на деле смешивает два
 * состояния мира: часть строк из копии, часть сегодняшних, ссылки между ними
 * как повезёт. Разбирать такое некому и нечем.
 */
export async function restore(
  prisma: Client,
  lines: AsyncIterable<string> | Iterable<string>,
): Promise<Record<string, number>> {
  for (const table of TABLES) {
    const existing = await tableOf(prisma, table).count()

    if (existing > 0) {
      throw new RestoreRefused(
        `Таблица ${table} не пуста (${existing}). Восстановление идёт только в пустую базу: смешивать копию с живыми данными нельзя.`,
      )
    }
  }

  const dates = dateFields(schemaText())
  const written: Record<string, number> = {}

  let header: Header | undefined
  let batchTable: Table | undefined
  let batch: Record<string, unknown>[] = []

  async function flush() {
    if (!batchTable || batch.length === 0) return

    await tableOf(prisma, batchTable).createMany({ data: batch })
    written[batchTable] = (written[batchTable] ?? 0) + batch.length
    batch = []
  }

  for await (const text of lines) {
    const line = text.trim()
    if (!line) continue

    const parsed = decode(line)

    if ('header' in parsed) {
      header = parsed.header

      if (header.backup !== BACKUP_FORMAT) {
        throw new RestoreRefused(
          `Копия версии ${header.backup}, а эта сборка понимает ${BACKUP_FORMAT}.`,
        )
      }

      continue
    }

    if (!header) throw new RestoreRefused('В копии нет заголовка: это не наш файл или он обрезан с начала.')

    if (parsed.table !== batchTable) {
      await flush()
      batchTable = parsed.table
    }

    batch.push(revive(parsed.row, dates.get(parsed.table) ?? new Set()))

    if (batch.length >= PAGE) await flush()
  }

  await flush()

  /*
   * Сверка со счётчиками заголовка. Обрезанный файл читается без единой
   * ошибки — он просто короче, — и без сверки восстановление объявило бы
   * успехом половину базы.
   */
  for (const table of TABLES) {
    const expected = header?.counts[table] ?? 0
    const actual = written[table] ?? 0

    if (expected !== actual) {
      throw new RestoreRefused(
        `Таблица ${table}: в копии заявлено ${expected}, записано ${actual}. Файл обрезан или повреждён.`,
      )
    }
  }

  return written
}
