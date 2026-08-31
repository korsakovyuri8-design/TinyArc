/**
 * Восстановление базы из копии.
 *
 * Отдельным скриптом и только в пустую базу. Восстановление поверх живых
 * данных выглядит как «дополнили копией», а на деле смешивает два состояния
 * мира: часть строк из копии, часть сегодняшних, ссылки между ними как
 * повезёт.
 *
 * Копия, из которой ни разу не восстанавливались, копией не является — это
 * файл, про который так думают. Поэтому у восстановления есть свой сквозной
 * прогон (`e2e/backup.mts`), и он гоняется вместе со всеми остальными.
 *
 *   npx tsx scripts/restore.ts backups/bureau-2026-08-31T20-00-00-000Z.ndjson.gz
 *   npx tsx scripts/restore.ts ./местный-файл.ndjson.gz
 */

import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { prisma } from '../src/lib/db'
import { storage } from '../src/lib/storage'
import { RestoreRefused, restore } from '../src/lib/services/backup'

async function main(): Promise<void> {
  const source = process.argv[2]

  if (!source) {
    console.error('Нужен ключ копии в хранилище или путь к файлу.')
    process.exit(1)
  }

  /** Файл берётся с диска, если он там есть, иначе из хранилища. */
  async function bytes(): Promise<Uint8Array> {
    try {
      return readFileSync(source!)
    } catch {
      const stored = await storage().get(source!)

      if (!stored) {
        console.error(`Копии нет ни на диске, ни в хранилище: ${source}`)
        process.exit(1)
      }

      return stored.bytes
    }
  }

  const packed = await bytes()
  const text = source.endsWith('.gz')
    ? gunzipSync(Buffer.from(packed)).toString('utf8')
    : Buffer.from(packed).toString('utf8')

  try {
    const written = await restore(prisma, text.split('\n'))

    console.log('База восстановлена:')
    for (const [table, count] of Object.entries(written)) {
      if (count > 0) console.log(`  ${table}: ${count}`)
    }
  } catch (error) {
    if (error instanceof RestoreRefused) {
      console.error(`Восстановление отменено: ${error.message}`)
      process.exit(1)
    }

    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error('Восстановление не прошло:', error)
  process.exit(1)
})
