import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'
import { SCHEMA_PATH, databaseUrl, providerFor } from './src/lib/db-provider'

// Схему выбирает не человек, а строка подключения: указать Postgres и получить
// SQLite-схему — ошибка, которую замечают уже после миграции.
export default defineConfig({
  schema: SCHEMA_PATH[providerFor(databaseUrl())],
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})
