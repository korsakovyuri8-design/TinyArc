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
import { CANDIDATES_PER_TRADE, buildFor } from '../src/lib/services/contractors'

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

/**
 * Домен постоянный, а не с меткой времени, и это про уборку.
 *
 * Упавший прогон не доходит до конца и оставляет свои записи в базе. С
 * меняющимся доменом их потом не найти: следующий прогон считает чужие
 * фикстуры своей сетью и падает на числах, которые сам не заводил. Поэтому
 * домен один, и сценарий подметает за прошлым собой в начале, а не только за
 * собой в конце.
 */
const domain = 'e2e-build.invalid'
const town = `e2e-town-${stamp}`

await prisma.contractor.deleteMany({ where: { email: { endsWith: domain } } })
await prisma.project.deleteMany({ where: { clientEmail: { endsWith: domain } } })

const valid = new Date(Date.now() + 200 * 86_400_000)
const lapsed = new Date(Date.now() - 5 * 86_400_000)

async function contractor(name: string, over: Record<string, unknown>) {
  return prisma.contractor.create({
    data: {
      displayName: name,
      email: `${name}-${stamp}@${domain}`,
      status: 'active',
      trades: { create: [{ trade: 'foundations' }] },
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
  await contractor('roofer', { trades: { create: [{ trade: 'roofing' }] }, insuredUntil: lapsed }),
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
check(!build.names[made[4].id], 'снятый с отбора подрядчик в выборку не попал')

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

/*
 * Главное: не ведущий работу до движка не доходит вовсе.
 *
 * Раньше он читался вместе со всей сетью и попадал в сводку отказов — сначала
 * как «нет страховки», потом отдельной корзиной. Теперь работа отбирается
 * запросом по индексу, и кровельщик на фундаментах просто не существует: это
 * и быстрее, и честнее, потому что сводка отказов читается бюро как список
 * дыр в сети.
 */
check(foundations?.rejected.insurance === 1, 'просроченный полис назван причиной один раз')
check(foundations?.rejected.trade === 0, 'не ведущий работу в причины не попал')
check(foundations?.outOfScope === 0, 'и до разбора в памяти не дошёл')
check(
  !(foundations?.ranked ?? []).some((row) => row.contractorId === made[3].id),
  'кровельщика нет в списке по фундаментам',
)

/* Годных считает база, а не длина прочитанного. */
check((foundations?.eligible ?? 0) >= 2, `годных по фундаментам: ${foundations?.eligible}`)
check(
  (foundations?.eligible ?? 0) >= (foundations?.passed ?? 0),
  'годных не меньше, чем прошедших разбор',
)

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
  'каждый прочитанный подрядчик попал ровно в одну корзину',
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

/*
 * Глубина сети: дыра обязана быть видна до того, как в неё упрётся проект.
 *
 * Проверяется не процент, а то, ради чего он считается: работа, которую в
 * стране не ведёт никто, названа строкой; работа на одном подрядчике названа
 * недостаточной, хотя отбор по ней формально работает; и причина названа
 * действием — звонить или искать.
 */
check(network.includes('where the network is thin'), 'глубина сети показана в панели')
check(
  network.includes('nobody in the network'),
  'работа, которую не ведёт никто, названа отдельно от «мало»',
)
check(
  network.includes('a call, not a hire'),
  'просроченный полис назван звонком, а не наймом: он лечится сегодня',
)
check(network.includes('serbia'), 'страна без сети показана нулём, а не пропущена')

await browser.close()

/*
 * Форма роста, а не скорость машины.
 *
 * Работа подрядчика лежала в строке JSON, и выборка по ней была полным проходом
 * по сети страны: тридцать тысяч подрядчиков давали 1163 мс на карточке против
 * 13 мс на пустой сети. После переноса работы в свою таблицу с индексом — 24 мс
 * на тех же тридцати тысячах.
 *
 * Проверяется отношение, а не миллисекунды: на медленной машине абсолютный
 * порог ловит день сборочного сервера, а не возврат к полному проходу. При
 * линейном чтении две тысячи лишних подрядчиков умножили бы время в десятки
 * раз; при выборке по индексу оно почти не меняется.
 */
{
  const LOAD = 2000
  const trades = ['foundations', 'roofing', 'electrical', 'finishes'] as const

  /**
   * Минимум из трёх прогонов, а не один замер.
   *
   * Контейнер общий, и один прогон ловит чужую нагрузку так же охотно, как
   * свою. Минимум отвечает на вопрос «насколько быстро это может быть», и
   * именно он меняется, когда выборка возвращается к полному проходу. С одним
   * замером сторож мигал: 17 против 42 мс на одних и тех же данных.
   */
  async function measure(): Promise<number> {
    await buildFor(project)

    const runs: number[] = []
    for (let i = 0; i < 3; i += 1) {
      const started = Date.now()
      await buildFor(project)
      runs.push(Date.now() - started)
    }

    return Math.max(1, Math.min(...runs))
  }

  const load = `load-${stamp}`
  let made = 0

  async function loadMore(count: number) {
    for (let batch = 0; batch < count; batch += 500) {
      const size = Math.min(500, count - batch)
      const start = made + batch

      await prisma.contractor.createMany({
        data: Array.from({ length: size }, (_, i) => ({
          displayName: `Load ${start + i}`,
          email: `${load}-${start + i}@${domain}`,
          status: 'active',
          jurisdictionsJson: JSON.stringify(['ME']),
          municipalitiesJson: JSON.stringify([town]),
          typologiesJson: JSON.stringify(['villa']),
          scaleBandsJson: JSON.stringify(['250_1000']),
          portfolioRating: 8.5,
          insured: true,
          insuredUntil: valid,
        })),
      })

      const added = await prisma.contractor.findMany({
        where: { email: { startsWith: `${load}-${start}` } },
        select: { id: true },
      })
      await prisma.contractorTrade.createMany({
        data: added.map((row, i) => ({ contractorId: row.id, trade: trades[(start + i) % trades.length] })),
      })
    }

    made += count
  }

  /*
   * Сравниваются два нагруженных состояния, а не пустое с нагруженным.
   *
   * Первая редакция мерила «до вставки» против «после» и показывала ×2.5 на
   * ровной форме роста: массовая вставка оставляет статистику планировщика
   * устаревшей, и разница была не в склоне, а в том, что база ещё не пришла в
   * себя. Замер на 500 и на 2500 записях этим страдает одинаково — значит
   * отношение говорит о склоне, а не о свежести вставки.
   *
   * Проверено отдельно: 15 мс на пяти тысячах, 19 на тридцати, 18 на
   * шестидесяти. Форма ровная, и сторож обязан ловить именно её изменение.
   */
  await loadMore(500)
  const small = await measure()

  await loadMore(LOAD - 500)
  const big = await measure()

  const ratio = big / small
  const grew = LOAD / 500

  /*
   * Утверждение — «время растёт медленнее данных», и порог взят из него, а не
   * из красивого числа. Данных вчетверо больше; полный проход по сети дал бы
   * вчетверо больше времени или хуже. Замерено: на Postgres ×0.8–1.0, на
   * SQLite ×1.7–2.0 — движки разные, форма у обоих подлинейная. Порог втрое
   * лежит между наблюдаемым и тем, что означало бы возврат к проходу.
   */
  check(
    ratio < grew * 0.75,
    `время растёт медленнее данных: данных ×${grew}, времени ×${ratio.toFixed(1)} (${small} → ${big} мс)`,
  )

  /* И числа остались честными: годных стало больше, показанных — нет. */
  const loaded = await buildFor(project)
  const foundationsNow = loaded.lists.find((list) => list.trade === 'foundations')

  check(
    (foundationsNow?.eligible ?? 0) > (foundations?.eligible ?? 0),
    `годных по фундаментам стало больше: ${foundationsNow?.eligible}`,
  )
  check(
    (foundationsNow?.ranked.length ?? 0) <= 3,
    'показанных по-прежнему трое, сколько бы ни было в сети',
  )
  check(
    (foundationsNow?.pooled ?? 0) <= CANDIDATES_PER_TRADE,
    `прочитано не больше потолка: ${foundationsNow?.pooled} при потолке ${CANDIDATES_PER_TRADE}`,
  )
}

await prisma.project.delete({ where: { id: project.id } })
await prisma.contractor.deleteMany({ where: { email: { endsWith: domain } } })
await prisma.$disconnect()

console.log(process.exitCode ? '\nЕсть расхождения.' : '\nВсё сошлось.')
