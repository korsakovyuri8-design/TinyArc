/**
 * Нормы в продукте: правило области, четыре исхода, непокрытый муниципалитет.
 *
 * Проверяется не «таблица показывается», а то, ради чего слой сделан. Норма
 * решает судьбу проекта раньше, чем его облик: участок, не вмещающий заказанные
 * метры, стоит увидеть до сборки команды, а не после оплаты концепции.
 *
 * Три вещи, которые обязаны быть различимы и которые легче всего слить в одно
 * зелёное: «прошло», «нечем проверить» и «правил на этот муниципалитет у нас
 * нет». Последнее — не «всё в порядке», и молчание здесь стоит отказа органа
 * через полгода.
 *
 * Сценарий заводит себе свой муниципалитет и свои правила: настоящие трогать
 * нельзя, а ждать наполнения корпуса значит не проверять это никогда.
 */

import { existsSync } from 'node:fs'
import { chromium } from 'playwright'
import { prisma } from '../src/lib/db'
import { checkProject } from '../src/lib/services/compliance'

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

console.log('Нормы')

const stamp = Date.now()
const town = `e2e-town-${stamp}`
const source = `e2e norms ${stamp}`

const fresh = new Date(Date.now() - 10 * 86_400_000)
const stale = new Date(Date.now() - 500 * 86_400_000)

await prisma.complianceRule.createMany({
  data: [
    // Страновое: действует и там, где местного плана нет.
    { layer: 'zoning', jurisdiction: 'ME', subject: 'storeys', operator: 'max', value: 4, document: source, article: 'country', effectiveFrom: fresh, checkedAt: fresh },
    // Муниципальное, перекрывается зонным ниже.
    { layer: 'zoning', jurisdiction: 'ME', municipality: town, subject: 'floor_area_ratio', operator: 'max', value: 2, document: source, article: 'town', effectiveFrom: fresh, checkedAt: fresh },
    { layer: 'zoning', jurisdiction: 'ME', municipality: town, zone: 'Z1', subject: 'floor_area_ratio', operator: 'max', value: 0.5, document: source, article: 'zone', effectiveFrom: fresh, checkedAt: fresh },
    // Нечем проверить: пятна застройки у проекта нет.
    { layer: 'zoning', jurisdiction: 'ME', municipality: town, zone: 'Z1', subject: 'coverage_ratio', operator: 'max', value: 0.3, document: source, article: 'coverage', effectiveFrom: fresh, checkedAt: fresh },
    // Несверенное: считается, помечается, но не блокирует.
    { layer: 'zoning', jurisdiction: 'ME', municipality: town, zone: 'Z1', subject: 'storeys', operator: 'max', value: 1, document: source, article: 'old', effectiveFrom: fresh, checkedAt: stale },
  ],
})

async function project(over: Record<string, unknown>) {
  const key = `norms-${stamp}-${Math.random().toString(36).slice(2, 8)}`
  const row = await prisma.project.create({
    data: {
      clientKey: key,
      title: 'Norms check',
      clientName: 'e2e',
      clientEmail: `${key}@example.invalid`,
      typology: 'villa',
      storeys: 2,
      areaSqm: 600,
      jurisdiction: 'ME',
      climateZone: 'mediterranean',
      materialSystem: 'concrete',
      status: 'assembled',
      ...over,
    },
    select: { id: true, clientKey: true },
  })

  return row
}

const inZone = await project({ municipality: town, zone: 'Z1', plotAreaSqm: 1000 })
const elsewhere = await project({ municipality: `${town}-nowhere`, plotAreaSqm: 1000 })

const found = await checkProject(inZone.id)
const by = (subject: string) => found.findings.filter((f) => f.rule.subject === subject)

/* Узкое перекрывает широкое, и на одном предмете остаётся одно правило. */
const density = by('floor_area_ratio')
check(density.length === 1, `на плотность действует одно правило, а не все: ${density.length}`)
check(density[0]?.rule.value === 0.5, 'победило зонное правило, а не муниципальное')

/* 600 м² на участке 1000 м² — это 0,6 при пределе 0,5. */
check(density[0]?.verdict === 'fail', 'плотность выше предела названа непрошедшей')
check(
  found.blocking.some((f) => f.rule.subject === 'floor_area_ratio'),
  'непрошедшая плотность останавливает подачу',
)

