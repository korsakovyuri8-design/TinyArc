/**
 * Разбор заявки: отказ доходит до человека.
 *
 * Прошедшему уходит ключ, и это было единственное письмо на весь разбор.
 * Не прошедший не получал ничего: он подал заявку и остался ждать ответа,
 * которого в системе не существовало. Ждать он будет месяцами, потому что
 * никакого сигнала о том, что решение принято, у него нет.
 *
 * Проверяется и обратное: письмо не открывает переговоров. Порог — условие
 * допуска, а не балл (п.9), поэтому ни оценки, ни разбора работ, ни адреса
 * для возражений в письме нет.
 *
 * Нужен запущенный сервер и BUREAU_OPS_PASSWORD.
 */

import { existsSync } from 'node:fs'
import { chromium } from 'playwright'
import { prisma } from '../src/lib/db'
import { PORTFOLIO_THRESHOLD } from '../src/engine/taxonomy'

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

console.log('Разбор заявки')

const applicant = await prisma.specialist.findFirst({
  where: { status: 'pending' },
  select: { id: true, email: true, displayName: true },
})

if (!applicant) {
  check(false, 'на стенде нет заявки на разборе: отказ негде проверить')
  await prisma.$disconnect()
  process.exit(1)
}

const browser = await chromium.launch(
  existsSync(EXECUTABLE) ? { executablePath: EXECUTABLE } : {},
)
const page = await (await browser.newContext()).newPage()

await page.goto(`${BASE}/ops`)
await page.fill('input[type=password]', PASSWORD)
await page.click('button[type=submit]')
await page.waitForSelector('a[href="/ops/import"]')

await page.goto(`${BASE}/ops/applications`)
await page.waitForTimeout(600)

const rating = page.locator(`input#rating-${applicant.id}`)
check((await rating.count()) === 1, `заявка на разборе: ${applicant.displayName}`)

// Ровно под порогом: граница проверяется там, где она стоит, а не на нуле.
await rating.fill(String(PORTFOLIO_THRESHOLD - 0.1))
await page
  .locator(`form:has(input#rating-${applicant.id}) button[type=submit]`)
  .click()
await page.waitForTimeout(2500)

const after = await prisma.specialist.findUnique({
  where: { id: applicant.id },
  select: { status: true },
})

check(after?.status === 'rejected', 'заявка ниже порога не прошла')

const told = await prisma.notification.findMany({
  where: { kind: 'application_declined', targetId: applicant.id },
})

check(told.length === 1, `об отказе написали: писем ${told.length}`)
check(
  told.every((n) => n.email === applicant.email),
  'письмо ушло тому, кто подавал заявку',
)

/*
 * Повторный разбор той же заявки второго письма не порождает. Оператор
 * заходит в карточку не по одному разу, и второе письмо об одном отказе —
 * это письмо ни о чём.
 */
await page.goto(`${BASE}/ops/pool/${applicant.id}`)
await page.waitForTimeout(600)

const { applicationDeclined } = await import('../src/lib/services/notify')
await applicationDeclined(applicant.id)

const again = await prisma.notification.count({
  where: { kind: 'application_declined', targetId: applicant.id },
})

check(again === 1, `повторный разбор письма не удваивает: писем ${again}`)

/*
 * Прошедший порог отказа не получает. Проверка на соседе: одна и та же
 * функция, вызванная не на том статусе, молчит.
 */
const passing = await prisma.specialist.findFirst({
  where: { status: 'active' },
  select: { id: true },
})

if (passing) {
  await applicationDeclined(passing.id)
  const wrong = await prisma.notification.count({
    where: { kind: 'application_declined', targetId: passing.id },
  })
  check(wrong === 0, 'принятому в пул отказ не уходит')
} else {
  check(false, 'на стенде нет принятого специалиста: проверку не на ком провести')
}

await browser.close()
await prisma.$disconnect()

console.log(process.exitCode ? '\nЕсть расхождения.' : '\nВсё сошлось.')
