/**
 * Файлы проекта: загрузка и право на скачивание.
 *
 * Главное здесь — вторая половина. Утечку файла не видно ни в интерфейсе, ни в
 * тесте, который просто «скачал и получил файл»: она выглядит как работающая
 * ссылка, и заметна только если специально прийти за чужим.
 *
 * Проверяется вся матрица разом: автор, чужой специалист, заказчик проекта,
 * заказчик соседнего проекта, бюро и никто. Пять из шести случаев — про то,
 * чего быть не должно.
 *
 * Запрос идёт через fetch внутри страницы, а не через request-контекст
 * Playwright: тот не носит httpOnly-cookie, и на нём вся матрица честно
 * показывает 404 — включая те строки, где ожидается 200. На этом я потерял час.
 *
 * Отсюда и .mts: исходные данные берутся из базы напрямую, потому что искать
 * исполнителя перебором ключей на доске либо долго, либо неполно.
 *
 * Нужен запущенный сервер и BUREAU_OPS_PASSWORD.
 */

import { existsSync, rmSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { prisma } from '../src/lib/db'
import { MAX_FILE_BYTES } from '../src/lib/storage/limits'

const BASE = process.env.E2E_BASE ?? 'http://127.0.0.1:3100'
const EXECUTABLE = process.env.E2E_CHROMIUM ?? '/opt/pw-browsers/chromium'
const PASSWORD = process.env.BUREAU_OPS_PASSWORD

if (!PASSWORD) {
  console.error('Нужен BUREAU_OPS_PASSWORD.')
  process.exit(1)
}

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

console.log('Файлы проекта')

/** Открывает чистую сессию нужной стороной. */
async function as(who) {
  const page = await (await browser.newContext()).newPage()

  if (who.ops) {
    await page.goto(`${BASE}/ops`)
    await page.fill('input[type=password]', PASSWORD)
    await page.click('button[type=submit]')
    await page.waitForSelector('a[href="/ops/import"]')
  } else if (who.key) {
    await page.goto(`${BASE}/enter`)
    await page.fill('input[name=key]', who.key)
    await page.click('button[type=submit]')
    await page.waitForTimeout(1400)
  } else {
    await page.goto(`${BASE}/`)
  }

  return page
}

/** Статус запроса файла из этой сессии. */
async function fetchFile(page, artifactId) {
  return page.evaluate(async (url) => {
    const response = await fetch(url)
    return { status: response.status, size: response.ok ? (await response.arrayBuffer()).byteLength : 0 }
  }, `${BASE}/api/files/${artifactId}`)
}

/*
 * Исходные данные берутся из базы, а не перебором ключей на доске.
 *
 * Задача может быть у любого из сотни специалистов стенда, и перебор либо
 * долгий, либо неполный. Проверяется здесь не то, как искать исполнителя, а
 * кто имеет право на файл, — и подготовку честнее сделать напрямую.
 */
const ticket = await prisma.ticket.findFirst({
  where: { status: { in: ['open', 'in_progress'] }, specialistId: { not: null } },
  include: {
    specialist: { select: { accessKey: true } },
    project: { select: { clientKey: true } },
  },
})

if (!ticket?.specialist) {
  check(false, 'на стенде нет задачи в работе: грузить некому')
  await browser.close()
  await prisma.$disconnect()
  process.exit(1)
}

const clientKey = ticket.project.clientKey
const ticketId = ticket.id
const author = { key: ticket.specialist.accessKey, page: await as({ key: ticket.specialist.accessKey }) }
const bureau = await as({ ops: true })

check(true, `автор ${author.key}, задача ${ticketId}, заказчик ${clientKey}`)

await author.page.goto(`${BASE}/work/${ticketId}`)
await author.page.waitForTimeout(600)

/*
 * Открытую задачу сначала берут в работу, и только потом к ней прикладывают
 * файлы. Это не обход теста, а тот же порядок, что у человека: пока задача не
 * взята, время по ней не идёт, и прикладывать нечего.
 */
const claim = author.page.locator('button:has-text("Take it on")')
if ((await claim.count()) > 0) {
  await claim.first().click()
  await author.page.waitForTimeout(2000)
  await author.page.goto(`${BASE}/work/${ticketId}`)
  await author.page.waitForTimeout(600)
}

if (!check((await author.page.locator('#file').count()) > 0, 'на взятой задаче есть загрузка файла')) {
  await browser.close()
  await prisma.$disconnect()
  process.exit(1)
}

await author.page.fill('#name', 'Проверка e2e: планы')
await author.page.setInputFiles('#file', {
  name: 'plans.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4 проверка'),
})
await author.page.locator('form:has(#file) button[type=submit]').click()
await author.page.waitForTimeout(2500)

check(
  (await author.page.innerText('main')).includes('The file is uploaded'),
  'файл загружен, а не отвергнут',
)