/* Нечем проверить — это не «прошло». */
const coverage = by('coverage_ratio')[0]
check(coverage?.verdict === 'needs_input', 'без пятна застройки процент застройки не проверяется')
check(
  found.missing.includes('coverageRatio'),
  `недостающее названо по имени: ${found.missing.join(', ')}`,
)

/* Несверенное считается, помечается и никого не держит. */
const storeys = by('storeys')[0]
check(storeys?.rule.source.article === 'old', 'на этажность действует зонное правило')
check(storeys?.verdict === 'fail', 'два этажа при пределе в один — не прошло')
check(storeys?.stale === true, 'правило помечено как несверенное')
check(
  !found.blocking.some((f) => f.rule.subject === 'storeys'),
  'несверенное правило подачу не останавливает: это наша работа, а не проблема заказчика',
)

/* Соседний муниципалитет получает только страновое правило. */
const outside = await checkProject(elsewhere.id)
check(outside.covered, 'страновое правило действует и там, где местного плана нет')
/*
 * Проверка написана через scope намеренно: первая редакция читала
 * `f.rule.municipality` — поля, которого у правила нет, — и проходила вхолостую
 * на любом наборе данных. Пустая проверка хуже отсутствующей: она отчитывается.
 */
check(
  outside.findings.length > 0 &&
    outside.findings.every((f) => f.rule.scope.municipality === undefined),
  `чужие муниципальные правила туда не протекли: ${outside.findings.length} правил(о)`,
)

/* Экран. */
const browser = await chromium.launch(existsSync(EXECUTABLE) ? { executablePath: EXECUTABLE } : {})

async function cabinet(key: string) {
  const page = await (await browser.newContext()).newPage()
  await page.goto(`${BASE}/enter`)
  await page.fill('input[name=key]', key)
  await page.click('button[type=submit]')
  await page.waitForURL(`${BASE}/project**`, { timeout: 15_000 })
  await page.goto(`${BASE}/project`)
  return (await page.locator('body').innerText()).toLowerCase()
}

const shown = await cabinet(inZone.clientKey)
check(shown.includes('local rules'), 'панель норм есть в кабинете')
check(shown.includes('over the limit'), 'непрошедшее названо непрошедшим')
check(shown.includes('needs input'), 'непроверяемое названо непроверяемым, а не зелёным')
check(shown.includes('not verified'), 'несверенное помечено')
check(
  shown.includes('plot area and building footprint'),
  'сказано словами заказчика, чего не хватает, а не именем поля базы',
)

/* Непокрытый муниципалитет: молчание запрещено. */
const bare = await project({ municipality: `${town}-empty`, jurisdiction: 'RS', plotAreaSqm: 800 })
const bareText = await cabinet(bare.clientKey)
check(
  bareText.includes('do not yet hold the planning rules'),
  'на непокрытом муниципалитете сказано, что правил нет, а не «всё сошлось»',
)
check(!bareText.includes('within'), 'ничего не выдаётся за проверенное')

/*
 * Круг, ради которого слой и делался: заказчик даёт то, что в его бумагах, а
 * проектные величины вносит бюро — и проверка пересчитывается. Без этой части
 * панель просила бы высоту, которую физически некуда положить.
 */
{
  const page = await (await browser.newContext()).newPage()
  await page.goto(`${BASE}/ops`)
  const password = page.locator('input[type=password]')
  if (await password.count()) {
    await password.fill(process.env.BUREAU_OPS_PASSWORD ?? 'bureau-ops')
    await page.click('button[type=submit]')
    await page.waitForTimeout(2500)
  }

  await page.goto(`${BASE}/ops/projects/${inZone.id}`)
  await page.fill('#site-footprintSqm', '200')
  await page.click('button:has-text("Save site data")')
  await page.waitForTimeout(2500)

  const after = await checkProject(inZone.id)
  const coverage = after.findings.find((f) => f.rule.subject === 'coverage_ratio')

  check(coverage?.verdict === 'pass', 'внесённое пятно застройки закрыло непроверяемое правило')
  check(coverage?.actual === 0.2, `и посчитано по участку, а не по зданию: ${coverage?.actual}`)
  check(
    !after.missing.includes('coverageRatio'),
    'из списка недостающего оно ушло',
  )

  /* Пустое поле стирает значение: иначе ошибку нельзя убрать, только заменить. */
  await page.goto(`${BASE}/ops/projects/${inZone.id}`)
  await page.fill('#site-footprintSqm', '')
  await page.click('button:has-text("Save site data")')
  await page.waitForTimeout(2500)

  const cleared = await checkProject(inZone.id)
  check(
    cleared.missing.includes('coverageRatio'),
    'пустое поле стёрло значение, а не оставило прежнее',
  )
}

