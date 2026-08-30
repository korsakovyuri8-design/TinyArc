/**
 * Потерянный ключ.
 *
 * Проверяется здесь не «пришло ли письмо» — заглушка почты живёт в памяти
 * сервера, и заглянуть в неё снаружи нельзя, — а то, из-за чего эту форму
 * легче всего сделать неправильно: ответ обязан быть одинаковым, нашёлся
 * адрес или нет.
 *
 * Форма, отвечающая «такого адреса у нас нет», отвечает не тому, кто забыл
 * ключ. Она отвечает тому, кто проверяет по списку, кто у нас в заказчиках, —
 * и делает это бесплатно и без входа.
 *
 * Отсюда .mts: known-адрес берётся из базы, а не выдумывается.
 */

import { existsSync } from 'node:fs'
import { chromium } from 'playwright'
import { prisma } from '../src/lib/db'

const BASE = process.env.E2E_BASE ?? 'http://127.0.0.1:3100'
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

console.log('Потерянный ключ')

/*
 * Инвариант, без которого вся эта форма бесполезна: адрес в базе лежит в
 * одном виде. Ищет она приведённым к нижнему регистру, и заказчик, набравший
 * адрес с заглавной, до сих пор терял кабинет навсегда — ключ здесь заменяет
 * пароль, а форма честно отвечала ему, что за адресом ничего не числится.
 *
 * Проверка стоит на записях, а не на схеме: схему сторожит модульный тест, а
 * здесь ловится путь записи, который схему обошёл.
 */
{
  const clients = await prisma.project.findMany({ select: { clientEmail: true } })
  const people = await prisma.specialist.findMany({ select: { email: true } })
  const odd = [...clients.map((c) => c.clientEmail), ...people.map((p) => p.email)].filter(
    (address) => address !== address.trim().toLowerCase(),
  )

  check(
    odd.length === 0,
    odd.length === 0
      ? `все адреса в базе в одном виде: ${clients.length + people.length}`
      : `адрес записан как набрали: ${odd.slice(0, 3).join(', ')}`,
  )
}

const project = await prisma.project.findFirst({ select: { clientEmail: true, clientKey: true } })

if (!project) {
  check(false, 'на стенде нет проектов: некому забывать ключ')
  await browser.close()
  await prisma.$disconnect()
  process.exit(1)
}

/** Отправляет форму напоминания и возвращает то, что показано в ответ. */
async function ask(path, email) {
  const page = await (await browser.newContext()).newPage()

  await page.goto(`${BASE}${path}`)
  await page.click('summary')
  await page.fill('input[name=email]', email)
  await page.click('form:has(input[name=email]) button[type=submit]')
  await page.waitForTimeout(1200)

  const message = await page.locator('form:has(input[name=email]) .hint').last().innerText()
  await page.context().close()

  return message.trim()
}

const known = await ask('/enter', project.clientEmail)
const unknown = await ask('/enter', 'nobody-here-at-all@example.org')

check(known.length > 0, `на известный адрес ответ есть: «${known}»`)

/*
 * На стенде почта — заглушка, и ответ обязан это называть. «Письмо ушло» там,
 * где письмо никуда не уходит, — это человек, который будет ждать письма и не
 * дождётся, а потом решит, что ключ он потерял окончательно.
 */
check(
  /delivery is off|already gone out/i.test(known),
  'ответ соответствует режиму почты',
)
check(
  known === unknown,
  known === unknown
    ? 'ответ одинаковый: по форме не узнать, есть ли такой заказчик'
    : `ответы разошлись: «${known}» против «${unknown}»`,
)

check(!/[А-Яа-яЁё]/.test(known), `ответ по-английски: «${known}»`)

/*
 * Ошибка входа тоже приходит с сервера, и её легко оставить русской: она
 * собирается в серверном действии, куда язык страницы сам собой не попадает.
 */
const page = await (await browser.newContext()).newPage()
await page.goto(`${BASE}/enter`)
await page.fill('input[name=key]', 'no-such-key-at-all')
await page.click('form:has(input[name=key]) button[type=submit]')
await page.waitForTimeout(1000)

const failure = await page.locator('form:has(input[name=key]) .hint').last().innerText()
check(!/[А-Яа-яЁё]/.test(failure), `отказ во входе по-английски: «${failure.trim()}»`)

/*
 * Ключ, набранный не в том регистре. Он задуман так, чтобы его можно было
 * продиктовать голосом, — значит регистр в нём не значит ничего. А телефон
 * поднимает первую букву в текстовом поле сам, и ответ «такого ключа нет»
 * был честным ровно настолько, чтобы человек не понял, в чём дело.
 */
{
  const shouting = await (await browser.newContext()).newPage()
  await shouting.goto(`${BASE}/enter`)
  await shouting.fill('input[name=key]', project.clientKey.toUpperCase())
  await shouting.click('button[type=submit]')
  await shouting.waitForTimeout(1500)

  check(shouting.url().includes('/project'), 'ключ заглавными открывает тот же кабинет')
}

await browser.close()
await prisma.$disconnect()
console.log(process.exitCode ? '\nЕсть расхождения.' : '\nВсё сошлось.')
