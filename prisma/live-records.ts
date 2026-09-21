/**
 * Живые записи базы: посмотреть и убрать тестовые.
 *
 * После выноса демо в базе остаются записи без метки синтетики: анкеты и
 * брифы, которые кто-то подал руками. Часть из них проверочные, их подавал
 * сам основатель, пока проверял форму. Отличить их от настоящих по данным
 * нельзя, поэтому скрипт ничего не решает сам: показывает всё живое, а
 * убирает только то, что назвали по id.
 *
 *     npx tsx prisma/live-records.ts                          показать
 *     npx tsx prisma/live-records.ts --delete-project <id>    убрать проект
 *     npx tsx prisma/live-records.ts --delete-specialist <id> убрать анкету
 *
 * Удаление каскадное: с проектом уходят его прогоны, тикеты и файлы в базе,
 * с анкетой её ставки и место в командах. Отката нет.
 */

import { PrismaClient } from '../src/generated/prisma/client'
import { adapterFor } from '../src/lib/db-adapter'
import { databaseUrl } from '../src/lib/db-provider'

const prisma = new PrismaClient({ adapter: adapterFor(databaseUrl()) })

function arg(flag: string): string | null {
  const i = process.argv.indexOf(flag)
  return i === -1 ? null : (process.argv[i + 1] ?? null)
}

async function main() {
  const projectId = arg('--delete-project')
  const specialistId = arg('--delete-specialist')

  if (projectId) {
    const row = await prisma.project.findUnique({ where: { id: projectId } })
    if (!row) return console.log(`Проекта ${projectId} нет.`)
    await prisma.project.delete({ where: { id: projectId } })
    return console.log(`Убран проект: ${row.title} <${row.clientEmail}>`)
  }

  if (specialistId) {
    const row = await prisma.specialist.findUnique({ where: { id: specialistId } })
    if (!row) return console.log(`Анкеты ${specialistId} нет.`)
    await prisma.specialist.delete({ where: { id: specialistId } })
    return console.log(`Убрана анкета: ${row.displayName} <${row.email}>`)
  }

  const [specialists, projects] = await Promise.all([
    prisma.specialist.findMany({
      where: { accessKey: { not: { startsWith: 'seed-key-' } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.project.findMany({
      where: { clientKey: { not: { startsWith: 'seed-brief-' } } },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  console.log(`Анкеты (${specialists.length}):`)
  for (const s of specialists) {
    console.log(`  ${s.id}  ${s.displayName} <${s.email}>  ${s.status}  ${s.createdAt.toISOString().slice(0, 10)}`)
  }
  console.log(`\nПроекты (${projects.length}):`)
  for (const p of projects) {
    console.log(`  ${p.id}  ${p.title} <${p.clientEmail}>  ${p.status}  ${p.createdAt.toISOString().slice(0, 10)}`)
  }
  console.log('\nЧтобы убрать запись, добавьте --delete-project <id> или --delete-specialist <id>')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