/*
 * Файл в несколько мегабайт: тот самый случай, ради которого поле и заведено.
 *
 * Проверка стоит отдельно от предыдущей, потому что мелкий файл проходил и
 * тогда, когда настоящий не проходил вовсе. Тело серверного действия
 * ограничено платформой, по умолчанию — мегабайтом, и до нашей проверки
 * размера файл просто не доезжал: специалист получал пятисотку и экран
 * ошибки, а поле рядом обещало пятьдесят мегабайт. Проверено на стенде: два
 * мегабайта падали, полмегабайта проходили.
 */
{
  const big = '/tmp/e2e-big.pdf'
  writeFileSync(big, Buffer.alloc(3 * 1024 * 1024, 0x41))

  await author.page.fill('#name', 'Проверка e2e: набор листов')
  await author.page.setInputFiles('#file', big)
  await author.page.locator('form:has(#file) button[type=submit]').click()
  await author.page.waitForTimeout(12000)

  check(
    (await author.page.innerText('main')).includes('The file is uploaded'),
    'файл в три мегабайта доехал, а не упал пятисоткой',
  )

  rmSync(big, { force: true })
}

/*
 * Файл сверх потолка останавливается в браузере.
 *
 * Проверка на сервере остаётся главной — форму обходят, — но она срабатывает
 * после того, как файл целиком доехал, а сверх предела платформы он не
 * доезжает вовсе. Человек обязан получить объяснение, а не ожидание и
 * пятисотку в конце.
 */
{
  const huge = '/tmp/e2e-huge.pdf'
  writeFileSync(huge, Buffer.alloc(MAX_FILE_BYTES + 4 * 1024 * 1024, 0x41))

  const before = await prisma.artifact.count({ where: { ticketId } })

  await author.page.fill('#name', 'Проверка e2e: чужой архив')
  await author.page.setInputFiles('#file', huge)
  await author.page.waitForTimeout(1200)

  const said = await author.page.innerText('main')
  check(said.includes('over the'), 'поле сказало, что файл сверх потолка')

  await author.page.locator('form:has(#file) button[type=submit]').click()
  await author.page.waitForTimeout(4000)

  const after = await prisma.artifact.count({ where: { ticketId } })
  check(after === before, `сверхпотолочный файл не записан: ${before} → ${after}`)

  rmSync(huge, { force: true })
}

await author.page.reload()
await author.page.waitForTimeout(800)

const fileHref = await author.page
  .locator('a[href^="/api/files/"]')
  .first()
  .getAttribute('href')
  .catch(() => null)

if (!check(Boolean(fileHref), `файл виден ссылкой на наш обработчик: ${fileHref}`)) {
  await browser.close()
  process.exit(1)
}

const artifactId = fileHref.replace('/api/files/', '')

// Свой файл автор получает.
const own = await fetchFile(author.page, artifactId)
check(own.status === 200 && own.size > 0, `автор скачивает свой файл (${own.status})`)

// Заказчик проекта — материалы принадлежат ему (п.13).
const client = await as({ key: clientKey })
const asClient = await fetchFile(client, artifactId)
check(asClient.status === 200, `заказчик проекта скачивает (${asClient.status})`)

// Бюро принимает работу, значит видит её.
const asBureau = await fetchFile(bureau, artifactId)
check(asBureau.status === 200, `бюро скачивает (${asBureau.status})`)

/*
 * И три отказа. Каждый из них — отдельный способ прочитать чужой проект, и
 * каждый выглядел бы как обычная работающая ссылка.
 */
const stranger = await as({})
const asStranger = await fetchFile(stranger, artifactId)
check(asStranger.status === 404, `без входа — отказ (${asStranger.status})`)

const otherKey = author.key === 'seed-key-01' ? 'seed-key-02' : 'seed-key-01'
const otherSpecialist = await as({ key: otherKey })
const asOther = await fetchFile(otherSpecialist, artifactId)
check(asOther.status === 404, `чужой специалист — отказ (${asOther.status})`)

const otherClientKey =
  clientKey === 'seed-brief-tivat' ? 'seed-brief-athens' : 'seed-brief-tivat'
const otherClient = await as({ key: otherClientKey })
const asOtherClient = await fetchFile(otherClient, artifactId)
check(asOtherClient.status === 404, `заказчик соседнего проекта — отказ (${asOtherClient.status})`)

// Несуществующий файл отвечает тем же, чем чужой: разница сама по себе сведения.
const missing = await fetchFile(bureau, 'нетакогофайла')
check(missing.status === 404, 'несуществующий файл — тот же отказ, что и чужой')

await browser.close()
await prisma.$disconnect()
console.log(process.exitCode ? '\nЕсть расхождения.' : '\nВсё сошлось.')
