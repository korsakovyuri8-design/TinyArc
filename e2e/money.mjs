/**
 * Деньги: счёт за стадию, оплата, открытие работы (концепт, п.14а).
 *
 * Проверяется не арифметика — её держит `pricing.test.ts` — а то, чего не
 * видно модульному тесту: что неоплаченная стадия действительно стоит, что
 * заказчик видит причину простоя своими словами, и что отметка бюро об оплате
 * тут же открывает команде работу.
 *
 * Самое дорогое здесь — третья проверка. Гейт, который закрывается, но не
 * открывается, выглядит как работающий ровно до первого живого заказчика.
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

/*
 * Поиск без учёта регистра.
 *
 * `.tag` и `.label` подняты в верхний регистр средствами CSS, а `innerText`
 * возвращает то, что видно на экране, а не то, что написано в разметке. Поиск
 * «Оплачен» по такому тексту не находит «ОПЛАЧЕН» и объявляет сломанным
 * исправный экран.
 */
function has(haystack, needle) {
  return haystack.toLowerCase().includes(needle.toLowerCase())
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

console.log('Счёт за стадию и оплата')

const bureau = await (await browser.newContext()).newPage()
await bureau.goto(`${BASE}/ops`)
await bureau.fill('input[type=password]', PASSWORD)
await bureau.click('button[type=submit]')
await bureau.waitForSelector('a[href="/ops/import"]')

// Строка берётся из очереди счетов, а не из первой таблицы на странице:
// таблиц на панели несколько, и «первая строка» указывает не сюда.
// Именно неоплаченные: в очереди висят и оплаченные — по ним видно, что
// действие прошло, когда строка не исчезает, а меняет статус.
const queue = bureau.locator('#invoices .panel:has(button:has-text("Mark as paid"))')
const waiting = await queue.count()

if (waiting === 0) {
  check(false, 'на стенде нет неоплаченного счёта: проверять оплату не на чем')
  await browser.close()
  process.exit(1)
}

check(true, `счетов ждёт оплаты: ${waiting}`)

/*
 * Дальше всё привязано к одному проекту, а не к «первой панели».
 *
 * Сценарии идут подряд, и предыдущий подтверждает стадию — а подтверждение
 * выставляет счёт за следующую. Порядок панелей от этого меняется, и тест,
 * который берёт первую попавшуюся, начинает проверять один проект, а смотреть
 * уходит в другой.
 */
const first = queue.first()
const projectHref = await first.locator('a[href^="/ops/projects/"]').getAttribute('href')
check(Boolean(projectHref), 'из очереди счетов открывается проект')

/** Неоплаченный счёт именно этого проекта. */
const unpaidHere = () =>
  bureau.locator(
    `#invoices .panel:has(a[href="${projectHref}"]):has(button:has-text("Mark as paid"))`,
  )

// Ключ заказчика бюро видит на карточке проекта — им и войдём его глазами.
await bureau.goto(`${BASE}${projectHref}`)
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

const before = await client.innerText('main')

check(has(before, 'Invoices'), 'заказчик видит счёт, а не молчание')
check(has(before, 'Awaiting payment'), 'сказано, что счёт не оплачен')
check(
  has(before, 'before work on it begins'),
  'сказано, почему платят вперёд, а не после',
)

/*
 * Причина простоя названа деньгами, а не очередью стадий. Раньше карточка
 * стадии в любом непонятном случае писала «Ждёт предыдущей стадии»; на
 * неоплаченной стадии это неправда, из-за которой заказчик ждёт нас, пока мы
 * ждём его.
 */
check(has(before, 'Awaiting payment'), 'простой объяснён деньгами, а не очередью стадий')

// Разбор цены: сумма без него — это счёт, который можно только принять на веру.
const explained =
  /m² × \d+ EUR\/m²/i.test(before) || has(before, 'floor price for this stage')
check(explained, 'под суммой видно, из чего она сложилась')

/*
 * Отзыв счёта, и он идёт до оплаты: оплаченный счёт не отзывается — деньги
 * пришли, и след платежа должен остаться.
 *
 * Проверяется то, ради чего отзыв делался. Уникальность стоит на паре «проект
 * + живая стадия»; если бы отозванный счёт продолжал её занимать, новый за ту
 * же стадию выставить было бы нельзя, то есть ошибку в сумме чинили бы правкой
 * базы. И новый счёт обязан появиться сразу: бюро, отозвавшее счёт и
 * оставшееся ни с чем, будет смотреть на стадию, стоящую без объяснимой
 * причины.
 */
await bureau.goto(`${BASE}/ops`)
const voidForm = unpaidHere().first().locator('form:has(button:has-text("Void"))')
await voidForm.locator('input[name=note]').fill('e2e check: the floor area was entered wrong.')
await voidForm.locator('button:has-text("Void")').click()
await bureau.waitForTimeout(2500)

await bureau.reload()
await bureau.waitForTimeout(1500)

check(
  (await unpaidHere().count()) === 1,
  'после отзыва счёт за ту же стадию выставлен заново, а не потерян',
)

/*
 * Бюро отмечает оплату.
 *
 * Проверяется состояние, а не всплывшая надпись. Серверное действие
 * перерисовывает страницу, и строка ответа внутри формы живёт ровно до этого
 * момента — на неё нельзя опираться ни тесту, ни оператору. Строка счёта
 * остаётся и меняет статус: вот это и есть подтверждение.
 */
await bureau.goto(`${BASE}/ops`)
// Целимся в форму, а не в панель: в панели их две — оплата и отзыв, — и у
// обеих поле называется note.
const form = unpaidHere().first().locator('form:has(button:has-text("Mark as paid"))')
await form.locator('input[name=note]').fill('e2e check: transfer received.')
await form.locator('button[type=submit]').click()
await bureau.waitForTimeout(2500)

await bureau.reload()
await bureau.waitForTimeout(1200)

check(
  has(await bureau.innerText(`#invoices .panel:has(a[href="${projectHref}"])`), 'Paid'),
  'счёт в очереди бюро помечен оплаченным',
)
// По этому проекту платить больше нечего. Проверка узкая намеренно: в очереди
// висят счета других проектов, и общее «нигде нет кнопки» было бы про них.
check(
  (await unpaidHere().count()) === 0,
  'оплаченный счёт больше не предлагают оплатить',
)

await client.reload()
await client.waitForTimeout(1200)
const after = await client.innerText('main')

check(has(after, 'Paid'), 'заказчик видит счёт оплаченным')
check(!has(after, 'Awaiting payment'), 'простоя по оплате больше нет')

/*
 * Главная проверка всего файла. Гейт, который закрывается, но не открывается,
 * выглядит работающим ровно до первого живого заказчика: деньги взяли, а
 * работа не пошла.
 */
check(
  has(after, 'In progress'),
  'оплата открыла команде работу, а не просто сменила статус счёта',
)

await browser.close()
console.log(process.exitCode ? '\nЕсть расхождения.' : '\nВсё сошлось.')
