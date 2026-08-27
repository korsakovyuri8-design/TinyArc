/**
 * Какая база стоит за DATABASE_URL.
 *
 * Модуль намеренно не тянет ни драйверов, ни Prisma: его читает и
 * prisma.config.ts, и сборка, и тесты. Единственное, что он делает, —
 * отвечает на вопрос «куда мы сейчас смотрим» и падает, если ответа нет.
 *
 * Молчаливого отката на SQLite здесь нет: «кажется, боевая база» — худшее из
 * состояний.
 */

export type DbProvider = 'sqlite' | 'postgresql'

/** Схема под каждый провайдер. Postgres-версия генерируется из SQLite-версии. */
export const SCHEMA_PATH: Record<DbProvider, string> = {
  sqlite: 'prisma/schema.prisma',
  postgresql: 'prisma/schema.postgres.prisma',
}

export const DEV_DATABASE_URL = 'file:./bureau.db'

export function providerFor(url: string): DbProvider {
  const trimmed = url.trim()

  if (trimmed.startsWith('file:')) return 'sqlite'
  if (trimmed.startsWith('postgresql://') || trimmed.startsWith('postgres://')) return 'postgresql'

  throw new Error(
    `DATABASE_URL="${redact(trimmed)}": поддерживаются только file: (SQLite, разработка) и postgresql:// (боевая база).`,
  )
}

export function databaseUrl(env: Record<string, string | undefined> = process.env): string {
  return env.DATABASE_URL?.trim() || DEV_DATABASE_URL
}

/** Пароль из строки подключения не должен попасть ни в лог, ни в сообщение об ошибке. */
export function redact(url: string): string {
  return url.replace(/\/\/([^:/@]+):[^@]*@/, '//$1:***@')
}
