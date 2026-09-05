/**
 * Вторая сторона денег: что бюро должно за работу.
 *
 * У бюро была только выручка. Концепт называет гонорар специалиста одной
 * фразой, в продукте его не было ни полем, ни записью, и валовая маржа не
 * считалась не из-за недостающего экрана, а из-за недостающего слагаемого.
 *
 * Дорогое здесь — не «число показано», а «числа нет, когда его не должно
 * быть». Незаданная ставка обязана читаться как «не задано», а не как ноль:
 * ноль означает бесплатную работу, то есть маржу, равную всей цене стадии, и
 * ошибка эта всегда в одну сторону — бизнес выглядит прибыльнее, чем он есть.
 *
 * Сценарий заводит свой проект, своего человека и свою пару «дисциплина +
 * стадия», а в конце убирает и ставку: пара выбрана из отложенных ролей на
 * стадии, до которой стенд не доходит, чтобы поставленная ставка не подставила
 * сумму в чужие обязательства.
 */

import { existsSync } from 'node:fs'
import { chromium } from 'playwright'
import { prisma } from '../src/lib/db'
import {
  PayoutRefused,
  accrueFor,
  economicsOf,
  markPayoutPaid,
  setRate,
  unratedObligations,
} from '../src/lib/services/payouts'

const BASE = process.env.E2E_BASE ?? 'http://127.0.0.1:3100'
const EXECUTABLE = process.env.E2E_CHROMIUM ?? '/opt/pw-browsers/chromium'

/** Отложенная роль на стадии, до которой сид не доходит. */
const DISCIPLINE = 'dfma'
const STAGE = 'construction'
const RATE = 700
const CHARGED = 2000

function check(condition: unknown, message: string) {
  if (!condition) {
    console.error(`  ✗ ${message}`)
    process.exitCode = 1
    return false
  }
  console.log(`  ✓ ${message}`)
  return true
}

console.log('Гонорар и обязательства')

const stamp = Date.now()

/* Уборка за прошлым собой: упавший прогон до своей уборки не доходит. */
await prisma.payoutRate.deleteMany({ where: { discipline: DISCIPLINE, stage: STAGE } })
await prisma.project.deleteMany({ where: { clientEmail: { contains: '@payouts.invalid' } } })
await prisma.specialist.deleteMany({ where: { email: { contains: '@payouts.invalid' } } })

const person = await prisma.specialist.create({
  data: {
    displayName: 'Payout probe',
    accessKey: `payout-${stamp}`,
    email: `payout-${stamp}@payouts.invalid`,
    status: 'active',
    portfolioRating: 9,
    weeklyCapacityHours: 20,
    disciplinesJson: JSON.stringify([DISCIPLINE]),
    typologiesJson: JSON.stringify(['villa']),
    scaleBandsJson: JSON.stringify(['small']),
    maxStoreys: 3,
    materialSystemsJson: JSON.stringify(['concrete']),
    climateZonesJson: JSON.stringify(['mediterranean']),
  },
  select: { id: true },
})

const project = await prisma.project.create({
  data: {
    clientKey: `payout-key-${stamp}`,
    title: 'Проверка гонорара',
    clientName: 'e2e',
    clientEmail: `client-${stamp}@payouts.invalid`,
    typology: 'villa',
    storeys: 2,
    areaSqm: 200,
    jurisdiction: 'ME',
    climateZone: 'mediterranean',
    materialSystem: 'concrete',
    status: 'delivering',
  },
  select: { id: true },
})

/* Один принятый и один ещё не принятый: обязательство заводится за дисциплину
 * на стадии целиком, а не за каждый тикет. */
await prisma.ticket.createMany({
  data: [
    {
      projectId: project.id,
      specialistId: person.id,
      discipline: DISCIPLINE,
      stage: STAGE,
      title: 'Принятый',
      spec: 'e2e',
      slaHours: 24,
      status: 'accepted',
    },
    {
      projectId: project.id,
      specialistId: person.id,
      discipline: DISCIPLINE,
      stage: 'permit',
      title: 'Ещё в работе',
      spec: 'e2e',
      slaHours: 24,
      status: 'open',
    },
  ],
})

await prisma.invoice.create({
  data: {
    projectId: project.id,
    stage: STAGE,
    amount: CHARGED,
    status: 'paid',
    paidAt: new Date(),
    liveStage: STAGE,
  },
})

/** Начисление. */
{
  const created = await accrueFor(project.id)
  check(created === 1, `начислено ровно закрытое: ${created}`)

  const again = await accrueFor(project.id)
  check(again === 0, 'повторный вызов не начисляет второй гонорар за ту же работу')

  const rows = await prisma.payout.findMany({ where: { projectId: project.id } })
  check(rows.length === 1, 'незакрытая стадия обязательства не создаёт')
  check(rows[0]?.amount === null, 'без ставки сумма не выдумывается и не ставится нулём')
}

