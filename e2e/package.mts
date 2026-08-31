/**
 * Комплект документации одним архивом.
 *
 * П.13 говорит: материалы передаются заказчику в полном объёме. По одной
 * ссылке за раз это исполняется терпением — разрешительный пакет состоит из
 * десятков файлов, и человек, пришедший забрать оплаченное, получал работу
 * вместо документации.
 *
 * Проверяется не «ответ пришёл», а то, что архив открывается: скачанное
 * распаковывается системным распаковщиком, который про наш код ничего не
 * знает. Битый zip отдаётся с тем же кодом 200, что и целый, и увидеть
 * разницу можно только распаковав.
 *
 * Право проверяется наравне с содержимым: комплект целиком не полагается ни
 * специалисту, ни соседнему заказчику, ни гостю.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { prisma } from '../src/lib/db'

const BASE = process.env.E2E_BASE ?? 'http://127.0.0.1:3100'
const EXECUTABLE = process.env.E2E_CHROMIUM ?? '/opt/pw-browsers/chromium'
const PASSWORD = process.env.BUREAU_OPS_PASSWORD

function check(condition, message) {
  if (!condition) {
    console.error(`  ✗ ${message}`)
    process.exitCode = 1
    return false
  }
  console.log(`  ✓ ${message}`)
  return true
}

console.log('Комплект одним архивом')

if (!PASSWORD) {
  console.error('Нужен BUREAU_OPS_PASSWORD: без панели работу не принять.')
  process.exit(1)
}

/*
 * Задача с настоящим файлом в хранилище. Часть записей сида — внешние ссылки,
 * и на таком проекте архив собирается пустым: проверка прошла бы «ноль против
 * нуля» и не значила бы ничего. Файл в хранилище появляется прямо перед этим
 * сценарием — его загружает e2e/files.
 */
const uploaded = await prisma.artifact.findFirst({
  where: { source: 'human', storageKey: { not: null } },
  select: { ticket: { select: { id: true, projectId: true, status: true } } },
})

if (!uploaded) {
  check(false, 'на стенде нет загруженных файлов: архив нечем наполнить')
  await prisma.$disconnect()
  process.exit(1)
}

const project = await prisma.project.findUnique({
  where: { id: uploaded.ticket.projectId },
  select: { id: true, clientKey: true, title: true },
})

if (!project) {
  check(false, 'проект загруженного файла не найден')
  await prisma.$disconnect()
  process.exit(1)
}

const browser = await chromium.launch(existsSync(EXECUTABLE) ? { executablePath: EXECUTABLE } : {})

/*
 * В комплект входит только принятая работа: непринятое — это ещё черновик в
 * чужой папке. Значит состояние надо создать, а не искать готовое, — и заодно
 * так проверяется настоящий путь: файл загружен, работа принята, файл в
 * комплекте, комплект в архиве.
 */
const bureau = await (await browser.newContext()).newPage()
await bureau.goto(`${BASE}/ops`)
await bureau.fill('input[type=password]', PASSWORD)
await bureau.click('button[type=submit]')
await bureau.waitForSelector('a[href="/ops/import"]')

if (uploaded.ticket.status !== 'accepted') {
  const owner = await prisma.ticket.findUniqueOrThrow({
    where: { id: uploaded.ticket.id },
    select: { specialist: { select: { accessKey: true } } },
  })

  if (owner.specialist) {
    const author = await (await browser.newContext()).newPage()
    await author.goto(`${BASE}/enter`)
    await author.fill('input[name=key]', owner.specialist.accessKey)
    await author.click('button[type=submit]')
    await author.waitForTimeout(1200)
    await author.goto(`${BASE}/work/${uploaded.ticket.id}`)
    await author.waitForTimeout(600)

    const hand = author.locator('button:has-text("Hand in the work")')
    if ((await hand.count()) > 0) {
      await hand.click()
      await author.waitForTimeout(1500)
    }
  }

  await bureau.goto(`${BASE}/ops/projects/${project.id}`)
  await bureau.waitForTimeout(800)
  const accept = bureau
    .locator(`form:has(input[value="${uploaded.ticket.id}"]):has(button:has-text("Accept"))`)
    .first()

  if ((await accept.count()) > 0) {
    await accept.locator('button[type=submit]').click()
    await bureau.waitForTimeout(2500)
  }
}

const accepted = await prisma.ticket.findUniqueOrThrow({
  where: { id: uploaded.ticket.id },
  select: { status: true },
})
check(accepted.status === 'accepted', 'работа с файлом принята: только принятое входит в комплект')

const stored = await prisma.artifact.count({
  where: {
    ticket: { projectId: project.id, status: 'accepted' },
    source: 'human',
    storageKey: { not: null },
  },
})
const work = mkdtempSync(join(tmpdir(), 'e2e-package-'))

/** Скачивает архив в контексте страницы и возвращает статус и байты. */
async function fetchArchive(page) {
  return page.evaluate(async (url) => {
    const response = await fetch(url)
    const buffer = await response.arrayBuffer()

    return { status: response.status, bytes: [...new Uint8Array(buffer)] }
  }, `${BASE}/api/projects/${project.id}/package`)
}

