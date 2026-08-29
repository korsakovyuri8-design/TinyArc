/**
 * Английская версия: полнота перевода и связь версий.
 *
 * Проверка простая до грубости — на английской странице не должно остаться
 * кириллицы, — и именно поэтому она работает. Недопереведённая страница не
 * ломается и не падает: она открывается, выглядит рабочей и наполовину состоит
 * из русского. Заметить это может только тот, кто специально пришёл её читать.
 *
 * Список страниц ведётся руками и растёт по мере перевода. Автоматический
 * обход всех адресов сюда не годится: панель бюро остаётся русской намеренно,
 * за ней сидит бюро.
 *
 * Кабинеты в список не входят: за ними нужен ключ, а без ключа страница
 * отдаёт форму входа, и проверка молча проверяла бы её вместо кабинета.
 */

import { existsSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE = process.env.E2E_BASE ?? 'http://127.0.0.1:3100'
const EXECUTABLE = process.env.E2E_CHROMIUM ?? '/opt/pw-browsers/chromium'

/** Страницы, переведённые целиком. Список растёт вместе со словарём. */
const TRANSLATED = [
  '/',
  '/how-it-works',
  '/algorithm',
  '/specialists',
  '/specialists/apply',
  '/brief',
  '/enter',
  '/legal/offer',
  '/legal/privacy',
]

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
const page = await (await browser.newContext()).newPage()

console.log('Английская версия')

for (const path of TRANSLATED) {
  await page.goto(`${BASE}/en${path === '/' ? '' : path}`)
  await page.waitForTimeout(400)

  const cyrillic = await page.evaluate(() => {
    const text = document.body.innerText
    const found = new Set()

    for (const match of text.matchAll(/[А-Яа-яЁё][^\n]{0,40}/g)) found.add(match[0].trim())

    return [...found].slice(0, 5)
  })

  check(
    cyrillic.length === 0,
    cyrillic.length === 0
      ? `/en${path} — без русского`
      : `/en${path} — осталось русское: ${cyrillic.join(' | ')}`,
  )
}

// Русская версия жива по прежним адресам: приставки `/ru` не существует.
await page.goto(`${BASE}/`)
await page.waitForTimeout(300)
check(
  (await page.locator('html').getAttribute('lang')) === 'ru',
  'корневой адрес остаётся русским',
)

await page.goto(`${BASE}/en`)
await page.waitForTimeout(300)
check((await page.locator('html').getAttribute('lang')) === 'en', 'на /en атрибут lang английский')

/*
 * Переключатель ведёт на ту же страницу, а не на главную. Сброс на главную
 * заставляет второй раз искать то, что уже нашли, и этого достаточно, чтобы
 * переключателем не пользовались.
 */
await page.goto(`${BASE}/brief`)
await page.waitForTimeout(300)
const toEnglish = await page.locator('.locale-switch a', { hasText: 'EN' }).getAttribute('href')
check(toEnglish === '/en/brief', `переключатель ведёт на ту же страницу: ${toEnglish}`)

await page.goto(`${BASE}/en/brief`)
await page.waitForTimeout(300)
const toRussian = await page.locator('.locale-switch a', { hasText: 'RU' }).getAttribute('href')
check(toRussian === '/brief', `и обратно: ${toRussian}`)

/*
 * hreflang — то, чем поисковику объясняют, что это одна страница на двух
 * языках. Без него он выбирает одну сам, и обычно не ту.
 */
const alternates = await page.evaluate(() =>
  [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map((el) => [
    el.getAttribute('hreflang'),
    el.getAttribute('href'),
  ]),
)

check(alternates.length === 2, `объявлены обе версии: ${JSON.stringify(alternates)}`)

await browser.close()
console.log(process.exitCode ? '\nЕсть расхождения.' : '\nВсё сошлось.')
