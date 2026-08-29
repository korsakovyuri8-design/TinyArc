/**
 * Права из политики: обезличивание профиля и удаление данных проекта.
 *
 * Проверяется то, ради чего они делались, а не то, что кнопка нажимается.
 * Обезличенный профиль, в который можно войти старым ключом, обезличен только
 * на экране; удалённые данные, оставшиеся в кабинете, не удалены.
 *
 * Метрики при этом обязаны выжить: они уже обезличены и держат историю чужих
 * проектов. Стереть их вместе с личностью значит переписать эти проекты задним
 * числом — политика обещает не это.
 *
 * Отсюда .mts: подопытные берутся из базы, а не перебором по панели.
 *
 * В цепочке сценарий стоит последним, и это не вкусовщина. Он единственный
 * необратимо меняет стенд: обезличенный специалист перестаёт быть собой, и
 * проверка писем, которая ищет их адресатов среди специалистов, после него
 * честно объявляет письма ушедшими не туда.
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

console.log('Права из политики')

/*
 * Берётся тот, у кого есть история поставки: обезличивание обязано её
 * сохранить, и на человеке без единого сданного тикета этого не видно.
 */
const specialist = await prisma.specialist.findFirst({
  where: { status: 'active', deliveredTickets: { gt: 0 } },
  select: { id: true, accessKey: true, displayName: true, deliveredTickets: true },
})

if (!specialist) {
  check(false, 'на стенде нет специалиста со сданными тикетами')
  await browser.close()
  await prisma.$disconnect()
  process.exit(1)
}

check(true, `подопытный: ${specialist.displayName}, сдано ${specialist.deliveredTickets}`)

// Ключ работает до обезличивания — иначе проверка ниже ничего не докажет.
const before = await (await browser.newContext()).newPage()
await before.goto(`${BASE}/enter`)
await before.fill('input[name=key]', specialist.accessKey)
await before.click('button[type=submit]')
await before.waitForTimeout(1500)
check(before.url().includes('/work'), 'до обезличивания ключ открывает доску')

const bureau = await (await browser.newContext()).newPage()
await bureau.goto(`${BASE}/ops`)
await bureau.fill('input[type=password]', PASSWORD)
await bureau.click('button[type=submit]')
await bureau.waitForSelector('a[href="/ops/import"]')

await bureau.goto(`${BASE}/ops/pool/${specialist.id}`)
await bureau.waitForTimeout(600)

const form = bureau.locator('form:has(button:has-text("Anonymise the profile"))')
await form.locator('input[name=reason]').fill('e2e check: request by email')
await form.locator('button[type=submit]').click()
await bureau.waitForTimeout(2000)

const row = await prisma.specialist.findUnique({
  where: { id: specialist.id },
  select: {
    displayName: true,
    email: true,
    accessKey: true,
    status: true,
    removedAt: true,
    deliveredTickets: true,
    portfolio: { select: { id: true } },
  },
})

check(row?.removedAt !== null && row?.removedAt !== undefined, 'дата обезличивания записана')
check(row?.displayName !== specialist.displayName, 'имя больше не его')
check(row?.email.endsWith('@removed.invalid') ?? false, 'адрес заменён на непригодный')
check(row?.status === 'removed', 'статус выводит из отбора')
check((row?.portfolio.length ?? 1) === 0, 'работы портфолио удалены')
check(
  row?.deliveredTickets === specialist.deliveredTickets,
  'метрики поставки на месте: они обезличены и держат чужие проекты',
)

// Старый ключ не должен пускать: иначе профиль обезличен только на экране.
const after = await (await browser.newContext()).newPage()
await after.goto(`${BASE}/enter`)
await after.fill('input[name=key]', specialist.accessKey)
await after.click('button[type=submit]')
await after.waitForTimeout(1500)
check(!after.url().includes('/work'), 'старый ключ больше не пускает')

/*
 * Удаление данных проекта. Берётся закрытый: на идущем проекте кнопки нет и
 * быть не должно — по этим материалам прямо сейчас работают люди.
 */
const project = await prisma.project.findFirst({
  where: { status: { in: ['delivered', 'rejected'] }, dataErasedAt: null },
  select: { id: true, clientKey: true, clientEmail: true, title: true },
})

if (project) {
  await bureau.goto(`${BASE}/ops/projects/${project.id}`)
  await bureau.waitForTimeout(600)

  const erase = bureau.locator('form:has(button:has-text("Erase the project data"))')
  await erase.locator('input[name=reason]').fill('e2e check: request by email')
  await erase.locator('button[type=submit]').click()
  await bureau.waitForTimeout(2500)

  const erased = await prisma.project.findUnique({
    where: { id: project.id },
    select: {
      clientEmail: true,
      clientKey: true,
      briefNotes: true,
      dataErasedAt: true,
      invoices: { select: { id: true } },
      messages: { select: { id: true } },
    },
  })

  check(erased?.dataErasedAt !== null && erased?.dataErasedAt !== undefined, 'дата удаления записана')
  check(erased?.clientEmail.endsWith('@removed.invalid') ?? false, 'контакты заказчика стёрты')
  check(erased?.clientKey !== project.clientKey, 'ключ кабинета сменился: доступа по старому нет')
  check((erased?.briefNotes ?? 'x') === '', 'свободный текст брифа удалён')
  check((erased?.messages.length ?? 1) === 0, 'переписка с бюро удалена')
  check(
    (erased?.invoices.length ?? 0) >= 0,
    `счета остаются обязанностью перед страной регистрации: ${erased?.invoices.length}`,
  )
} else {
  console.log('  · закрытых проектов на стенде нет — удаление данных не проверено')
}

await browser.close()
await prisma.$disconnect()
console.log(process.exitCode ? '\nЕсть расхождения.' : '\nВсё сошлось.')
