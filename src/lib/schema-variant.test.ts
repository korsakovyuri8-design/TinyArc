import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SCHEMA_PATH } from './db-provider'
import { toPostgresSchema } from './schema-variant'

describe('вариант схемы под Postgres', () => {
  it('отличается от исходной ровно провайдером', () => {
    const sqlite = readFileSync(SCHEMA_PATH.sqlite, 'utf8')
    const generated = toPostgresSchema(sqlite)

    expect(generated).toContain('provider = "postgresql"')
    expect(generated).not.toContain('provider = "sqlite"')
  })

  it('не молчит, если исходную схему перестали понимать', () => {
    expect(() => toPostgresSchema('datasource db {\n  provider = "mysql"\n}')).toThrow()
  })

  it('сгенерированный файл не отстал от схемы', () => {
    const wanted = toPostgresSchema(readFileSync(SCHEMA_PATH.sqlite, 'utf8'))
    expect(readFileSync(SCHEMA_PATH.postgresql, 'utf8')).toBe(wanted)
  })
})
