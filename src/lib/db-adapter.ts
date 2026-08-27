import { createRequire } from 'node:module'
import type { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import type { PrismaPg } from '@prisma/adapter-pg'
import { providerFor, redact } from './db-provider'

/**
 * Драйвер под ту базу, на которую показывает DATABASE_URL.
 *
 * Один и тот же выбор делают приложение и сид — поэтому он живёт здесь, а не
 * двумя копиями. Подгружается только нужный драйвер: на Postgres код SQLite не
 * выполняется вовсе, и сломанный драйвер разработки не может уронить старт.
 */

const load = createRequire(`${process.cwd()}/`)

type Adapter = PrismaBetterSqlite3 | PrismaPg

export function adapterFor(url: string): Adapter {
  const provider = providerFor(url)

  if (provider === 'sqlite') {
    const mod = require_<typeof import('@prisma/adapter-better-sqlite3')>(
      '@prisma/adapter-better-sqlite3',
      'SQLite — база разработки. В окружении её пакетов нет: либо поставьте dev-зависимости, либо укажите postgresql:// в DATABASE_URL.',
      url,
    )

    return new mod.PrismaBetterSqlite3({ url })
  }

  const mod = require_<typeof import('@prisma/adapter-pg')>(
    '@prisma/adapter-pg',
    'Драйвер Postgres не установлен.',
    url,
  )

  return new mod.PrismaPg({ connectionString: url })
}

function require_<T>(specifier: string, hint: string, url: string): T {
  try {
    return load(specifier) as T
  } catch (cause) {
    throw new Error(`${hint} (DATABASE_URL=${redact(url)})`, { cause })
  }
}
