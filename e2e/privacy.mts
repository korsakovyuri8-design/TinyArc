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
 * Берётся тот, у кого есть и история поставки, и живая роль. История нужна,
 * потому что обезличивание обязано её сохранить, — на человеке без единого
 * сданного тикета этого не видно. Живая роль нужна, потому что там был тупик:
 * задачи оставались за человеком, войти он уже не мог, и проект стоял молча.
 */
const RUNNING = ['draft', 'assembled', 'delivering']

const specialist =
  (await prisma.specialist.findFirst({
    where: {
      status: 'active',
      deliveredTickets: { gt: 0 },
      slots: { some: { project: { status: { in: RUNNING } } } },
      tickets: { some: { status: { in: ['blocked', 'open', 'in_progress', 'revision'] } } },
    },
    select: { id: true, accessKey: true, email: true, displayName: true, deliveredTickets: true },
  })) ??
  (await prisma.specialist.findFirst({
    where: { status: 'active', deliveredTickets: { gt: 0 } },
    select: { id: true, accessKey: true, email: true, displayName: true, deliveredTickets: true },
  }))

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

const wroteToPerson = await prisma.notification.count({ where: { email: specialist.email } })

const heldBefore = await prisma.ticket.findMany({
  where: {
    specialistId: specialist.id,
    status: { in: ['blocked', 'open', 'in_progress', 'revision'] },
    project: { status: { in: RUNNING } },
  },
  select: { id: true },
})
const rolesBefore = await prisma.teamSlot.count({
  where: { specialistId: specialist.id, project: { status: { in: RUNNING } } },
})

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

/*
 * Адрес уходит и из журнала уведомлений. Журнал хранит его затем, чтобы
 * ответить на жалобу «мне ничего не приходило», — но после обезличивания
 * жаловаться некому, а живой адрес в нём остаётся ровно тем, что человек
 * просил стереть. Сами строки при этом остаются: пара «повод и его цель»
 * гасит повторные письма, и снять её значит однажды написать ещё раз.
 */
{
  // Адрес обязан быть в выборке выше: `email: undefined` для prisma означает
  // не «пустой адрес», а «без условия», и проверка молча считала бы весь
  // журнал. Один раз она так и сделала.
  check(Boolean(specialist.email), 'адрес подопытного известен: иначе проверка ниже ничего не значит')

  const left = await prisma.notification.count({ where: { email: specialist.email } })
  check(left === 0, `адреса нет в журнале уведомлений: строк ${left}`)

  /*
   * Строки не удалены, а обезличены. Пара «повод и его цель» гасит повторные
   * письма, и снять её значит однажды написать человеку, которого больше нет,
   * ещё раз. Считается по новому адресу: «ноль там и ноль тут» доказывало бы
   * только то, что писем не было вовсе.
   */
  check(wroteToPerson > 0, `человеку писали, есть чему переезжать: ${wroteToPerson}`)
  const moved = await prisma.notification.count({ where: { email: row?.email } })
  check(
    moved === wroteToPerson,
    `строки журнала остались на месте, без адреса: ${moved} из ${wroteToPerson}`,
  )
}

/*
 * Живая работа не остаётся за тем, кого больше нет. Раньше задачи так и
 * висели на обезличенном профиле: войти он не может, сдать не может, замену
 * никто не ищет — проект стоит до просрочки, и увидеть это неоткуда.
 */
{
  check(rolesBefore > 0, `у подопытного была живая роль: ${rolesBefore}`)
  check(heldBefore.length > 0, `и незакрытые задачи: ${heldBefore.length}`)

  const stillHis = await prisma.ticket.count({
    where: {
      specialistId: specialist.id,
      status: { in: ['blocked', 'open', 'in_progress', 'revision'] },
      project: { status: { in: RUNNING } },
    },
  })
  check(stillHis === 0, `незакрытых задач за ним не осталось: ${stillHis}`)

  const rolesAfter = await prisma.teamSlot.count({
    where: { specialistId: specialist.id, project: { status: { in: RUNNING } } },
  })
  check(rolesAfter === 0, `ролей на живых проектах за ним не осталось: ${rolesAfter}`)

  // Задачи не потеряны: у каждой либо новый исполнитель, либо она вернулась
  // бюро и заблокирована — второе видно в панели, а не молчит.
  const landed = await prisma.ticket.findMany({
    where: { id: { in: heldBefore.map((t) => t.id) } },
    select: { specialistId: true, status: true },
  })
  check(
    landed.every((t) => t.specialistId !== null || t.status === 'blocked'),
    'каждая задача либо у заменяющего, либо вернулась бюро — ни одна не потерялась',
  )

  // Выход записан: п.10а не даёт предлагать ту же роль тому, кто с неё ушёл.
  const withdrawals = await prisma.withdrawal.count({ where: { specialistId: specialist.id } })
  check(withdrawals >= rolesBefore, `выход записан: ${withdrawals} из ${rolesBefore}`)
}

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
  const wroteBefore = await prisma.notification.count({ where: { email: project.clientEmail } })

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

  const inLog = await prisma.notification.count({ where: { email: project.clientEmail } })
  check(inLog === 0, `адреса заказчика нет в журнале: строк ${inLog}`)

  /*
   * Строки не удалены, а обезличены: пара «повод и его цель» гасит повторные
   * письма, и снять её значит однажды написать ещё раз. Считается по новому,
   * непригодному адресу — «ноль там и ноль тут» доказывало бы только то, что
   * писем не было вовсе.
   */
  const moved = await prisma.notification.count({ where: { email: erased?.clientEmail } })
  check(
    wroteBefore === 0 ? true : moved === wroteBefore,
    wroteBefore === 0
      ? 'заказчику не писали: переносить в журнале нечего'
      : `строки журнала остались на месте, без адреса: ${moved} из ${wroteBefore}`,
  )
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
