/**
 * Подрядчики и закупка: сеть, короткий список и честная сводка отказов.
 *
 * Проверяется не «таблица рисуется», а три вещи, которые легче всего сломать
 * незаметно.
 *
 * Первая: позицию в выдаче нельзя купить. Защита структурная — такого поля
 * нет ни в движке, ни в базе, — и проверяется она структурно же, а не
 * обещанием в документации.
 *
 * Вторая: сводка отказов читается бюро как список дыр в сети. На стенде она
 * показывала «один без страховки» на каждой из четырнадцати работ — один
 * подрядчик с просроченным полисом попадал в причины даже там, где такую
 * работу не ведёт. Четырнадцать проблем вместо одной, и решение о найме по
 * ним принимается неправильное.
 *
 * Третья: пустая сеть показывается пустой. «Подрядчиков нет» и «мы их не
 * нашли» — разные сообщения.
 */

import { existsSync } from 'node:fs'
import { chromium } from 'playwright'
import { prisma } from '../src/lib/db'
import { buildFor } from '../src/lib/services/contractors'

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

console.log('Подрядчики и закупка')

const stamp = Date.now()
const domain = `build-${stamp}.invalid`
const town = `e2e-town-${stamp}`

const valid = new Date(Date.now() + 200 * 86_400_000)
const lapsed = new Date(Date.now() - 5 * 86_400_000)

async function contractor(name: string, over: Record<string, unknown>) {
  return prisma.contractor.create({
    data: {
      displayName: name,
      email: `${name}@${domain}`,
      status: 'active',
      tradesJson: JSON.stringify(['foundations']),
      jurisdictionsJson: JSON.stringify(['ME']),
      municipalitiesJson: JSON.stringify([]),
      typologiesJson: JSON.stringify(['villa']),
      scaleBandsJson: JSON.stringify(['250_1000']),
      portfolioRating: 9,
      insured: true,
      insuredUntil: valid,
      ...over,
    },
    select: { id: true },
  })
}

const made = [
  await contractor('local', { municipalitiesJson: JSON.stringify([town]) }),
  await contractor('stranger', {}),
  // Просроченный полис: настоящая дыра там, где он мог бы работать.
  await contractor('lapsed', { insuredUntil: lapsed }),
  // Кровельщик: на фундаментах он не дыра, а другой подрядчик.
  await contractor('roofer', { tradesJson: JSON.stringify(['roofing']), insuredUntil: lapsed }),
  await contractor('paused', { status: 'paused' }),
]

const project = await prisma.project.create({
  data: {
    clientKey: `build-${stamp}`,
    title: 'Build check',
    clientName: 'e2e',
    clientEmail: `client@${domain}`,
    typology: 'villa',
    storeys: 2,
    areaSqm: 400,
    jurisdiction: 'ME',
    municipality: town,
    climateZone: 'mediterranean',
    materialSystem: 'concrete',
    terrain: 'flat',
    gridConnection: 'grid',
    status: 'assembled',
  },
})

const build = await buildFor(project)
const foundations = build.lists.find((list) => list.trade === 'foundations')

check(build.trades.includes('foundations'), 'состав стройки выведен из проекта')
check(
  build.groups.includes('concrete_rebar'),
  'бетонной вилле в закупку попал бетон с арматурой',
)

/* Снятый с отбора в выборку не попадает вовсе. */
check(
  !build.names.paused,
  `снятый подрядчик не в сети: ${Object.keys(build.names).length} против ${made.length} заведённых`,
)

/*
 * Считается по своим записям, а не по абсолютным числам: стенд не пуст, и
 * проверка, привязанная к его наполнению, ломается от каждого нового сида.
 */
const mine = new Set(made.map((row) => row.id))
const minePassed = (foundations?.ranked ?? []).filter((row) => mine.has(row.contractorId))

check(minePassed.length === 2, `из заведённых по фундаментам прошли двое: ${minePassed.length}`)

/* Местный впереди чужого: он знает инспекцию и поставщиков. */
const localAt = minePassed.findIndex((row) => row.contractorId === made[0].id)
const strangerAt = minePassed.findIndex((row) => row.contractorId === made[1].id)
check(localAt >= 0 && localAt < strangerAt, 'местный подрядчик впереди чужого')

/* Главное: сводка отказов не приписывает кровельщика к фундаментам. */
check(foundations?.rejected.insurance === 1, 'просроченный полис назван причиной один раз')
check(
  foundations?.rejected.trade === 0,
  'не ведущий работу в причины не попал',
)
check((foundations?.outOfScope ?? 0) >= 1, 'он посчитан отдельно как «другая работа»')

/*
 * Инвариант, не зависящий от наполнения стенда: каждый подрядчик сети попал
 * ровно в одну корзину. Если он перестанет держаться, какая-то из корзин
 * начнёт врать, а какая — будет видно по числам.
 */
check(
  build.lists.every(
    (list) =>
      list.outOfScope +
        list.passed +
        Object.values(list.rejected).reduce((sum, n) => sum + n, 0) ===
      list.pooled,
  ),
  'каждый подрядчик сети попал ровно в одну корзину',
)
check(
  build.lists.every((list) => list.ranked.length <= list.passed),
  'показанных не больше, чем прошедших',
)

const roofing = build.lists.find((list) => list.trade === 'roofing')
check(
  roofing?.rejected.insurance === 1,
  'а там, где он мог бы работать, просроченный полис назван дырой',
)

/* Экран бюро. */
const browser = await chromium.launch(existsSync(EXECUTABLE) ? { executablePath: EXECUTABLE } : {})
const page = await (await browser.newContext()).newPage()

await page.goto(`${BASE}/ops`)
const password = page.locator('input[type=password]')
if (await password.count()) {
  await password.fill(process.env.BUREAU_OPS_PASSWORD ?? 'bureau-ops')
  await page.click('button[type=submit]')
  await page.waitForTimeout(2500)
}

await page.goto(`${BASE}/ops/projects/${project.id}`)
const card = (await page.locator('body').innerText()).toLowerCase()

check(card.includes('build: contractors and materials'), 'блок стройки есть в карточке')
check(card.includes('local'), 'короткий список назван именами')
check(card.includes('no valid insurance'), 'причина отказа названа словами')
check(
  card.includes('quantities come with the construction documentation'),
  'сказано, что объёмов пока нет и откуда они возьмутся',
)

/* Сеть в панели. */
await page.goto(`${BASE}/ops/contractors`)
const network = (await page.locator('body').innerText()).toLowerCase()

check(network.includes('contractor network'), 'страница сети открывается')
check(network.includes('expired'), 'просроченный полис виден бюро состоянием, а не галочкой')
check(
  network.includes('never pays for a place'),
  'правило про оплаченную позицию названо на самой странице',
)

await browser.close()

await prisma.project.delete({ where: { id: project.id } })
await prisma.contractor.deleteMany({ where: { email: { endsWith: domain } } })
await prisma.$disconnect()

console.log(process.exitCode ? '\nЕсть расхождения.' : '\nВсё сошлось.')
