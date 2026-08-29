/**
 * Английская версия кабинетов — за ключом.
 *
 * Отдельно от locale.mjs по одной причине: сюда нельзя просто зайти. Без ключа
 * кабинет отдаёт форму входа, и проверка молча проверяла бы её вместо кабинета,
 * сообщая «без русского» о странице, до которой не дошла.
 *
 * Отсюда и .mts: ключ специалиста с задачей и ключ заказчика берутся из базы.
 * Перебирать сотню ключей стенда в поисках того, у кого есть открытая задача,
 * либо долго, либо неполно.
 *
 * Панель бюро сюда не входит: она остаётся русской намеренно, за ней сидит бюро.
 *
 * Из проверки вычитается содержимое, введённое людьми: название проекта,
 * постановка, комментарии, имена файлов. Интерфейс наш и обязан быть на языке
 * читателя; текст, который написал человек, не переводится ни при каких
 * условиях — и требовать от него латиницы значит проверять не то.
 */

import { existsSync } from 'node:fs'
import { chromium } from 'playwright'
import { prisma } from '../src/lib/db'

const BASE = process.env.E2E_BASE ?? 'http://127.0.0.1:3100'
const EXECUTABLE = process.env.E2E_CHROMIUM ?? '/opt/pw-browsers/chromium'

function check(condition, message) {
  if (!condition) {
    console.error(`  ✗ ${message}`)
    process.exitCode = 1
    return false
  }
  console.log(`  ✓ ${message}`)
  return true
}

const browser = await chromium.launch(
  existsSync(EXECUTABLE) ? { executablePath: EXECUTABLE } : {},
)

console.log('Английские кабинеты')

/** Вход по ключу в английской версии: язык держится сессией страницы, не ключом. */
async function enter(key) {
  const page = await (await browser.newContext()).newPage()

  await page.goto(`${BASE}/en/enter`)
  await page.fill('input[name=key]', key)
  await page.click('button[type=submit]')
  await page.waitForTimeout(1400)

  return page
}

/** Русские хвосты на странице: пять первых, чтобы было что чинить. */
async function cyrillic(page, path, content) {
  await page.goto(`${BASE}${path}`)
  await page.waitForTimeout(500)

  return page.evaluate((written) => {
    let text = document.body.innerText

    for (const piece of written) text = text.split(piece).join(' ')

    const found = new Set()

    for (const match of text.matchAll(/[А-Яа-яЁё][^\n]{0,40}/g)) found.add(match[0].trim())

    return [...found].slice(0, 5)
  }, content)
}

async function clean(page, path, content) {
  const left = await cyrillic(page, path, content)

  check(
    left.length === 0,
    left.length === 0 ? `${path} — без русского` : `${path} — осталось русское: ${left.join(' | ')}`,
  )
}

const ticket = await prisma.ticket.findFirst({
  where: { status: { in: ['open', 'in_progress'] }, specialistId: { not: null } },
  include: {
    specialist: { select: { accessKey: true } },
    project: { select: { clientKey: true } },
  },
})

if (!ticket?.specialist) {
  check(false, 'на стенде нет задачи в работе: смотреть нечего')
  await browser.close()
  await prisma.$disconnect()
  process.exit(1)
}

check(true, `специалист ${ticket.specialist.accessKey}, задача ${ticket.id}`)

/*
 * Содержимое стенда: то, что на боевом сервере написали бы люди. Собирается
 * по всем проектам сразу — кабинет заказчика и доска специалиста показывают
 * разные проекты, а вычитать нужно и то, и другое.
 */
const [projects, tickets, comments, messages, artifacts] = await Promise.all([
  prisma.project.findMany({ select: { title: true, briefNotes: true, clientName: true } }),
  prisma.ticket.findMany({ select: { spec: true, conflictNote: true } }),
  prisma.ticketComment.findMany({ select: { body: true } }),
  prisma.clientMessage.findMany({ select: { body: true } }),
  prisma.artifact.findMany({ select: { name: true } }),
])

const written = [
  ...projects.flatMap((p) => [p.title, p.briefNotes, p.clientName]),
  ...tickets.flatMap((t) => [t.spec, t.conflictNote]),
  ...comments.map((c) => c.body),
  ...messages.map((m) => m.body),
  ...artifacts.map((a) => a.name),
]
  .filter((piece): piece is string => Boolean(piece))
  // Длинные вперёд: короткий кусок, вычтенный первым, разрежет длинный.
  .sort((a, b) => b.length - a.length)

const specialist = await enter(ticket.specialist.accessKey)
await clean(specialist, '/en/work', written)
await clean(specialist, `/en/work/${ticket.id}`, written)
await clean(specialist, '/en/work/profile', written)

const client = await enter(ticket.project.clientKey)
await clean(client, '/en/project', written)

/*
 * Дозаполнение профиля — только если на стенде есть приглашённый. Сид его не
 * создаёт (приглашения приходят импортом базы бюро), а проверять страницу,
 * которая при отсутствии такого человека просто перенаправляет, — значит
 * получать зелёную галочку ни за что.
 */
const invited = await prisma.specialist.findFirst({
  where: { status: 'invited' },
  select: { accessKey: true },
})

if (invited) {
  const page = await enter(invited.accessKey)
  await clean(page, '/en/work/profile/complete', written)
} else {
  console.log('  · приглашённых на стенде нет — дозаполнение профиля не проверено')
}

await browser.close()
await prisma.$disconnect()
console.log(process.exitCode ? '\nЕсть расхождения.' : '\nВсё сошлось.')
