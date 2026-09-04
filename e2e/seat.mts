/**
 * Что читает специалист, которого отбор не берёт.
 *
 * Пустая доска без причины читается как приговор профессии, и человек идёт
 * переделывать портфолио, когда мешает не оно. Причин четыре, и они лечатся
 * по-разному: доступ открывает бюро, порог двигает новая работа, свободные
 * часы ставит он сам, а разбор заявки просто идёт своим ходом.
 *
 * Путь приглашённого — самый частый на запуске — проверяется в `intake.mjs`,
 * там же, где он и проходится целиком. Здесь два оставшихся случая на
 * подтверждённом человеке: закрытый доступ и нулевые часы.
 *
 * Сценарий заводит своего специалиста и в конце его убирает: подопытный из
 * сида — это чужие метрики и чужие задачи.
 */

import { existsSync } from 'node:fs'
import { chromium } from 'playwright'
import { PORTFOLIO_THRESHOLD } from '../src/engine/taxonomy'
import { prisma } from '../src/lib/db'
import { seatOf } from '../src/lib/seat'

const BASE = process.env.E2E_BASE ?? 'http://127.0.0.1:3100'
const EXECUTABLE = process.env.E2E_CHROMIUM ?? '/opt/pw-browsers/chromium'

function check(condition: unknown, message: string) {
  if (!condition) {
    console.error(`  ✗ ${message}`)
    process.exitCode = 1
    return false
  }
  console.log(`  ✓ ${message}`)
  return true
}

console.log('Место в отборе')

const key = `seat-${Date.now()}`

const person = await prisma.specialist.create({
  data: {
    displayName: 'Seat probe',
    accessKey: key,
    email: `${key}@example.invalid`,
    status: 'active',
    portfolioRating: 9,
    weeklyCapacityHours: 20,
    disciplinesJson: JSON.stringify(['architecture']),
    specializationsJson: JSON.stringify(['arch_residential']),
    typologiesJson: JSON.stringify(['villa']),
    scaleBandsJson: JSON.stringify(['small']),
    maxStoreys: 3,
    materialSystemsJson: JSON.stringify(['concrete']),
    climateZonesJson: JSON.stringify(['mediterranean']),
  },
  select: { id: true },
})

/*
 * Порядок гейтов проверяется до экрана: деньги идут раньше портфолио, и
 * человеку с обеими бедами называется доступ. Отказ по деньгам, выглядящий
 * отказом по квалификации, стоит дороже — его идут исправлять не тем.
 */
check(
  seatOf({
    status: 'active',
    subscription: 'none',
    portfolioRating: 1,
    weeklyCapacityHours: 20,
  }).headline.toLowerCase().includes('access'),
  'при закрытом доступе и слабом портфолио названы деньги, а не квалификация',
)

const browser = await chromium.launch(existsSync(EXECUTABLE) ? { executablePath: EXECUTABLE } : {})

async function board() {
  const page = await (await browser.newContext()).newPage()
  await page.goto(`${BASE}/enter`)
  await page.fill('input[name=key]', key)
  await page.click('button[type=submit]')
  await page.waitForURL(`${BASE}/work**`, { timeout: 15_000 })
  // Регистр приводится намеренно: метки набираются прописными стилями.
  const text = (await page.locator('body').innerText()).toLowerCase()
  await page.context().close()
  return text
}

/** Человек в пуле: доска молчит про помехи, потому что их нет. */
{
  const text = await board()
  check(
    text.includes('tickets appear when the engine puts you on a project team'),
    'в пуле доска говорит про задачи, а не про помехи',
  )
}

/** Доступ закрыт: это про деньги, и так и сказано. */
{
  await prisma.specialist.update({ where: { id: person.id }, data: { subscription: 'none' } })
  const text = await board()

  check(text.includes('access to projects is closed'), 'закрытый доступ назван доступом')
  check(
    text.includes('not about the quality of your work'),
    'сказано, что дело не в качестве работы — иначе он пойдёт переделывать портфолио',
  )
  check(text.includes('the move is the bureau’s'), 'сказано, что ход бюро')
  check(
    !text.includes('tickets appear when the engine puts you on a project team'),
    'обещания задач рядом с закрытым доступом нет',
  )
}

/** Нулевые часы: единственный гейт, который человек двигает сам. */
{
  await prisma.specialist.update({
    where: { id: person.id },
    data: { subscription: 'founding', weeklyCapacityHours: 0 },
  })
  const text = await board()

  check(text.includes('free capacity is zero'), 'нулевые часы названы часами')
  check(
    !text.includes('the move is the bureau’s'),
    'ход не перекладывается на бюро там, где решает сам человек',
  )
  check(
    text.includes(`${PORTFOLIO_THRESHOLD}`) === false,
    'про порог портфолио здесь не говорится: мешает не он',
  )
}

await browser.close()

await prisma.specialist.delete({ where: { id: person.id } })
await prisma.$disconnect()

console.log(process.exitCode ? '\nЕсть расхождения.' : '\nВсё сошлось.')
