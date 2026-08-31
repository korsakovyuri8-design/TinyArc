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
 * Соседняя очередь: направления готовы, выбора нет. Работу это не
 * останавливает — гейтов три, и четвёртый противоречил бы концепту, — и
 * именно поэтому простой надо видеть. Пока заказчик молчит, архитектор и
 * визуализатор работают вслепую, а переделывать будем мы.
 */
{
  check(
    opsText.includes('Projects without a chosen direction'),
    'у бюро есть очередь невыбранных направлений',
  )

  const rows = bureau.locator('#directions tbody tr')
  const count = await rows.count()
  check(count > 0, `проектов без выбора видно: ${count}`)

  // Столбец «сколько людей работает тем временем» — это и есть цена молчания;
  // без него строка выглядит напоминанием, а не простоем.
  // Регистр не проверяем: заголовки таблицы поднимает CSS, и innerText отдаёт
  // их уже поднятыми. Проверка, споткнувшаяся об оформление, проверяет его.
  const head = (await bureau.locator('#directions thead').innerText()).toLowerCase()
  check(head.includes('working meanwhile'), 'сказано, сколько человек работает, пока выбора нет')

  const first = await rows.first().locator('a[href^="/ops/projects/"]').getAttribute('href')
  check(Boolean(first), 'из очереди направлений открывается проект')
}

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

/*
 * Список проектов: тот же класс, что и пул. Проектов с работой бюро становится
 * больше каждый месяц, и предела у списка нет вовсе. Отдельно проверяется
 * поиск по ключу заказчика: с ним оператор приходит из письма, где больше не
 * за что зацепиться.
 */
{
  await bureau.goto(`${BASE}/ops/projects`)
  await bureau.waitForTimeout(600)

  const rows = () => bureau.locator('tbody tr:has(a[href^="/ops/projects/"])')
  const all = await rows().count()
  check(all > 0, `проектов в списке: ${all}`)

  // Статус берётся существующий: «ноль из четырёх» доказывало бы только то,
  // что фильтр убрал всё, а не то, что он отбирает.
  await bureau.goto(`${BASE}/ops/projects?status=delivering`)
  await bureau.waitForTimeout(400)
  const running = await rows().count()
  check(running > 0 && running < all, `статус сужает список: ${running} из ${all}`)

  await bureau.goto(`${BASE}/ops/projects?q=seed-brief-tivat`)
  await bureau.waitForTimeout(400)
  const byKey = await rows().count()
  check(byKey === 1, `поиск по ключу заказчика находит ровно один: ${byKey}`)

  await bureau.goto(`${BASE}/ops/projects?q=${encodeURIComponent('нет такого проекта')}`)
  await bureau.waitForTimeout(400)
  check((await rows().count()) === 0, 'под несуществующее не подставляется ничего')
  check(
    (await bureau.locator('text=Nothing matches').count()) > 0,
    'пустая выборка сказана словами, а не пустой таблицей',
  )

  await bureau.goto(`${BASE}/ops/projects?status=nonsense&country=XX`)
  await bureau.waitForTimeout(400)
  check((await rows().count()) === all, 'мусор в адресе не фильтрует и не роняет страницу')
}

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
