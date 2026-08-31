/**
 * Продукт как приложение.
 *
 * Проверяется не «файл манифеста отдаётся», а то, из чего складывается
 * установка: браузер ставит на домашний экран только то, у чего есть манифест
 * с иконками, режим standalone и работающий сервис-воркер. Отсутствие любого
 * из трёх превращает приложение обратно во вкладку, и заметно это не сразу.
 *
 * Отдельно и строже — то, чего воркер делать не должен. Соблазн закэшировать
 * кабинет очевиден и стоит дорого: кэш живёт на устройстве и переживает выход
 * из ключа. Человек, взявший телефон после владельца, открыл бы чужой проект.
 * Это та же дыра, от которой продукт закрывается отсутствием публичных адресов
 * у файлов, — только с другой стороны.
 */

import { existsSync } from 'node:fs'
import { chromium } from 'playwright'
import { prisma } from '../src/lib/db'

const BASE = process.env.E2E_BASE ?? 'http://127.0.0.1:3100'
const EXECUTABLE = process.env.E2E_CHROMIUM ?? '/opt/pw-browsers/chromium'
const PASSWORD = process.env.BUREAU_OPS_PASSWORD ?? ''

function check(condition, message) {
  if (!condition) {
    console.error(`  ✗ ${message}`)
    process.exitCode = 1
    return false
  }
  console.log(`  ✓ ${message}`)
  return true
}

console.log('Приложение')

const browser = await chromium.launch(existsSync(EXECUTABLE) ? { executablePath: EXECUTABLE } : {})
const page = await (await browser.newContext()).newPage()

/* --- Манифест ------------------------------------------------------------ */

await page.goto(`${BASE}/`)
await page.waitForTimeout(800)

const href = await page.getAttribute('link[rel=manifest]', 'href')
check(Boolean(href), `манифест объявлен на странице: ${href}`)

const manifest = await page.evaluate(async (url) => {
  const response = await fetch(url)
  return { status: response.status, body: await response.json() }
}, `${BASE}${href}`)

check(manifest.status === 200, `манифест отдаётся: ${manifest.status}`)
check(manifest.body.display === 'standalone', 'режим standalone: без адресной строки')
check(Boolean(manifest.body.start_url), `есть точка входа: ${manifest.body.start_url}`)

// Установка требует иконки не меньше 192 и отдельной маскируемой: без второй
// Android обрезает рисунок по своей форме и срезает ему края.
const sizes = (manifest.body.icons ?? []).map((icon) => icon.sizes)
check(sizes.includes('192x192') && sizes.includes('512x512'), `иконки: ${sizes.join(', ')}`)
check(
  (manifest.body.icons ?? []).some((icon) => (icon.purpose ?? '').includes('maskable')),
  'есть маскируемая иконка',
)

for (const icon of manifest.body.icons ?? []) {
  const got = await page.evaluate(async (url) => {
    const response = await fetch(url)
    return { status: response.status, type: response.headers.get('content-type') }
  }, `${BASE}${icon.src}`)

  check(got.status === 200 && (got.type ?? '').includes('png'), `иконка на месте: ${icon.src}`)
}

/* --- Сервис-воркер ------------------------------------------------------- */

const sw = await page.evaluate(async (url) => {
  const response = await fetch(url)
  return {
    status: response.status,
    type: response.headers.get('content-type'),
    cache: response.headers.get('cache-control'),
  }
}, `${BASE}/sw.js`)

check(sw.status === 200, `воркер отдаётся: ${sw.status}`)
check((sw.type ?? '').includes('javascript'), `воркер отдаётся как скрипт: ${sw.type}`)
// Закэшированный воркер — это старая логика, которую нечем заменить: он же и
// решает, что отдавать.
check((sw.cache ?? '').includes('no-store'), `воркер не кэшируется: ${sw.cache}`)

const registered = await page.evaluate(async () => {
  if (!('serviceWorker' in navigator)) return 'нет поддержки'
  const ready = await Promise.race([
    navigator.serviceWorker.ready.then(() => 'готов'),
    new Promise((resolve) => setTimeout(() => resolve('не дождались'), 8000)),
  ])
  return ready
})
check(registered === 'готов', `воркер зарегистрировался: ${registered}`)

/* --- Чего воркер не кэширует --------------------------------------------- */

const project = await prisma.project.findFirst({
  where: { dataErasedAt: null },
  select: { clientKey: true, title: true },
})

