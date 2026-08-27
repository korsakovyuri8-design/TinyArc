/**
 * Генерирует prisma/schema.postgres.prisma из prisma/schema.prisma.
 *
 *   npm run db:schema            — записать
 *   npm run db:schema -- --check — проверить, что записанное совпадает
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { SCHEMA_PATH } from '../src/lib/db-provider'
import { toPostgresSchema } from '../src/lib/schema-variant'

const wanted = toPostgresSchema(readFileSync(SCHEMA_PATH.sqlite, 'utf8'))
const check = process.argv.includes('--check')

if (check) {
  const current = readFileSync(SCHEMA_PATH.postgresql, 'utf8')

  if (current !== wanted) {
    console.error(`${SCHEMA_PATH.postgresql} отстал от ${SCHEMA_PATH.sqlite}. Выполните: npm run db:schema`)
    process.exit(1)
  }

  console.log(`${SCHEMA_PATH.postgresql} совпадает со схемой.`)
} else {
  writeFileSync(SCHEMA_PATH.postgresql, wanted)
  console.log(`Записан ${SCHEMA_PATH.postgresql}.`)
}
