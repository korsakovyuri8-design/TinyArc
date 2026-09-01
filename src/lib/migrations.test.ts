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
 * Поэтому суммы зафиксированы здесь — все, а не только уже выложенные.
 * Миграция неприкосновенна с момента коммита, а не с момента выкладки: между
 * ними проходит время, за которое легко забыть, что файл уже уехал. Правило
 * без исключений дешевле правила с оговоркой.
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

/** Суммы всех миграций. Новая добавляется сюда вместе с самим файлом. */
const APPLIED: Record<string, string> = {
  '0001_init': '257aaadb1a1cb514b30348baf91faf85',
  '0002_intake_handover_dialogue': '414099d7a44b092a3f3c8d910499bdfa',
  '0003_stage_approval': '44312f1e3ca7d22b518f2af5c027f3cb',
  '0004_billing': 'ccc0df1d1c68d45129bee652c48f4375',
  '0005_consent': 'c3021fc54148980374597dc1ee249eec',
  '0006_invoice_void': '4c41cd2d2b9c2af3ffe3ab1fa7c33d2f',
  '0007_notifications': '338cce0a88421233617b1265cfcd58f0',
  '0008_artifact_files': 'b1b9fb25e1b53887cd672575371ee101',
  '0009_consent_locale': 'fee5efc6b6049b3084f7cd68a58d1426',
  '0010_english_only': '96624dcdb91443fb14bc4f46fa2a5f4e',
  '0011_privacy_actions': '6a4087d13fc16028fadb11883202e421',
  '0012_panel_indexes': '59f579d248326352849cd0608d3ab43f',
  '0013_delivery_outcome': 'eed39a06533597e7c2a9b2b439536860',
  '0014_rate_window': '7d137d04011f1688ad7a29706f884593',
  '0015_compliance_rules': '6faf5ed5a1469b6e94f7bd726a74df1e',
}

function checksum(name: string): string {
  return createHash('md5')
    .update(readFileSync(join(DIR, name, 'migration.sql')))
    .digest('hex')
}

describe('миграции', () => {
  it('ни одна не менялась после коммита', () => {
    for (const [name, expected] of Object.entries(APPLIED)) {
      expect(checksum(name), `${name} изменена после коммита`).toBe(expected)
    }
  })

  it('каждая миграция в каталоге зафиксирована', () => {
    // Иначе новую можно добавить и потом незаметно поправить: тест молчал бы,
    // потому что про неё не знает.
    const names = readdirSync(DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)

    for (const name of names) {
      expect(Object.keys(APPLIED), `${name} не внесена в тест`).toContain(name)
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
