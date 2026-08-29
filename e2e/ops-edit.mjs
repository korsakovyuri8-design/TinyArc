/**
 * Правка профиля специалиста бюро.
 *
 * Кабинет специалиста говорит человеку, что поля отбора меняются через бюро.
 * Этот путь проверяет, что обещание исполнимо: экран есть, правка доходит до
 * базы, а проверки те же, что на публичной заявке.
 *
 * Отдельно проверяется геодезист. У геодезии нет словаря специализаций, и
 * требование «отметьте хотя бы одну» когда-то закрывало ему вход целиком:
 * форма требовала отметить то, чего в ней нет. Это тот случай, где регрессия
 * не видна ни на ком, кроме одной дисциплины из восьми.
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

/**
 * Сохранился ли профиль.
 *
 * Смотрим на видимый элемент, а не на текст всей страницы: в текст body
 * попадает и служебная разметка Next, где лежит неотрендеренная разметка
 * успеха. Поиск строки по body давал «сохранено» там, где ничего не
 * сохранялось, — на этом я потерял полчаса.
 */
async function saved(page) {
  return (await page.locator('.panel-accent .label', { hasText: 'Profile saved' }).count()) > 0
}

const browser = await chromium.launch(
  existsSync(EXECUTABLE) ? { executablePath: EXECUTABLE } : {},
)
const page = await (await browser.newContext()).newPage()

console.log('Правка профиля в панели')

await page.goto(`${BASE}/ops`)
await page.fill('input[type=password]', PASSWORD)
await page.click('button[type=submit]')
await page.waitForSelector('a[href="/ops/import"]')

await page.goto(`${BASE}/ops/pool`)
const href = await page.getAttribute('tbody a[href^="/ops/pool/"]', 'href')
check(Boolean(href), 'из пула открывается профиль')

/*
 * Поиск и сужение списка. Пул — это вся база бюро одной таблицей, и без
 * условий оператор ищет человека глазами по сотне строк. Проверяется, что
 * условие действительно сужает, что имя находится с ошибкой в регистре и что
 * пустая выборка сказана словами, а не показана пустой таблицей.
 */
{
  const count = async () => page.locator('tbody tr:has(a[href^="/ops/pool/"])').count()

  const all = await count()
  check(all > 0, `в пуле есть кого искать: строк ${all}`)

  const name = await page.locator('tbody a[href^="/ops/pool/"]').first().innerText()
  await page.goto(`${BASE}/ops/pool?q=${encodeURIComponent(name.toUpperCase())}`)
  const found = await count()
  check(found > 0 && found < all, `имя находится не глядя на регистр: строк ${found}`)

  await page.goto(`${BASE}/ops/pool?discipline=survey`)
  const surveying = await count()
  check(surveying > 0 && surveying < all, `дисциплина сужает список: строк ${surveying}`)

  await page.goto(`${BASE}/ops/pool?q=${encodeURIComponent('нет такого человека')}`)
  check((await count()) === 0, 'под несуществующее имя не подставляется никто')
  check(
    (await page.locator('text=Nobody matches').count()) > 0,
    'пустая выборка сказана словами, а не пустой таблицей',
  )

  await page.goto(`${BASE}/ops/pool?discipline=astrology&country=XX`)
  check((await count()) === all, 'мусор в адресе не фильтрует и не роняет страницу')

  // Покрытие и дыры считаются по всему пулу: сузить их вместе с таблицей
  // значило бы показать дыру там, где её закрывает отфильтрованный человек.
  const coverage = async () =>
    page.locator('.panel:has-text("Coverage by discipline") .tag').allInnerTexts()

  await page.goto(`${BASE}/ops/pool`)
  const whole = (await coverage()).join('|')
  await page.goto(`${BASE}/ops/pool?q=${encodeURIComponent(name)}`)
  check(
    (await coverage()).join('|') === whole && whole.length > 0,
    'покрытие считается по всему пулу, а не по выборке',
  )
}

await page.goto(`${BASE}${href}`)
check(
  (await page.locator('input[name=weeklyCapacityHours]:not([type=hidden])').count()) === 0,
  'ёмкость у бюро не спрашивается: временем распоряжается специалист',
)
check(
  (await page.locator('input[name=portfolioRating]').count()) === 0,
  'рейтинг здесь не правится: он меняется разбором',
)

