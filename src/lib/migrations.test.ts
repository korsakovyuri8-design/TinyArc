/**
 * Применённую миграцию менять нельзя.
 *
 * Написано по факту дорогой ошибки. Схема правилась пять раз, и каждый раз я
 * перегенерировал `0001_init` целиком — это было верно ровно до первой
 * выкладки. После неё Prisma хранит контрольную сумму применённой миграции и
 * при расхождении отказывается стартовать: «migration was modified after it
 * was applied». Боевые выкладки падали неделю, на домене жила сборка недельной
 * давности, а локально всё было зелёное — потому что локальная база живёт
 * через `db push`, без миграций вовсе.
 *
 * Поэтому суммы зафиксированы здесь. Новая миграция добавляется свободно:
 * тест проверяет только то, что уже уехало в бой и потому неприкосновенно.
 *
 * Если этот тест упал — не правьте сумму. Верните файл как был и вынесите
 * изменение в новую миграцию:
 *
 *   npx prisma migrate diff \
 *     --from-schema <схема до изменения> \
 *     --to-schema prisma/schema.postgres.prisma --script
 */

import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const DIR = join(import.meta.dirname, '..', '..', 'prisma', 'migrations')

/** Суммы миграций, которые уже применены на боевой базе. */
const APPLIED: Record<string, string> = {
  '0001_init': '257aaadb1a1cb514b30348baf91faf85',
}

function checksum(name: string): string {
  return createHash('md5')
    .update(readFileSync(join(DIR, name, 'migration.sql')))
    .digest('hex')
}

describe('миграции', () => {
  it('применённые не менялись', () => {
    for (const [name, expected] of Object.entries(APPLIED)) {
      expect(checksum(name), `${name} изменена после применения`).toBe(expected)
    }
  })

  it('каталог не пуст и все зафиксированные на месте', () => {
    const names = readdirSync(DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)

    expect(names.length).toBeGreaterThan(0)
    for (const name of Object.keys(APPLIED)) expect(names).toContain(name)
  })

  it('каждая миграция — непустой SQL', () => {
    const names = readdirSync(DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)

    for (const name of names) {
      const sql = readFileSync(join(DIR, name, 'migration.sql'), 'utf8').trim()
      expect(sql.length, `${name} пуста`).toBeGreaterThan(0)
    }
  })
})
