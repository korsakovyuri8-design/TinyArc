/**
 * Закрытый проект: кабинет сданного и кабинет отказного.
 *
 * В эти два состояния не заходил ни один сценарий, и обнаружилось ровно то,
 * что там и заводится: экран направления предлагал закрытому проекту сменить
 * облик и обещал, что «выбор дойдёт до команды раньше первого тикета». На
 * сданном тикетов не осталось ни одного — все приняты и подтверждены; на
 * отказном их не было никогда. Запись при этом менялась, и в кабинете
 * появлялось направление, которому не соответствует ни один выданный документ.
 *
 * Поэтому проверяется не только экран, но и служба: форму на закрытом проекте
 * можно отправить и без экрана, одним адресом.
 *
 * Сценарий заводит себе два своих проекта и в конце их убирает: сданный и
 * отказной среди засеянных — не декорация, на них держатся другие проверки.
 */

import { existsSync } from 'node:fs'
import { chromium } from 'playwright'
import { prisma } from '../src/lib/db'
import { DirectionClosed, chooseDirection, directionOpen } from '../src/lib/services/direction'

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

console.log('Закрытый проект')

const stamp = Date.now()

/** Заводит проект в нужном состоянии вместе с готовыми направлениями. */
async function make(status: string, key: string, extra: Record<string, unknown> = {}) {
  const project = await prisma.project.create({
    data: {
      clientKey: key,
      title: `Проверка закрытого — ${status}`,
      clientName: 'e2e',
      clientEmail: `${key}@example.invalid`,
      typology: 'villa',
      storeys: 2,
      areaSqm: 200,
      jurisdiction: 'ME',
      climateZone: 'mediterranean',
      materialSystem: 'concrete',
      status,
      ...extra,
    },
    select: { id: true },
  })

  await prisma.designDirection.createMany({
    data: [
      {
        projectId: project.id,
        key: 'terraced',
        position: 0,
        title: 'Terracing',
        summary: 'Levels follow the slope.',
        tradeoff: 'More retaining structures.',
        chosen: true,
      },
      {
        projectId: project.id,
        key: 'courtyard',
        position: 1,
        title: 'Courtyard',
        summary: 'The volume wraps a courtyard.',
        tradeoff: 'More external wall.',
        chosen: false,
      },
    ],
  })

  return project.id
}

const deliveredKey = `closed-delivered-${stamp}`
const rejectedKey = `closed-rejected-${stamp}`

const delivered = await make('delivered', deliveredKey)
const rejected = await make('rejected', rejectedKey, {
  rejectionReason: '9 storeys — above the product boundary.',
})

/*
 * Служба. Экран можно обойти — форма отправляется адресом, — поэтому отказ
 * обязан жить не в разметке, а в том, что пишет в базу.
 */
check(directionOpen('assembled'), 'на собранном проекте выбор открыт')
check(
  directionOpen('delivering'),
  'на идущем проекте выбор открыт: невыбранное направление — это работа вслепую',
)
check(!directionOpen('delivered'), 'на сданном закрыт')
check(!directionOpen('rejected'), 'на отказном закрыт')

for (const [id, what] of [
  [delivered, 'сданный'],
  [rejected, 'отказной'],
] as const) {
  let refused = false
  try {
    await chooseDirection(id, 'courtyard')
  } catch (error) {
    refused = error instanceof DirectionClosed
  }
  check(refused, `${what}: служба отказала в смене направления`)

  const still = await prisma.designDirection.findFirst({ where: { projectId: id, chosen: true } })
  check(still?.key === 'terraced', `${what}: выбранным осталось прежнее`)
}

const browser = await chromium.launch(
  existsSync(EXECUTABLE) ? { executablePath: EXECUTABLE } : {},
)

async function as(key: string) {
  const page = await (await browser.newContext()).newPage()
  await page.goto(`${BASE}/enter`)
  await page.fill('input[name=key]', key)
  await page.click('button[type=submit]')
  await page.waitForURL(`${BASE}/project**`, { timeout: 15_000 })
  return page
}

/** Сданный проект. */
{
  const page = await as(deliveredKey)
  // Регистр приводится намеренно: метки панелей набираются прописными
  // стилями, и сравнение точным регистром проверяло бы CSS, а не текст.
  const cabinet = (await page.locator('body').innerText()).toLowerCase()

  check(cabinet.includes('project closed'), 'сданный: кабинет говорит, что проект закрыт')
  check(cabinet.includes('the set is yours'), 'сданный: комплект назван принадлежащим заказчику')

  await page.goto(`${BASE}/project/direction`)
  const direction = await page.locator('body').innerText()

  check(
    !direction.includes('a direction can be chosen later'),
    'сданный: экран не обещает выбор, которого не будет',
  )
  check(
    (await page.locator('button[name=key], button[value=courtyard]').count()) === 0,
    'сданный: кнопки выбора нет',
  )
  check(direction.includes('Terracing'), 'сданный: зафиксированное направление показано')
  check(
    direction.includes('write to the bureau'),
    'сданный: сказано, куда идти за другим направлением',
  )
}

/** Отказной проект. */
{
  const page = await as(rejectedKey)
  const cabinet = (await page.locator('body').innerText()).toLowerCase()

  check(
    cabinet.includes('we are not taking this project'),
    'отказной: кабинет называет отказ отказом',
  )
  check(
    cabinet.includes('above the product boundary'),
    'отказной: причина отказа показана словами',
  )

  await page.goto(`${BASE}/project/direction`)
  const direction = await page.locator('body').innerText()

  check(
    !direction.includes('a direction can be chosen later'),
    'отказной: экран не зовёт выбирать направление',
  )
  check(
    direction.includes('outside the product boundary'),
    'отказной: сказано, почему выбирать нечего',
  )
}

await browser.close()

await prisma.designDirection.deleteMany({ where: { projectId: { in: [delivered, rejected] } } })
await prisma.project.deleteMany({ where: { id: { in: [delivered, rejected] } } })
await prisma.$disconnect()

console.log(process.exitCode ? '\nЕсть расхождения.' : '\nВсё сошлось.')
