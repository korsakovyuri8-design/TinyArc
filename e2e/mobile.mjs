/**
 * Вёрстка на телефоне: страница не должна ездить вбок.
 *
 * Горизонтальная прокрутка — самая частая и самая незаметная поломка: на
 * десктопе её не видно вообще, а на телефоне она превращает страницу в
 * болтающийся лист. Появляется она от одной широкой таблицы или длинного слова
 * без переносов, то есть от любой правки контента.
 *
 * Проверяется именно прокрутка документа. Широкий блок внутри собственного
 * контейнера с overflow-x — это приём, а не поломка: так живут таблицы.
 *
 * Нужен запущенный сервер.
 */

import { existsSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE = process.env.E2E_BASE ?? 'http://127.0.0.1:3100'
const EXECUTABLE = process.env.E2E_CHROMIUM ?? '/opt/pw-browsers/chromium'

/** Узкий из распространённых: если сходится здесь, сойдётся и шире. */
const VIEWPORT = { width: 390, height: 844 }

const PUBLIC_PAGES = ['/', '/how-it-works', '/algorithm', '/brief', '/specialists', '/specialists/apply', '/enter', '/legal/offer', '/legal/specialists', '/legal/privacy']

/** Ключи синтетического пула: страницы за входом тоже открывают с телефона. */
const BEHIND_KEY = [
  { key: 'seed-key-01', paths: ['/work', '/work/profile'] },
  { key: 'seed-brief-tivat', paths: ['/project'] },
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

async function assertNoSideways(page, path) {
  await page.goto(`${BASE}${path}`)
  await page.waitForTimeout(400)

  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }))

  check(
    scrollWidth <= innerWidth + 1,
    `${path} — без горизонтальной прокрутки (${scrollWidth}/${innerWidth})`,
  )
}

console.log(`Вёрстка на ${VIEWPORT.width}px`)

const guest = await (await browser.newContext({ viewport: VIEWPORT })).newPage()
for (const path of PUBLIC_PAGES) await assertNoSideways(guest, path)

for (const { key, paths } of BEHIND_KEY) {
  const page = await (await browser.newContext({ viewport: VIEWPORT })).newPage()

  await page.goto(`${BASE}/enter`)
  await page.fill('input[name=key]', key)
  await page.click('button[type=submit]')
  await page.waitForTimeout(1500)

  if (!check(!page.url().endsWith('/enter'), `ключ ${key} пускает`)) continue

  for (const path of paths) await assertNoSideways(page, path)
}

// Навигация в шапке не помещается в строку и прокручивается лентой. Проверяем,
// что ссылки при этом остались на месте: перенос вместо прокрутки прятал их
// за нижнюю границу шапки, и часть просто исчезала.
await guest.goto(BASE)
const navLinks = await guest.locator('.nav a').count()
check(navLinks >= 5, `все ссылки шапки на месте (${navLinks})`)

/*
 * Видимый фокус. Проверяется на брифе: там двадцать с лишним полей, и человек,
 * идущий по ним табом, обязан видеть, где он. Обводку рисует `:focus-visible`,
 * и после нажатия Tab она обязана появиться.
 */
{
  const page = await (await browser.newContext({ viewport: { width: 1200, height: 900 } })).newPage()
  await page.goto(`${BASE}/brief`)
  await page.waitForTimeout(400)

  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')

  const outline = await page.evaluate(() => {
    const active = document.activeElement
    if (!active || active === document.body) return null

    const style = getComputedStyle(active)
    return { width: style.outlineWidth, style: style.outlineStyle, tag: active.tagName }
  })

  check(
    outline !== null && outline.style !== 'none' && parseFloat(outline.width) > 0,
    outline ? `фокус виден на <${outline.tag.toLowerCase()}>: ${outline.style} ${outline.width}` : 'фокус никуда не встал',
  )
}

await browser.close()

console.log(process.exitCode ? '\nЕсть расхождения.' : '\nВсё сошлось.')
