/**
 * Продукт говорит по-английски. Везде.
 *
 * Проверка простая до грубости — на странице не должно остаться кириллицы, — и
 * именно поэтому она работает. Недопереведённая страница не ломается и не
 * падает: она открывается, выглядит рабочей и наполовину состоит из другого
 * языка. Заметить это может только тот, кто специально пришёл её читать.
 *
 * Список ведётся руками, а не обходом всех адресов: обход рано или поздно
 * зайдёт в чей-нибудь проект и начнёт проверять содержимое, которое написали
 * люди. Оно из проверки вычитается по той же причине: интерфейс наш и обязан
 * быть на английском, текст автора не переводится ни при каких условиях.
 *
 * Панель бюро входит в проверку наравне с остальным: бюро работает на том же
 * языке, что и специалист с заказчиком.
 *
 * Отсюда .mts: ключи и содержимое стенда берутся из базы.
 */

import { existsSync } from 'node:fs'
import { chromium } from 'playwright'
import { prisma } from '../src/lib/db'

const BASE = process.env.E2E_BASE ?? 'http://127.0.0.1:3100'
const EXECUTABLE = process.env.E2E_CHROMIUM ?? '/opt/pw-browsers/chromium'
const PASSWORD = process.env.BUREAU_OPS_PASSWORD

if (!PASSWORD) {
  console.error('Нужен BUREAU_OPS_PASSWORD.')
  process.exit(1)
}

/** Открытые страницы: их читает тот, кто ещё ничего не решил. */
const PUBLIC = [
  '/',
  '/how-it-works',
  '/algorithm',
  '/specialists',
  '/specialists/apply',
  '/brief',
  '/enter',
  '/legal/offer',
  '/legal/specialists',
  '/legal/privacy',
  '/no-such-page-at-all',
]

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

console.log('Английский везде')

/*
 * Содержимое стенда: то, что на боевом сервере написали бы люди. Вычитается
 * из проверки — требовать латиницы от того, кто пишет бриф на своём языке,
 * значит проверять не то.
 */
const [projects, tickets, comments, messages, artifacts, specialists] = await Promise.all([
  prisma.project.findMany({ select: { title: true, briefNotes: true, clientName: true } }),
  prisma.ticket.findMany({ select: { spec: true, conflictNote: true } }),
  prisma.ticketComment.findMany({ select: { body: true } }),
  prisma.clientMessage.findMany({ select: { body: true } }),
  prisma.artifact.findMany({ select: { name: true } }),
  prisma.specialist.findMany({ select: { displayName: true } }),
])

const written = [
  ...projects.flatMap((p) => [p.title, p.briefNotes, p.clientName]),
  ...tickets.flatMap((t) => [t.spec, t.conflictNote]),
  ...comments.map((c) => c.body),
  ...messages.map((m) => m.body),
  ...artifacts.map((a) => a.name),
  ...specialists.map((s) => s.displayName),
]
  .filter((piece): piece is string => Boolean(piece))
  // Длинные вперёд: короткий кусок, вычтенный первым, разрежет длинный.
  .sort((a, b) => b.length - a.length)

async function clean(page, path) {
  await page.goto(`${BASE}${path}`)
  await page.waitForTimeout(400)

  const left = await page.evaluate((content) => {
    /*
     * Образцы данных из проверки выпадают. На странице импорта перечислено,
     * как может называться столбец в чужой таблице, — там кириллица стоит
     * намеренно: базу бюро собирали руками и по-русски.
     */
    for (const sample of document.querySelectorAll('[data-sample]')) sample.remove()

    let text = document.body.innerText
    for (const piece of content) text = text.split(piece).join(' ')

    const found = new Set()
    for (const match of text.matchAll(/[А-Яа-яЁё][^\n]{0,40}/g)) found.add(match[0].trim())

    return [...found].slice(0, 5)
  }, written)

  check(left.length === 0, left.length === 0 ? `${path} — по-английски` : `${path} — осталось русское: ${left.join(' | ')}`)

  /*
   * Слипшиеся слова — след механической правки текста: «storeysBureau»
   * появляется там, где между двумя фразами потерялся пробел. Глазами это
   * ловится, только если специально вчитываться в каждую страницу.
   */
  const glued = await page.evaluate(() => {
    const known = new Set(['TinyArc', 'ArchiCAD', 'AutoCAD'])
    return [...document.body.innerText.matchAll(/\b[a-z]+[A-Z][a-z]+\b/g)]
      .map((m) => m[0])
      .filter((word) => !known.has(word))
      .slice(0, 4)
  })

  if (glued.length > 0) check(false, `${path} — слиплись слова: ${glued.join(', ')}`)
}

const guest = await (await browser.newContext()).newPage()
for (const path of PUBLIC) await clean(guest, path)

check(
  (await guest.locator('html').getAttribute('lang')) === 'en',
  'атрибут lang английский',
)

/*
 * Приставки `/en` больше не существует: язык один, и адрес у страницы один.
 * Проверка держит это явно — иначе старая приставка тихо начнёт отдавать 404
 * там, где на неё ещё ссылаются письма.
 */
const gone = await guest.goto(`${BASE}/en/brief`)
check(gone.status() === 404, `приставки /en больше нет: ${gone.status()}`)

/** Открывает чистую сессию нужной стороной. */
async function as(key) {
  const page = await (await browser.newContext()).newPage()

  await page.goto(`${BASE}/enter`)
  await page.fill('input[name=key]', key)
  await page.click('button[type=submit]')
  await page.waitForTimeout(1400)

  return page
}

const ticket = await prisma.ticket.findFirst({
  where: { status: { in: ['open', 'in_progress'] }, specialistId: { not: null } },
  include: {
    specialist: { select: { accessKey: true } },
    project: { select: { id: true, clientKey: true } },
  },
})

if (!ticket?.specialist) {
  check(false, 'на стенде нет задачи в работе: смотреть нечего')
  await browser.close()
  await prisma.$disconnect()
  process.exit(1)
}

const specialist = await as(ticket.specialist.accessKey)
await clean(specialist, '/work')
await clean(specialist, `/work/${ticket.id}`)
await clean(specialist, '/work/profile')

const client = await as(ticket.project.clientKey)
await clean(client, '/project')

// Панель бюро: тот же язык, что и у всех остальных.
const bureau = await (await browser.newContext()).newPage()
await bureau.goto(`${BASE}/ops`)
await bureau.fill('input[type=password]', PASSWORD)
await bureau.click('button[type=submit]')
await bureau.waitForSelector('a[href="/ops/import"]')

for (const path of ['/ops', '/ops/applications', '/ops/import', '/ops/pool', '/ops/projects']) {
  await clean(bureau, path)
}
await clean(bureau, `/ops/projects/${ticket.project.id}`)

await browser.close()
await prisma.$disconnect()
console.log(process.exitCode ? '\nЕсть расхождения.' : '\nВсё сошлось.')
