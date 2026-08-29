/**
 * Путь клиента: бриф → сборка команды → ключ доступа → возврат по ключу.
 *
 * Проверяется то, что не видно модульному тесту: серверное действие, cookie с
 * подписью, перенаправление и экран с ключом. Ключ здесь — это доступ, и он
 * обязан оставаться доступным после того, как cookie потеряли.
 */

import { existsSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE = process.env.E2E_BASE ?? 'http://127.0.0.1:3100'

/*
 * Браузер берётся из окружения, а не докачивается.
 *
 * Playwright ищет сборку под свою версию и, не найдя, зовёт `playwright
 * install`. Там, где браузер уже стоит рядом (образ CI, эта песочница),
 * докачивать нечего и незачем: путь задаётся переменной.
 */
const EXECUTABLE = process.env.E2E_CHROMIUM ?? '/opt/pw-browsers/chromium'

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
const context = await browser.newContext()
const page = await context.newPage()

console.log('Путь клиента')

await page.goto(`${BASE}/brief`)
await page.fill('#title', 'Вилла на Луштице')
await page.fill('#areaSqm', '380')
await page.fill('#storeys', '2')
await page.fill('#clientName', 'Проверка')
await page.fill('#clientEmail', 'probe@example.com')
await page.check('input[name="languages"][value="en"]')

/*
 * Согласие обязательно, и это проверяется дважды.
 *
 * Сначала без него: форма не должна пропустить. Проверка идёт на сервере, а не
 * только атрибутом в разметке, — атрибут снимается инструментами разработчика,
 * и тогда бриф появился бы без согласия, а доказать потом, что человек
 * соглашался, было бы нечем.
 *
 * Отклонённая отправка расходует слот ограничителя частоты — он считает
 * попытки до разбора формы, иначе его обходили бы кривым телом запроса. Значит
 * прогон стоит двух брифов из трёх в час; ограничитель живёт в памяти, и на
 * свежем сервере счёт начинается заново.
 */
await page.evaluate(() => {
  document.querySelector('#consent')?.removeAttribute('required')
})
await page.click('button[type="submit"]')
await page.waitForTimeout(2000)
check(
  page.url().includes('/brief'),
  'без согласия бриф не принимается даже со снятым required',
)

await page.check('#consent')

await Promise.all([
  page.waitForURL('**/project/direction**'),
  page.click('button[type="submit"]'),
])

check(page.url().includes('issued=1'), 'после брифа ведёт к выбору направления')

const directionBody = await page.textContent('body')
check(directionBody.includes('Ключ доступа'), 'ключ показан на экране, а не только в письме')
check(
  directionBody.includes('не проект и не обещание'),
  'направление помечено как необязывающее',
)

const key = await page.textContent('.panel-accent .num')
check(/^brief-[a-z2-9]+$/.test(key.trim()), `ключ выдан: ${key.trim()}`)

// Варианты выводятся из брифа: участок ровный, значит террасирования быть не должно.
const options = await page.$$eval('form label.panel h3', (nodes) =>
  nodes.map((n) => n.textContent.trim()),
)
check(options.length === 4, `предложено вариантов: ${options.length}`)
check(!options.includes('Террасирование'), 'на ровном участке террасирование не предлагается')

// Выбор одного варианта и переход в кабинет.
await page.click('form label.panel')
await Promise.all([page.waitForURL('**/project?**'), page.click('button[type="submit"]')])

const body = await page.textContent('body')
check(body.includes('Вилла на Луштице'), 'кабинет открыт по свежей сессии')
check(body.includes('Направление проекта'), 'выбранное направление показано в кабинете')

// Утечка учётных данных команды в кабинет клиента (концепт, п.13).
check(!/seed-key-/.test(body), 'ключи специалистов в кабинет клиента не попадают')
/*
 * Свой адрес клиент видеть обязан, чужие — нет. Вычёркиваются все вхождения, а
 * не первое: тот же адрес приходит и текстом на экране, и внутри RSC-полезной
 * нагрузки, и `replace` со строкой убирает только одно. Полезная нагрузка при
 * этом остаётся в проверке намеренно — она уезжает в браузер целиком, и чужая
 * почта в ней такая же утечка, как на экране.
 */
check(
  !/@example\.com/.test(body.replaceAll('probe@example.com', '')),
  'почты специалистов не попадают',
)

// Потерянная cookie не должна отрезать от проекта: для этого и нужен ключ.
const fresh = await browser.newContext()
const freshPage = await fresh.newPage()

await freshPage.goto(`${BASE}/project`)
check(freshPage.url().includes('/enter'), 'без cookie кабинет закрыт')

await freshPage.fill('#key', key.trim())
await Promise.all([freshPage.waitForURL('**/project'), freshPage.click('button[type="submit"]')])
check(
  (await freshPage.textContent('body')).includes('Вилла на Луштице'),
  'вход по ключу возвращает в тот же проект с чистого браузера',
)

// Подделка cookie: подписи нет, значит доступа нет.
const forged = await browser.newContext()
const projectId = new URL(BASE).origin
await forged.addCookies([
  { name: 'bureau_client', value: 'подставленный-id', url: projectId },
])
const forgedPage = await forged.newPage()
await forgedPage.goto(`${BASE}/project`)
check(forgedPage.url().includes('/enter'), 'cookie без подписи не пускает')

await browser.close()
console.log(process.exitCode ? '\nЕсть провалы.' : '\nВсё сошлось.')
