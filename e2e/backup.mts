/**
 * Копия базы и восстановление из неё.
 *
 * Копия, из которой ни разу не восстанавливались, копией не является — это
 * файл, про который так думают. Проверяется поэтому не выгрузка, а именно
 * обратный путь: пустая база, восстановление, сверка с тем, что было.
 *
 * Восстановление идёт в отдельный файл базы, а не в стенд: восстановление
 * поверх живых данных запрещено самим кодом, и проверять надо то, как оно
 * работает, а не то, как оно отказывает.
 *
 * На Postgres сценарий говорит об этом и уходит: поднять вторую базу ему
 * нечем. В CI база файловая, и обратный путь проверяется там на каждом пуше.
 */

import { execFileSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { PrismaClient } from '../src/generated/prisma/client'
import { adapterFor } from '../src/lib/db-adapter'
import { databaseUrl, providerFor } from '../src/lib/db-provider'
import { prisma } from '../src/lib/db'
import { TABLES } from '../src/lib/backup'
import { dump, restore } from '../src/lib/services/backup'

function check(condition, message) {
  if (!condition) {
    console.error(`  ✗ ${message}`)
    process.exitCode = 1
    return false
  }
  console.log(`  ✓ ${message}`)
  return true
}

console.log('Копия базы')

if (providerFor(databaseUrl()) !== 'sqlite') {
  console.log('  · база не файловая — вторую поднять нечем, обратный путь не проверен')
  await prisma.$disconnect()
  process.exit(0)
}

/*
 * Подопытный многострочный текст заводится сам, а не ищется.
 *
 * Построчный формат ломается именно на переводах строки, и проверка,
 * пропускающая себя, когда такого текста на стенде не нашлось, доказывает
 * ровно ничего. Заведённая запись убирается в конце.
 */
const anchor = await prisma.ticket.findFirstOrThrow({
  orderBy: { id: 'asc' },
  select: { id: true },
})

const probe = await prisma.ticketComment.create({
  data: {
    ticketId: anchor.id,
    authorRole: 'bureau',
    body: 'e2e: первая строка\nвторая строка\n\nи четвёртая',
  },
})

/* --- Выгрузка -------------------------------------------------------------- */

const lines: string[] = []
for await (const line of dump(prisma)) lines.push(line)

check(lines.length > 1, `в копии строк: ${lines.length - 1}`)

const header = JSON.parse(lines[0]!)
check(header.header?.backup === 1, 'первой строкой идёт заголовок с версией формата')

const before: Record<string, number> = header.header.counts
check(
  Object.values(before).some((n) => n > 0),
  `в копии есть данные: ${Object.entries(before).filter(([, n]) => n > 0).map(([t, n]) => `${t}:${n}`).join(', ')}`,
)

/* --- Восстановление в пустую базу ------------------------------------------ */

const url = 'file:./restore-check.db'
const file = './restore-check.db'

rmSync(file, { force: true })

/*
 * Схема во второй базе поднимается тем же способом, что и в первой.
 *
 * Без `--accept-data-loss` намеренно: файл только что удалён, терять там
 * нечего, а флаг — разрешение на разрушение, и в сценарии, который гоняется
 * сам по себе, ему не место.
 */
execFileSync('npx', ['prisma', 'db', 'push', '--url', url], { stdio: 'ignore' })

const target = new PrismaClient({ adapter: adapterFor(url) })

let written: Record<string, number> = {}
let failed = ''

try {
  written = await restore(target, lines)
} catch (error) {
  failed = error instanceof Error ? error.message : String(error)
}

check(!failed, failed ? `восстановление не прошло: ${failed}` : 'восстановление прошло')

/* --- Сверка ---------------------------------------------------------------- */

let same = true
const diverged: string[] = []

for (const table of TABLES) {
  const expected = before[table] ?? 0
  const actual = written[table] ?? 0

  if (expected !== actual) {
    same = false
    diverged.push(`${table}: ${expected} → ${actual}`)
  }
}

check(same, same ? 'строк восстановлено ровно столько же' : `разошлось: ${diverged.join(', ')}`)

/*
 * Счёт совпал — это ещё не «данные те же». Проверяются два места, где
 * логическая копия ломается тише всего: дата, ставшая строкой, и текст с
 * переводом строки, разъехавшийся по строкам файла.
 */
{
  const source = await prisma.ticket.findFirst({
    where: { dueAt: { not: null } },
    orderBy: { id: 'asc' },
    select: { id: true, dueAt: true, spec: true },
  })

  if (!source) {
    check(false, 'на стенде нет задачи со сроком: даты не на чем проверить')
  } else {
    const copy = await target.ticket.findUnique({
      where: { id: source.id },
      select: { dueAt: true, spec: true },
    })

    check(
      copy?.dueAt instanceof Date && copy.dueAt.getTime() === source.dueAt!.getTime(),
      `срок остался датой и тем же моментом: ${copy?.dueAt?.toISOString()}`,
    )
    check(copy?.spec === source.spec, 'постановка задачи совпала знак в знак')
  }
}

{
  const copy = await target.ticketComment.findUnique({
    where: { id: probe.id },
    select: { body: true },
  })

  // Многострочный текст — самое опасное для построчного формата: разъехавшись
  // по строкам файла, он превращает одну запись в несколько нечитаемых.
  check(copy?.body === probe.body, 'многострочный текст пережил построчный формат')
}

/* --- Поверх живых данных не восстанавливается ------------------------------ */

let refused = ''

try {
  await restore(target, lines)
} catch (error) {
  refused = error instanceof Error ? error.message : String(error)
}

check(
  refused.includes('не пуста'),
  `восстановление поверх непустой базы отклонено: «${refused.slice(0, 60)}»`,
)

await target.$disconnect()

await prisma.ticketComment.delete({ where: { id: probe.id } })
await prisma.$disconnect()

rmSync(file, { force: true })
rmSync(`${file}-journal`, { force: true })

console.log(process.exitCode ? '\nЕсть расхождения.' : '\nВсё сошлось.')
