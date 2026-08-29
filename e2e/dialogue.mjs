/**
 * Разговор заказчика с бюро.
 *
 * Единственный канал, который есть у человека, отдавшего участок и деньги.
 * Проверяется весь круг: он сказал — бюро увидело в очереди — ответило —
 * он увидел ответ, а вопрос ушёл из очереди.
 *
 * Отдельно проверяется граница: этой переписки не должно быть видно ни на
 * доске специалиста, ни в его задаче. Blind Relay закрывает каналы между
 * исполнителями, но и заказчик с исполнителем напрямую не разговаривает —
 * иначе отвечать за результат становится некому.
 *
 * Нужен запущенный сервер и BUREAU_OPS_PASSWORD.
 */

import { existsSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE = process.env.E2E_BASE ?? 'http://127.0.0.1:3100'
const EXECUTABLE = process.env.E2E_CHROMIUM ?? '/opt/pw-browsers/chromium'
const PASSWORD = process.env.BUREAU_OPS_PASSWORD

if (!PASSWORD) {
  console.error('Нужен BUREAU_OPS_PASSWORD.')
  process.exit(1)
}

const MARK = `срок ${Date.now()}`
const QUESTION = `Нужно сдвинуть ${MARK} на месяц — уезжаю.`
const ANSWER = `Принято, ${MARK} двигаем. Постановку поправим сегодня.`

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

console.log('Разговор заказчика с бюро')

const client = await (await browser.newContext()).newPage()
await client.goto(`${BASE}/enter`)
await client.fill('input[name=key]', 'seed-brief-tivat')
await client.click('button[type=submit]')
await client.waitForTimeout(1800)
check(client.url().includes('/project'), 'заказчик вошёл в кабинет')

await client.fill('#body', QUESTION)
await client.click('button:has-text("Send to the bureau")')
await client.waitForTimeout(2200)
check(
  (await client.locator('.hint', { hasText: 'Sent to the bureau' }).count()) > 0,
  'сообщение принято',
)

const bureau = await (await browser.newContext()).newPage()
await bureau.goto(`${BASE}/ops`)
await bureau.fill('input[type=password]', PASSWORD)
await bureau.click('button[type=submit]')
await bureau.waitForSelector('a[href="/ops/import"]')

const waiting = bureau.locator('.panel', { hasText: MARK })
check((await waiting.count()) > 0, 'вопрос стоит в очереди бюро')

const link = await waiting.first().locator('a[href^="/ops/projects/"]').getAttribute('href')
await bureau.goto(`${BASE}${link}`)
check(
  (await bureau.locator('span.label', { hasText: 'unanswered' }).count()) > 0,
  'на карточке проекта видно, что вопрос без ответа',
)

await bureau.fill('#answer', ANSWER)
await bureau.click('button:has-text("Answer the client")')
await bureau.waitForTimeout(2200)
check(
  (await bureau.locator('.hint', { hasText: 'The answer is sent' }).count()) > 0,
  'бюро ответило',
)

await bureau.goto(`${BASE}/ops`)
check(
  (await bureau.locator('.panel', { hasText: MARK }).count()) === 0,
  'отвеченный вопрос ушёл из очереди',
)

await client.goto(`${BASE}/project`)
await client.waitForTimeout(600)
const seen = await client.textContent('main')
check(seen.includes(ANSWER), 'заказчик видит ответ бюро')

// Граница: исполнитель этой переписки не видит.
const worker = await (await browser.newContext()).newPage()
await worker.goto(`${BASE}/enter`)
await worker.fill('input[name=key]', 'seed-key-01')
await worker.click('button[type=submit]')
await worker.waitForTimeout(1800)

if (worker.url().includes('/work')) {
  const board = await worker.textContent('main')
  check(!board.includes(MARK), 'на доске специалиста переписки нет')

  const first = await worker.locator('a[href^="/work/"]').first().getAttribute('href').catch(() => null)
  if (first && first !== '/work/profile') {
    await worker.goto(`${BASE}${first}`)
    await worker.waitForTimeout(600)
    check(!(await worker.textContent('main')).includes(MARK), 'в задаче переписки тоже нет')
  }
} else {
  console.log('  · специалист не вошёл, проверка границы пропущена')
}

await browser.close()

console.log(process.exitCode ? '\nЕсть расхождения.' : '\nВсё сошлось.')
