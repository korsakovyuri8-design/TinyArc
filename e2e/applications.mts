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

/*
 * Журнал писем. Он писался с самого начала и не был виден нигде: на пилоте
 * почта выключена, и система знала, кого позвать, а оператор — нет. Строка
 * ответа действия этого не заменяет, она живёт до первой перерисовки.
 */
{
  await page.goto(`${BASE}/ops/letters`)
  await page.waitForTimeout(800)

  const rows = () => page.locator('tbody tr')
  const all = await rows().count()
  check(all > 0, `журнал показывает письма: строк ${all}`)

  // На стенде почта выключена, и панель обязана сказать это здесь громче
  // всего: иначе список читается как «всех уже позвали».
  check(
    (await page.locator('text=Email delivery is off').count()) > 0,
    'сказано, что письма никуда не ушли и звать надо руками',
  )

  const seen = await page.innerText('tbody')
  check(seen.includes(applicant.email), 'отказ по заявке виден в журнале с адресом')
  check(!seen.includes('application_declined'), 'повод назван словами, а не ключом из базы')

  await page.goto(`${BASE}/ops/letters?q=${encodeURIComponent(applicant.email)}`)
  await page.waitForTimeout(600)
  const narrowed = await rows().count()
  check(
    narrowed > 0 && narrowed < all,
    `поиск по адресу отвечает на «мне ничего не приходило»: строк ${narrowed} из ${all}`,
  )

  await page.goto(`${BASE}/ops/letters?q=${encodeURIComponent('nobody@example.invalid')}`)
  await page.waitForTimeout(600)
  check(
    (await page.locator('text=Nothing was written to that address').count()) > 0,
    'пустой ответ сказан словами, а не пустой таблицей',
  )
}

/*
 * Неушедшее письмо.
 *
 * Раньше запись о неудаче удалялась, и след пропадал вместе с ней: в журнале
 * письма нет, будто повода не было, а сказанное оператору «скажите сами» жило
 * до перерисовки страницы. Человек при этом остаётся не позванным, и узнать об
 * этом потом было неоткуда.
 *
 * Неудача подставляется руками: почтовый сервис на стенде не отказывает, и
 * ждать от него отказа значит не проверять этот случай никогда.
 */
{
  const row = await prisma.notification.findFirst({ orderBy: { sentAt: 'desc' } })

  if (!row) {
    check(false, 'в журнале нет ни одного письма')
  } else {
    await prisma.notification.update({
      where: { id: row.id },
      data: { status: 'failed', attempts: 2, error: 'e2e: почтовый сервис не ответил' },
    })

    await page.goto(`${BASE}/ops/letters`)
    await page.waitForTimeout(800)

    // Регистр не сравниваем: заголовок и метку оформление поднимает в
    // верхний, и проверка на точное совпадение ловила бы стиль, а не смысл.
    const said = (await page.innerText('main')).toLowerCase()
    check(said.includes('did not go out'), 'неушедшие вынесены отдельной очередью')
    check(said.includes(row.email.toLowerCase()), 'адрес того, кого не позвали, назван')
    check(said.includes('2 attempts'), 'сказано, сколько раз пытались')
    check(
      said.includes('e2e: почтовый сервис не ответил'),
      'названа причина — чинить адрес или почту, решает оператор',
    )

    await page.locator('button:has-text("Send again")').first().click()
    await page.waitForTimeout(2500)

    const after = await prisma.notification.findUniqueOrThrow({ where: { id: row.id } })
    check(after.status === 'sent', `повторная отправка увела письмо из очереди: ${after.status}`)

    await page.goto(`${BASE}/ops/letters`)
    await page.waitForTimeout(800)
    check(
      !(await page.innerText('main')).toLowerCase().includes('did not go out'),
      'очередь неушедших пуста, когда неушедших нет',
    )
  }
}

await browser.close()
await prisma.$disconnect()

console.log(process.exitCode ? '\nЕсть расхождения.' : '\nВсё сошлось.')