if (!project) {
  check(false, 'на стенде нет проекта: кэш кабинета проверить не на чем')
} else {
  const client = await (await browser.newContext()).newPage()
  await client.goto(`${BASE}/enter`)
  await client.fill('input[name=key]', project.clientKey)
  await client.click('button[type=submit]')
  await client.waitForTimeout(2000)
  check(client.url().includes('/project'), `заказчик вошёл: ${project.title}`)

  // Дожидаемся воркера и заходим в кабинет ещё раз — уже под ним.
  await client.evaluate(() => navigator.serviceWorker.ready)
  await client.goto(`${BASE}/project`)
  await client.waitForTimeout(1200)

  const cached = await client.evaluate(async () => {
    const names = await caches.keys()
    const found: string[] = []

    for (const name of names) {
      const cache = await caches.open(name)
      for (const request of await cache.keys()) found.push(new URL(request.url).pathname)
    }

    return found
  })

  check(cached.length > 0, `в кэше что-то есть, значит проверка не пустая: ${cached.length}`)
  check(
    !cached.includes('/project'),
    `кабинета в кэше нет: ${cached.filter((p) => !p.startsWith('/_next/')).join(', ') || 'только статика'}`,
  )
  check(
    cached.every((path) => path.startsWith('/_next/static/') || path.startsWith('/icon-')),
    'в кэше только неизменяемая статика и иконки',
  )
}

/* --- Воркер управляет страницей ------------------------------------------- */

/*
 * Сам ответ без сети проверяется не здесь, а модульно (`src/lib/sw.test.ts`),
 * и это исправление, а не отступление.
 *
 * Эмуляция отсутствия сети в браузере не распространяется на запросы самого
 * воркера: он иногда доходил до сервера и получал обычную страницу, отчего
 * проверка мигала примерно раз на три прогона. Мигала она на чужой эмуляции,
 * а не на нашем коде, — а проверка, которую перезапускают не глядя, не
 * защищает ничего.
 *
 * Здесь остаётся то, что браузер показывает надёжно: воркер не просто
 * зарегистрирован, а управляет страницей. Без этого он не увидит ни одного
 * запроса, и всё остальное про него было бы неправдой.
 */

const controlledPage = await (await browser.newContext()).newPage()
await controlledPage.goto(`${BASE}/`)

await controlledPage.evaluate(async () => {
  await navigator.serviceWorker.ready

  if (!navigator.serviceWorker.controller) {
    await new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true })
      setTimeout(resolve, 5000)
    })
  }
})

await controlledPage.reload({ waitUntil: 'domcontentloaded' })

check(
  await controlledPage.evaluate(() => Boolean(navigator.serviceWorker.controller)),
  'воркер управляет страницей, а не просто зарегистрирован',
)

await controlledPage.context().close()

/* --- Кабинет не оседает в кэше самого браузера ---------------------------- */

/*
 * Воркер кабинеты не кэширует намеренно — это записано в нём самом. Но у
 * браузера есть свой кэш, до которого воркеру дела нет, и закэшированный там
 * кабинет ведёт себя ровно так же: живёт на устройстве и переживает выход из
 * ключа. Закрывает это заголовок ответа.
 *
 * Проверяется он на живом ответе и обязательно под сессией: без неё кабинет
 * отвечает переходом на вход, а вход — обычная страница, которую кэшировать и
 * можно, и нужно. Проверка без входа мерила бы именно её и проходила бы,
 * ничего не проверив.
 */
{
  const keys = await prisma.specialist.findFirst({
    where: { status: 'active' },
    select: { accessKey: true },
  })

  const doors: { path: string; key?: string; password?: boolean }[] = [
    { path: '/project', key: project.clientKey },
    { path: '/work', key: keys?.accessKey },
    { path: '/ops', password: true },
  ]

  for (const door of doors) {
    if (!door.key && !door.password) {
      check(false, `не нашлось ключа, чтобы открыть ${door.path}`)
      continue
    }

    const page = await (await browser.newContext()).newPage()

    if (door.password) {
      await page.goto(`${BASE}/ops`)
      await page.fill('input[type=password]', PASSWORD)
      await page.click('button[type=submit]')
      await page.waitForSelector('a[href="/ops/import"]')
    } else {
      await page.goto(`${BASE}/enter`)
      await page.fill('input[name=key]', door.key!)
      await page.click('button[type=submit]')
      await page.waitForTimeout(1500)
    }

    const response = await page.goto(`${BASE}${door.path}`, { waitUntil: 'domcontentloaded' })
    const header = (response?.headers()['cache-control'] ?? '').toLowerCase()
    const landed = new URL(page.url()).pathname

    check(landed === door.path, `${door.path} открылся под сессией, а не увёл на вход: ${landed}`)
    check(header.includes('no-store'), `${door.path} не кладётся в кэш браузера: «${header}»`)

    await page.context().close()
  }
}

await browser.close()
await prisma.$disconnect()

console.log(process.exitCode ? '\nЕсть расхождения.' : '\nВсё сошлось.')
