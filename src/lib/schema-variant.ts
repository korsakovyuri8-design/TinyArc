/**
 * Postgres-схема выводится из SQLite-схемы, а не пишется рядом.
 *
 * Две схемы, которые правят руками, расходятся — вопрос месяцев. Здесь разница
 * между ними сведена к одной строке, а тест держит сгенерированный файл в
 * соответствии с исходным.
 */

const BANNER = [
  '// СГЕНЕРИРОВАННЫЙ ФАЙЛ. Не редактируйте: правьте prisma/schema.prisma и',
  '// выполните npm run db:schema. Отличие от исходной схемы ровно одно —',
  '// провайдер datasource.',
  '',
  '',
].join('\n')

const SQLITE_DATASOURCE = 'datasource db {\n  provider = "sqlite"\n}'
const POSTGRES_DATASOURCE = 'datasource db {\n  provider = "postgresql"\n}'

export function toPostgresSchema(sqliteSchema: string): string {
  if (!sqliteSchema.includes(SQLITE_DATASOURCE)) {
    throw new Error('В prisma/schema.prisma не найден datasource на sqlite — генератор больше не понимает схему.')
  }

  return BANNER + sqliteSchema.replace(SQLITE_DATASOURCE, POSTGRES_DATASOURCE)
}