/** Маржа отказывается считаться, пока расход известен не весь. */
{
  const economics = await economicsOf(project.id)

  check(economics.charged === CHARGED, 'выручкой считается оплаченное')
  check(economics.margin.known === false, 'маржи нет, пока есть обязательство без ставки')
  check(
    economics.margin.known === false && economics.margin.missing === 1,
    'сказано, скольких ставок не хватает',
  )
  check(economics.missingRates.length === 1, 'названа сама пара, а не только число')

  const unrated = await unratedObligations()
  check(
    unrated.some((r) => r.discipline === DISCIPLINE && r.stage === STAGE),
    'пара попала в список того, чего ждёт реестр',
  )
}

/** Выплатить долг неизвестного размера нельзя. */
{
  const payout = await prisma.payout.findFirstOrThrow({ where: { projectId: project.id } })
  let refused = false

  try {
    await markPayoutPaid(payout.id, 'e2e')
  } catch (error) {
    refused = error instanceof PayoutRefused
  }

  check(refused, 'обязательство без суммы отметить выплаченным нельзя')

  const still = await prisma.payout.findUniqueOrThrow({ where: { id: payout.id } })
  check(still.status === 'accrued', 'отказ ничего не поменял')
}

/** Панель говорит, что маржи нет, и почему. */
{
  const browser = await chromium.launch(existsSync(EXECUTABLE) ? { executablePath: EXECUTABLE } : {})
  const page = await (await browser.newContext()).newPage()

  await page.goto(`${BASE}/ops`)
  const password = page.locator('input[type=password]')
  if (await password.count()) {
    await password.fill(process.env.BUREAU_OPS_PASSWORD ?? 'bureau-ops')
    await page.click('button[type=submit]')
    await page.waitForTimeout(2500)
  }

  // Регистр приводится намеренно: метки набираются прописными стилями.
  const panel = (await page.locator('body').innerText()).toLowerCase()
  check(
    panel.includes('gross margin cannot be computed yet'),
    'главная панели говорит, что маржу посчитать нечем',
  )

  await page.goto(`${BASE}/ops/payouts`)
  const payouts = (await page.locator('body').innerText()).toLowerCase()

  check(payouts.includes('rates the ledger is waiting for'), 'страница называет недостающие ставки')
  check(payouts.includes('rate not set'), 'обязательство без суммы показано без суммы, а не нулём')
  check(payouts.includes('not set'), 'в таблице ставок пустая клетка названа словами')

  await page.goto(`${BASE}/ops/projects/${project.id}`)
  const card = (await page.locator('body').innerText()).toLowerCase()

  check(card.includes('money on this project'), 'экономика есть на карточке проекта')
  check(
    card.includes('not computable'),
    'маржа на карточке не показывается числом, пока расход известен не весь',
  )

  await browser.close()
}

/** Названная ставка подставляется задним числом. */
{
  const filled = await setRate(DISCIPLINE, STAGE, RATE)
  check(filled === 1, `ставка подставилась в уже начисленное: ${filled}`)

  const economics = await economicsOf(project.id)
  check(economics.owedKnown === RATE, 'расход стал известен')
  check(economics.margin.known === true, 'маржа посчиталась')
  check(
    economics.margin.known === true && economics.margin.amount === CHARGED - RATE,
    'маржа — это выручка минус расход, и ничего больше',
  )

  const payout = await prisma.payout.findFirstOrThrow({ where: { projectId: project.id } })
  await markPayoutPaid(payout.id, 'e2e')

  const paid = await prisma.payout.findUniqueOrThrow({ where: { id: payout.id } })
  check(paid.status === 'paid' && paid.paidAt !== null, 'теперь выплату можно отметить')

  const at = paid.paidAt
  await markPayoutPaid(payout.id, 'второй раз')
  const twice = await prisma.payout.findUniqueOrThrow({ where: { id: payout.id } })
  check(
    twice.paidAt?.getTime() === at?.getTime(),
    'повтор проходит молча и не переписывает дату выплаты',
  )
}

/*
 * Уборка. Ставка удаляется вместе с суммами, которые она подставила: стенд
 * должен остаться в том же состоянии, в каком был, — иначе следующий прогон
 * считает чужую маржу своей.
 */
await prisma.project.delete({ where: { id: project.id } })
await prisma.specialist.delete({ where: { id: person.id } })
await prisma.payoutRate.deleteMany({ where: { discipline: DISCIPLINE, stage: STAGE } })
await prisma.payout.updateMany({
  where: { discipline: DISCIPLINE, stage: STAGE, status: 'accrued' },
  data: { amount: null },
})
await prisma.$disconnect()

console.log(process.exitCode ? '\nЕсть расхождения.' : '\nВсё сошлось.')
