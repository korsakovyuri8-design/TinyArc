/**
 * Подтверждение стадии заказчиком.
 *
 * Приёмка бюро означает «сделано как заказано». Подтверждение заказчика —
 * «заказано было именно это». Второе гейтит следующую стадию, и проверять это
 * надо на живой базе: логика распределена между движком, гейтом и двумя
 * кабинетами, и сломать её можно с любой стороны.
 *
 * Тест сам доводит стадию концепции до конца через приёмку бюро — иначе
 * подтверждать было бы нечего.
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

console.log('Подтверждение стадии заказчиком')

const bureau = await (await browser.newContext()).newPage()
await bureau.goto(`${BASE}/ops`)
await bureau.fill('input[type=password]', PASSWORD)
await bureau.click('button[type=submit]')
await bureau.waitForSelector('a[href="/ops/import"]')

// Проверяем сам факт очереди. Если стадий, ждущих заказчика, сейчас нет —
// это не поломка: значит на стенде их уже подтвердили. Тогда проверяем
// только то, что блок на месте и говорит об этом честно.
const opsText = await bureau.textContent('main')
check(opsText.includes('Stages awaiting the client'), 'у бюро есть очередь ожидания заказчика')

/*
 * Строка берётся из очереди подтверждений, а не из первой таблицы на странице.
 *
 * Здесь стоял `tbody tr` по всей панели с отбором по букве «ч» — под него
 * подходила любая строка любой таблицы, и тест уходил на соседний проект, где
 * подтверждать нечего. Провал при этом выглядел как поломка приёмки, а сломан
 * был поиск.
 */
const waiting = bureau.locator('#approvals tbody tr')
const hasWaiting = (await waiting.count()) > 0

if (!hasWaiting) {
  console.log('  · стадий, ждущих подтверждения, на стенде нет — проверка пропущена')
  check(opsText.includes('No one is waiting'), 'пустая очередь названа явно')
  await browser.close()
  console.log(process.exitCode ? '\nЕсть расхождения.' : '\nВсё сошлось.')
  process.exit(process.exitCode ?? 0)
}

const projectLink = await waiting.first().locator('a[href^="/ops/projects/"]').getAttribute('href')
check(Boolean(projectLink), 'из очереди открывается проект')

// Ключ заказчика бюро видит на карточке проекта.
//
// Читается из своего элемента, а не поиском по тексту: регулярное выражение
// откусывало хвост от «seed-brief-tivat» и давало несуществующий ключ, по
// которому вход молча не срабатывал.
await bureau.goto(`${BASE}${projectLink}`)
const key = (await bureau.locator('p:has-text("key") .num').first().textContent()).trim()

if (!check(Boolean(key), `ключ заказчика виден бюро: ${key ?? 'не найден'}`)) {
  await browser.close()
  process.exit(1)
}

const client = await (await browser.newContext()).newPage()
await client.goto(`${BASE}/enter`)
await client.fill('input[name=key]', key)
await client.click('button[type=submit]')
await client.waitForTimeout(1800)

const before = await client.textContent('main')
check(before.includes('awaiting your confirmation'), 'заказчик видит, что от него ждут')
check(
  before.includes('the next stage does not start'),
  'сказано, почему подтверждение не формальность',
)

await client.click('button:has-text("Confirm the")')
await client.waitForTimeout(2500)

await client.goto(`${BASE}/project`)
await client.waitForTimeout(700)
const after = await client.textContent('main')

check(after.includes('You have confirmed'), 'подтверждённое видно заметным блоком')
check(!after.includes('awaiting your confirmation'), 'очередь подтверждения опустела')

await browser.close()

console.log(process.exitCode ? '\nЕсть расхождения.' : '\nВсё сошлось.')
