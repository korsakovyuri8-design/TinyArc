/**
 * Возврат работы на круг: письмо на каждый круг.
 *
 * Это тот же случай, что и открытие задачи, только хуже. Человек считает, что
 * работу сдал, и в доску не заходит; статус тем временем сменился, срок пошёл
 * заново, и круг правок ему уже записан. До письма мы считали ему то, о чём он
 * не знал.
 *
 * Проверяется и второй круг. Запись об отправке гасит повторы, и ключ, забывший
 * про номер круга, погасил бы второе письмо вместе с ними — молча и навсегда.
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

console.log('Возврат на круг')

const ticket = await prisma.ticket.findFirst({
  where: { status: { in: ['open', 'in_progress'] }, specialistId: { not: null } },
  include: { specialist: { select: { accessKey: true, email: true } } },
})

if (!ticket?.specialist) {
  check(false, 'на стенде нет взятой задачи')
  await browser.close()
  await prisma.$disconnect()
  process.exit(1)
}

const person = await (await browser.newContext()).newPage()
await person.goto(`${BASE}/enter`)
await person.fill('input[name=key]', ticket.specialist.accessKey)
await person.click('button[type=submit]')
await person.waitForTimeout(1500)

const bureau = await (await browser.newContext()).newPage()
await bureau.goto(`${BASE}/ops`)
await bureau.fill('input[type=password]', PASSWORD)
await bureau.click('button[type=submit]')
await bureau.waitForSelector('a[href="/ops/import"]')

/** Специалист сдаёт работу; если задача ещё не взята — берёт её. */
async function submit() {
  await person.goto(`${BASE}/work/${ticket.id}`)
  await person.waitForTimeout(600)

  const claim = person.locator('button:has-text("Take it on")')
  if ((await claim.count()) > 0) {
    await claim.click()
    await person.waitForTimeout(1200)
  }

  await person.click('button:has-text("Hand in the work")')
  await person.waitForTimeout(1500)
}

/** Бюро возвращает её с причиной. */
async function sendBack(note) {
  await bureau.goto(`${BASE}/ops/projects/${ticket.projectId}`)
  await bureau.waitForTimeout(800)

  const form = bureau.locator(`form:has(button:has-text("Send back for revision"))`).first()
  await form.locator('textarea, input[name=note]').first().fill(note)
  await form.locator('button[type=submit]').click()
  await bureau.waitForTimeout(2000)
}

await submit()
await sendBack('e2e check: the section list does not match the brief.')

const first = await prisma.ticket.findUnique({
  where: { id: ticket.id },
  select: { status: true, revisionRounds: true },
})
check(first?.status === 'revision', 'задача вернулась на круг')

const letters = () =>
  prisma.notification.findMany({ where: { kind: 'ticket_revision' }, select: { targetId: true, email: true } })

const afterFirst = await letters()
check(
  afterFirst.some((n) => n.targetId === `${ticket.id}:${first?.revisionRounds}`),
  `письмо о первом круге ушло: ${afterFirst.length}`,
)
check(
  afterFirst.every((n) => n.email === ticket.specialist!.email),
  'письмо ушло исполнителю, а не кому-то ещё',
)

// Второй круг: повод новый, и запись про первый не должна его погасить.
await submit()
await sendBack('e2e check: the second round, the same section.')

const second = await prisma.ticket.findUnique({
  where: { id: ticket.id },
  select: { revisionRounds: true },
})
const afterSecond = await letters()

check(second?.revisionRounds === (first?.revisionRounds ?? 0) + 1, 'круг второй записан')
check(
  afterSecond.some((n) => n.targetId === `${ticket.id}:${second?.revisionRounds}`),
  `письмо о втором круге ушло тоже: ${afterSecond.length}`,
)

await browser.close()
await prisma.$disconnect()
console.log(process.exitCode ? '\nЕсть расхождения.' : '\nВсё сошлось.')
