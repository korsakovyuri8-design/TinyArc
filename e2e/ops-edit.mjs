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
  return (await page.locator('.panel-accent .label', { hasText: 'Профиль сохранён' }).count()) > 0
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

await page.goto(`${BASE}${href}`)
check(
  (await page.locator('input[name=weeklyCapacityHours]:not([type=hidden])').count()) === 0,
  'ёмкость у бюро не спрашивается: временем распоряжается специалист',
)
check(
  (await page.locator('input[name=portfolioRating]').count()) === 0,
  'рейтинг здесь не правится: он меняется разбором',
)

// Правка факта доходит до базы. Юрисдикцию добавляем, а не снимаем: без
// юрисдикции специалиста не бывает, и снятие упёрлось бы в другую проверку.
const before = await page.isChecked('input[name=jurisdictions][value=RS]')
if (before) await page.uncheck('input[name=jurisdictions][value=RS]')
else await page.check('input[name=jurisdictions][value=RS]')
await page.uncheck('input[name=signsIn][value=RS]').catch(() => {})
await page.click('button[type=submit]')
await page.waitForTimeout(2200)

if (check(await saved(page), 'правка сохранена')) {
  const fresh = await (await browser.newContext()).newPage()
  await fresh.goto(`${BASE}/ops`)
  await fresh.fill('input[type=password]', PASSWORD)
  await fresh.click('button[type=submit]')
  await fresh.waitForSelector('a[href="/ops/import"]')
  await fresh.goto(`${BASE}${href}`)

  const after = await fresh.isChecked('input[name=jurisdictions][value=RS]')
  check(after === !before, `изменение дошло до базы (${before} → ${after})`)
  await fresh.close()
}

// Геодезист: у его дисциплины специализаций нет, и это не должно мешать.
await page.goto(`${BASE}/ops/pool`)
// Слово «Геодезия» встречается и в матрице покрытия, где ссылок нет: берём
// только строки поимённого списка, то есть те, где есть переход в профиль.
const surveyors = page.locator('tbody tr:has(a[href^="/ops/pool/"])', { hasText: 'Геодезия' })

if ((await surveyors.count()) > 0) {
  const link = await surveyors.first().locator('a[href^="/ops/pool/"]').getAttribute('href')
  await page.goto(`${BASE}${link}`)

  check(
    (await page.locator('input[name=specializations]:checked').count()) === 0,
    'у геодезиста специализаций не отмечено — их у дисциплины и нет',
  )

  await page.click('button[type=submit]')
  await page.waitForTimeout(2200)
  check(await saved(page), 'профиль геодезиста сохраняется без специализации')
} else {
  console.log('  · геодезиста в пуле нет, проверка пропущена')
}

// Проверки те же, что на публичной заявке: оператор их не обходит.
await page.goto(`${BASE}${href}`)
const free = await page
  .locator('input[name=jurisdictions]:not(:checked)')
  .first()
  .getAttribute('value')
  .catch(() => null)

if (free) {
  await page.check(`input[name=signsIn][value=${free}]`)
  await page.click('button[type=submit]')
  await page.waitForTimeout(2000)
  check(!(await saved(page)), 'подпись там, где человек не работал, не проходит и у бюро')
}

await browser.close()

console.log(process.exitCode ? '\nЕсть расхождения.' : '\nВсё сошлось.')