/*
 * Заведение корпуса. До сих пор правила попадали в базу только сидом — то есть
 * продукт проверял посадку по корпусу и сам же не давал этот корпус завести.
 * Дорогое здесь не «строка добавилась», а то, что не добавилось: разбор
 * нарочно строгий, потому что норма из не того столбца уезжает в комплект под
 * нашей подписью.
 */
{
  const page = await (await browser.newContext()).newPage()
  await page.goto(`${BASE}/ops`)
  const password = page.locator('input[type=password]')
  if (await password.count()) {
    await password.fill(process.env.BUREAU_OPS_PASSWORD ?? 'bureau-ops')
    await page.click('button[type=submit]')
    await page.waitForTimeout(2500)
  }

  const entryDoc = `Entry probe ${stamp}`
  const table = [
    'layer,jurisdiction,municipality,zone,subject,operator,value,document,article,effective_from,checked_at,url',
    `zoning,ME,${town},,height_m,max,12,${entryDoc},cl. 1,2024-01-01,2026-09-05,https://example.invalid`,
    `zoning,ME,,,setback_front_m,min,3,${entryDoc},cl. 2,2024-01-01,2026-09-05,`,
    `energy,ME,,,height_m,max,9,${entryDoc},cl. 3,2024-01-01,not-a-date,`,
  ].join('\n')

  await page.goto(`${BASE}/ops/norms`)
  await page.fill('#norm-preview', table)
  await page.click('form:has(#norm-preview) button[type=submit]')
  await page.waitForTimeout(1800)
  const preview = await page.locator('form:has(#norm-preview)').innerText()

  check(preview.includes('Ready to add: 1'), 'предпросмотр отделяет годные строки от битых')
  check(
    preview.includes('zoning does not exist at country level'),
    'зонирование без муниципалитета не берётся, и сказано почему',
  )

  const before = await prisma.complianceRule.count()
  await page.fill('#norm-run', table)
  await page.click('form:has(#norm-run) button[type=submit]')
  await page.waitForTimeout(2500)

  const added = await prisma.complianceRule.findMany({ where: { document: entryDoc } })
  check(added.length === 1, `заведена только годная строка: ${added.length}`)
  check(
    (await prisma.complianceRule.count()) === before + 1,
    'битые строки в базу не попали',
  )
  check(added[0]?.municipality === town, 'область действия записана как названа')

  /*
   * Сверка двигает дату сверки и ничего больше. Если норма изменилась, это не
   * сверка, а новая редакция, и заводится она новой записью со своей датой.
   */
  const stale = await prisma.complianceRule.update({
    where: { id: added[0]!.id },
    data: { checkedAt: new Date('2020-01-01T00:00:00.000Z') },
  })

  await page.goto(`${BASE}/ops/norms?country=ME&stale=1`)
  await page.waitForTimeout(800)
  const unverified = (await page.locator('body').innerText()).toLowerCase()
  check(unverified.includes('unverified'), 'несверённое правило помечено несверённым')

  await page.click(`form:has(input[value="${stale.id}"]) button:has-text("Checked against the source today")`)
  await page.waitForTimeout(2500)

  const rechecked = await prisma.complianceRule.findUniqueOrThrow({ where: { id: stale.id } })
  check(rechecked.checkedAt.getTime() > stale.checkedAt.getTime(), 'сверка подвинула дату')
  check(rechecked.value === stale.value, 'сверка не тронула значение нормы')

  await prisma.complianceRule.deleteMany({ where: { document: entryDoc } })
  await page.context().close()
}

await browser.close()

await prisma.project.deleteMany({ where: { id: { in: [inZone.id, elsewhere.id, bare.id] } } })
await prisma.complianceRule.deleteMany({ where: { document: source } })
await prisma.$disconnect()

console.log(process.exitCode ? '\nЕсть расхождения.' : '\nВсё сошлось.')