/** Заходит по ключу и возвращает страницу. */
async function signIn(key) {
  const page = await (await browser.newContext()).newPage()
  await page.goto(`${BASE}/enter`)
  await page.fill('input[name=key]', key)
  await page.click('button[type=submit]')
  await page.waitForTimeout(1500)
  return page
}

const client = await signIn(project.clientKey)
check(client.url().includes('/project'), `заказчик вошёл: ${project.title}`)

// Ссылка на архив стоит в кабинете, а не только в адресной строке у нас.
const link = await client
  .locator(`a[href="/api/projects/${project.id}/package"]`)
  .count()
check(link > 0, 'в кабинете есть ссылка на весь комплект')

const got = await fetchArchive(client)
check(got.status === 200, `архив отдан: ${got.status}`)

const archive = join(work, 'package.zip')
writeFileSync(archive, Buffer.from(got.bytes))
check(got.bytes.length > 0, `архив непустой: ${got.bytes.length} байт`)

/*
 * Главная проверка файла. Битый zip приходит с тем же кодом 200, и отличить
 * его можно только распаковав — чем и занимается распаковщик, который про наш
 * код ничего не знает.
 */
let unpacked: Record<string, string> = {}
try {
  execFileSync('python3', ['-m', 'zipfile', '-t', archive])
  check(true, 'архив проходит проверку целостности распаковщиком')

  const out = join(work, 'out')
  execFileSync('python3', ['-m', 'zipfile', '-e', archive, out])

  const walk = (dir, prefix) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full, `${prefix}${entry.name}/`)
      else unpacked[`${prefix}${entry.name}`] = readFileSync(full, 'utf8')
    }
  }
  if (existsSync(out)) walk(out, '')
} catch (error) {
  check(false, `архив не распаковался: ${error instanceof Error ? error.message : error}`)
}

const names = Object.keys(unpacked)
check(names.includes('CONTENTS.txt'), 'внутри есть опись')
check(stored > 0, `в комплекте есть что паковать: файлов ${stored}`)
check(
  names.filter((n) => n !== 'CONTENTS.txt').length === stored,
  `файлов в архиве столько же, сколько в комплекте: ${names.length - 1} против ${stored}`,
)
check(
  names.some((n) => n.includes('/')),
  'файлы разложены по папкам стадий, а не свалены в кучу',
)

const contents = unpacked['CONTENTS.txt'] ?? ''

/*
 * По-английски здесь наш текст, а не имена файлов: имя даёт человек, и оно
 * бывает на любом языке. Проверка, не делающая этой разницы, ловила бы
 * загруженный чертёж вместо недоделанного перевода — строки перечня начинаются
 * с отступа, ими опись и отличается от собственных слов.
 */
const ours = contents
  .split('\n')
  .filter((line) => !line.startsWith('  '))
  .join('\n')
check(!/[А-Яа-яЁё]/.test(ours), 'опись по-английски')
check(ours.length > 0, 'у описи есть собственный текст, а не только перечень')
check(
  contents.includes('Generated images are not part of it'),
  'опись говорит, что сгенерированного в комплекте нет',
)

/*
 * Файл, которого у нас нет физически, в архив попасть не может — но промолчать
 * о нём значило бы отдать неполный комплект как полный. Опись называет такие
 * поимённо.
 */
const linked = await prisma.artifact.count({
  where: {
    ticket: { projectId: project.id, status: 'accepted' },
    source: 'human',
    storageKey: null,
  },
})

if (linked > 0) {
  check(
    contents.includes('Not in this archive'),
    `опись называет то, чего в архиве нет: ссылок ${linked}`,
  )
} else {
  check(!contents.includes('Not in this archive'), 'нечего перечислять — и раздела нет')
}

/*
 * Право. Комплект целиком не полагается никому, кроме заказчика этого проекта
 * и бюро: специалист видит свою задачу и входные к ней, не больше (п.11).
 */
const guest = await (await browser.newContext()).newPage()
await guest.goto(`${BASE}/`)
check((await fetchArchive(guest)).status === 404, 'без входа — отказ')

const specialist = await prisma.specialist.findFirst({
  where: { status: 'active', tickets: { some: {} } },
  select: { accessKey: true },
})

if (specialist) {
  const worker = await signIn(specialist.accessKey)
  check((await fetchArchive(worker)).status === 404, 'исполнителю комплект целиком не отдают')
} else {
  check(false, 'на стенде нет специалиста с задачами: проверку не на ком провести')
}

const neighbour = await prisma.project.findFirst({
  where: { id: { not: project.id }, dataErasedAt: null },
  select: { clientKey: true },
})

if (neighbour) {
  const other = await signIn(neighbour.clientKey)
  check((await fetchArchive(other)).status === 404, 'заказчику соседнего проекта — отказ')
} else {
  check(false, 'на стенде один проект: соседа для проверки нет')
}

check((await fetchArchive(bureau)).status === 200, 'бюро комплект скачивает: оно его и сдаёт')

rmSync(work, { recursive: true, force: true })
await browser.close()
await prisma.$disconnect()

console.log(process.exitCode ? '\nЕсть расхождения.' : '\nВсё сошлось.')
