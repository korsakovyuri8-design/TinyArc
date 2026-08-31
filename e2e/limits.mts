/**
 * Ограничитель частоты: счёт общий, а не у каждого процесса свой.
 *
 * Окна переехали из памяти процесса в базу. В памяти счётчик был честным ровно
 * до второго инстанса — окно у каждого своё, и предел молча умножался на их
 * число, — и до первого перезапуска: контейнер забывал накопленное, а на
 * бесплатном плане он перезапускается сам.
 *
 * Проверяется поэтому не «форма отказала», а строка окна в базе: она и есть
 * то, чего раньше не было. Отказ без строки означал бы, что счёт по-прежнему
 * ведётся где-то в процессе.
 *
 * Подопытная форма — напоминание ключа. Её дорогой счётчик самый тесный из
 * всех (три отправки), и добраться до предела можно за секунды, не завалив
 * стенд ничем настоящим.
 */

import { existsSync } from 'node:fs'
import { chromium } from 'playwright'
import { prisma } from '../src/lib/db'
import { LIMITS } from '../src/lib/rate-limit'

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

console.log('Ограничитель частоты')

// Состояние сценарий готовит себе сам: до него по этой форме мог ходить
// другой сценарий, и начинать надо с чистого окна.
await prisma.rateWindow.deleteMany({ where: { key: { startsWith: 'recover:' } } })

const browser = await chromium.launch(existsSync(EXECUTABLE) ? { executablePath: EXECUTABLE } : {})
const page = await (await browser.newContext()).newPage()

/** Отправляет форму напоминания и возвращает то, что показано в ответ. */
async function ask(email) {
  await page.goto(`${BASE}/enter`)
  await page.click('summary')
  await page.fill('input[name=email]', email)
  await page.click('form:has(input[name=email]) button[type=submit]')
  await page.waitForTimeout(900)

  return (await page.locator('form:has(input[name=email]) .hint').last().innerText()).trim()
}

/*
 * Бьём, пока не откажет. Потолок попыток берётся из самого предела с запасом:
 * цифру, вписанную сюда руками, однажды разведут с политикой, и сценарий
 * начнёт либо падать зря, либо не доходить до отказа.
 */
const CEILING = LIMITS.recover.limit + 2

let refusedAt = 0
let said = ''

for (let attempt = 1; attempt <= CEILING; attempt += 1) {
  said = await ask(`nobody-${attempt}@example.invalid`)

  if (said.toLowerCase().includes('too often')) {
    refusedAt = attempt
    break
  }
}

check(refusedAt > 0, `форма отказала на попытке ${refusedAt || `>${CEILING}`}: «${said}»`)
check(
  refusedAt <= LIMITS.recover.limit + 1,
  `отказ пришёл в пределах политики, а не позже: ${refusedAt}`,
)
check(said.toLowerCase().includes('try again'), 'сказано, когда возвращаться')

/*
 * Главное: счёт лежит в базе. Пока он жил в памяти, второй инстанс о нём не
 * знал, а перезапуск стирал.
 */
const windows = await prisma.rateWindow.findMany({
  where: { key: { startsWith: 'recover:' } },
  select: { key: true, count: true, resetAt: true },
})

check(windows.length > 0, `окно записано в базу: строк ${windows.length}`)
check(
  windows.every((w) => w.resetAt.getTime() > Date.now()),
  'окно ещё открыто: отказ идёт по времени, а не навсегда',
)
check(
  windows.some((w) => w.count > 0),
  `в окне посчитаны попытки: ${windows.map((w) => w.count).join(', ')}`,
)

/*
 * И обратное: отказ держится именно этой строкой. Уберём её — форма отвечает
 * снова. Проверка не косметическая: без неё «отказ» мог бы приходить откуда
 * угодно, а строка в базе — лежать рядом ни на что не влияя.
 */
await prisma.rateWindow.deleteMany({ where: { key: { startsWith: 'recover:' } } })

const after = await ask('nobody-after@example.invalid')
check(!after.toLowerCase().includes('too often'), `после сброса окна форма отвечает: «${after}»`)

// Убираем за собой: следующим сценариям чужое окно ни к чему.
await prisma.rateWindow.deleteMany({ where: { key: { startsWith: 'recover:' } } })

await browser.close()
await prisma.$disconnect()

console.log(process.exitCode ? '\nЕсть расхождения.' : '\nВсё сошлось.')
