/**
 * Разрыв между приёмкой и гейтом.
 *
 * Приёмка записывает переход транзакцией, а зависимые задачи открывает
 * следующим вызовом — вне неё. Между ними помещается перезапуск контейнера,
 * заминка базы, выкладка посреди запроса. После такого разрыва проект стоит
 * молча: стадия оплачена, подтверждена, зависимости приняты, а работа никому
 * не выдана — и заметить это неоткуда, потому что никто ничего не ждёт.
 *
 * Разрыв подставляется руками: ронять контейнер посреди приёмки в сценарии
 * нечем, а ждать, пока он упадёт сам, значит не проверять этот случай никогда.
 * Подставляется именно состояние после разрыва — задача, которую гейт обязан
 * был открыть и не открыл.
 *
 * Проверяется двое: панель обязана назвать это отдельным сигналом, и кнопка
 * обязана вылечить — гейт идемпотентен, лечение это просто позвать его снова.
 */

import { existsSync } from 'node:fs'
import { chromium } from 'playwright'
import { prisma } from '../src/lib/db'
import { stalledGates } from '../src/lib/services/pm'

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

console.log('Незакрытый гейт')

if (!PASSWORD) {
  console.error('Нужен BUREAU_OPS_PASSWORD.')
  process.exit(1)
}

/*
 * Подопытный — открытая задача на живом проекте: раз она открыта, гейт её уже
 * пропустил, то есть стадия оплачена, подтверждена и зависимости приняты.
 * Возврат её в «заблокирована» и есть состояние после разрыва.
 */
const ticket = await prisma.ticket.findFirst({
  where: {
    status: 'open',
    project: { status: { in: ['assembled', 'delivering'] } },
  },
  select: { id: true, projectId: true, title: true },
})

if (!ticket) {
  check(false, 'на стенде нет открытой задачи на живом проекте')
  await prisma.$disconnect()
  process.exit(1)
}

const before = await stalledGates()
check(before.length === 0, `до разрыва незакрытых гейтов нет: ${before.length}`)

await prisma.ticket.update({
  where: { id: ticket.id },
  data: { status: 'blocked', openedAt: null, dueAt: null },
})

const after = await stalledGates()
check(
  after.some((a) => a.ticketId === ticket.id),
  `разрыв виден как сигнал: ${after.length}`,
)

const browser = await chromium.launch(existsSync(EXECUTABLE) ? { executablePath: EXECUTABLE } : {})
const page = await (await browser.newContext()).newPage()

await page.goto(`${BASE}/ops`)
await page.fill('input[type=password]', PASSWORD)
await page.click('button[type=submit]')
await page.waitForSelector('a[href="/ops/import"]')
await page.waitForTimeout(600)

const said = (await page.innerText('main')).toLowerCase()
check(said.includes('ready to open and not open'), 'панель называет разрыв словами')
check(
  said.includes('run the gate on the project'),
  'сказано, что делать: позвать гейт, а не написать человеку',
)

// Лечение. Гейт идемпотентен: повторный вызов — это и есть починка.
await page.goto(`${BASE}/ops/projects/${ticket.projectId}`)
await page.waitForTimeout(800)

const button = page.locator('button:has-text("Run the gate")')
check((await button.count()) > 0, 'кнопка гейта есть на странице проекта')

await button.first().click()
await page.waitForTimeout(3000)

const healed = await prisma.ticket.findUniqueOrThrow({
  where: { id: ticket.id },
  select: { status: true, openedAt: true, dueAt: true },
})

check(healed.status === 'open', `гейт открыл задачу заново: ${healed.status}`)
check(Boolean(healed.openedAt), 'время открытия проставлено: срок пошёл заново')
check(Boolean(healed.dueAt), 'срок сдачи проставлен')

const left = await stalledGates()
check(
  !left.some((a) => a.ticketId === ticket.id),
  'сигнал ушёл вместе с причиной',
)

await browser.close()
await prisma.$disconnect()

console.log(process.exitCode ? '\nЕсть расхождения.' : '\nВсё сошлось.')