/*
 * Правка факта доходит до базы. Правится часовой пояс, а не юрисдикция.
 *
 * Раньше здесь переключалась галочка страны: «отмечена — снять, не отмечена —
 * поставить». Это держалось на том, кто окажется первым в списке пула, а
 * порядок в пуле меняется от состава пула. Первым оказался человек, у которого
 * RS — единственная страна; снятие оставило его без юрисдикций вовсе, форма
 * законно отказала, и тест сообщил «правка не сохранена» про исправную правку.
 *
 * Часовой пояс свободен от перекрёстных проверок и, в отличие от галочки,
 * возвращается в исходное: тест можно гонять подряд, не вычерпывая профиль.
 */
const timezoneField = page.locator('#utcOffset')
const before = Number(await timezoneField.inputValue())
const next = before === 3 ? 2 : 3

await timezoneField.fill(String(next))
// Кнопку называем по подписи: на странице профиля есть и другие формы —
// смена подписки стоит выше, и «первая кнопка отправки» указывает на неё.
await page.click('button:has-text("Save the profile")')
await page.waitForTimeout(2200)

if (check(await saved(page), 'правка сохранена')) {
  const fresh = await (await browser.newContext()).newPage()
  await fresh.goto(`${BASE}/ops`)
  await fresh.fill('input[type=password]', PASSWORD)
  await fresh.click('button[type=submit]')
  await fresh.waitForSelector('a[href="/ops/import"]')
  await fresh.goto(`${BASE}${href}`)

  // Читаем с чистой сессии: страница после сохранения могла бы показать то,
  // что отправили, а не то, что записали.
  const after = Number(await fresh.locator('#utcOffset').inputValue())
  check(after === next, `изменение дошло до базы (${before} → ${after})`)
  await fresh.close()
}

// Геодезист: у его дисциплины специализаций нет, и это не должно мешать.
await page.goto(`${BASE}/ops/pool`)
// Слово «Геодезия» встречается и в матрице покрытия, где ссылок нет: берём
// только строки поимённого списка, то есть те, где есть переход в профиль.
const surveyors = page.locator('tbody tr:has(a[href^="/ops/pool/"])', { hasText: 'Survey' })

if ((await surveyors.count()) > 0) {
  const link = await surveyors.first().locator('a[href^="/ops/pool/"]').getAttribute('href')
  await page.goto(`${BASE}${link}`)

  check(
    (await page.locator('input[name=specializations]:checked').count()) === 0,
    'у геодезиста специализаций не отмечено — их у дисциплины и нет',
  )

  await page.click('button:has-text("Save the profile")')
  await page.waitForTimeout(2200)
  check(await saved(page), 'профиль геодезиста сохраняется без специализации')
} else {
  console.log('  · геодезиста в пуле нет, проверка пропущена')
}

/*
 * Проверки те же, что на публичной заявке: оператор их не обходит.
 *
 * Профиль под эту проверку ищется, а не берётся первый попавшийся: нужен
 * человек, у которого есть страна без отметки, а у первого в списке все три
 * могут оказаться отмечены. Проверка, которая тихо пропускается на неудобных
 * данных, — это проверка, которой нет.
 */
await page.goto(`${BASE}/ops/pool`)
const links = await page.$$eval('tbody a[href^="/ops/pool/"]', (nodes) =>
  nodes.map((n) => n.getAttribute('href')).slice(0, 12),
)

let free = null

for (const candidate of links) {
  await page.goto(`${BASE}${candidate}`)
  free = await page
    .locator('input[name=jurisdictions]:not(:checked)')
    .first()
    .getAttribute('value')
    .catch(() => null)

  if (free) break
}

if (free) {
  await page.check(`input[name=signsIn][value=${free}]`)
  await page.click('button:has-text("Save the profile")')
  await page.waitForTimeout(2000)
  check(!(await saved(page)), 'подпись там, где человек не работал, не проходит и у бюро')
} else {
  // Молча пропущенная проверка — это проверка, которой нет.
  check(false, 'не нашлось профиля со свободной страной: проверку подписи негде провести')
}

await browser.close()

console.log(process.exitCode ? '\nЕсть расхождения.' : '\nВсё сошлось.')
