/**
 * Положение проекта на экране, когда команда не собралась.
 *
 * Это состояние не посещал ни один сценарий, а на запуске, с тонким пулом, оно
 * будет самым частым: бриф приняли, человека под роль не нашли. Проект при
 * этом остаётся черновиком — правда для базы, — и метка вверху кабинета читала
 * «Brief accepted». Первое, что видит заказчик, — успокаивающее; тремя строками
 * ниже панель говорит, что команды нет. Два сообщения и ни одного ответа.
 *
 * Проверяется на трёх проектах сразу, потому что дорого здесь не «плохая
 * новость показана», а «хорошая новость не показана по ошибке»: черновик без
 * прогона — это действительно принятый бриф, и пугать в нём некого.
 *
 * Сценарий заводит свои проекты и в конце их убирает.
 */

import { existsSync } from 'node:fs'
import { chromium } from 'playwright'
import { prisma } from '../src/lib/db'
import { outcomesFor } from '../src/lib/services/matching'

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

console.log('Положение проекта')

const stamp = Date.now()

async function make(key: string, outcome: string | null) {
  const project = await prisma.project.create({
    data: {
      clientKey: key,
      title: `Проверка положения — ${outcome ?? 'без прогона'}`,
      clientName: 'e2e',
      clientEmail: `${key}@example.invalid`,
      typology: 'villa',
      storeys: 2,
      areaSqm: 200,
      jurisdiction: 'ME',
      climateZone: 'mediterranean',
      materialSystem: 'concrete',
      status: 'draft',
    },
    select: { id: true },
  })

  if (outcome) {
    await prisma.matchRun.create({
      data: {
        projectId: project.id,
        pooledCount: 12,
        survivedCount: 4,
        outcome,
        notes: 'e2e',
        gapJson: '',
      },
    })
  }

  return project.id
}

const freshKey = `standing-fresh-${stamp}`
const lostKey = `standing-lost-${stamp}`
const unsignedKey = `standing-unsigned-${stamp}`

const fresh = await make(freshKey, null)
const lost = await make(lostKey, 'incomplete')
const unsigned = await make(unsignedKey, 'no_signatory')
const mine = [fresh, lost, unsigned]

/*
 * Служба. Кабинет и список бюро читают исход двумя разными путями — по одному
 * прогону и пачкой, — и разойтись они могут молча: страница покажет разное на
 * одном проекте, и правым будет считаться тот, кто громче.
 */
{
  const bulk = await outcomesFor(mine)
  check(bulk.get(fresh) === undefined, 'без прогона исхода нет, а не «ok» по умолчанию')
  check(bulk.get(lost) === 'incomplete', 'пачкой читается тот же исход')
  check(bulk.get(unsigned) === 'no_signatory', 'нехватка подписи не смешана с «состав не собрался»')
  check((await outcomesFor([])).size === 0, 'пустой список не ходит в базу за пустотой')

  // Два прогона в одну миллисекунду — не выдумка: пересборка укладывается в
  // один запрос. Порядок между ними база выбирает сама, если его не задать.
  const at = new Date()
  await prisma.matchRun.createMany({
    data: [
      { projectId: fresh, outcome: 'incomplete', notes: 'e2e-a', createdAt: at },
      { projectId: fresh, outcome: 'incomplete', notes: 'e2e-b', createdAt: at },
    ],
  })

  const seen = new Set<string | undefined>()
  for (let i = 0; i < 8; i += 1) seen.add((await outcomesFor([fresh])).get(fresh))
  check(seen.size === 1, 'при совпавшем времени последний прогон выбирается одинаково')

  await prisma.matchRun.deleteMany({ where: { projectId: fresh } })
}

const browser = await chromium.launch(existsSync(EXECUTABLE) ? { executablePath: EXECUTABLE } : {})

async function cabinet(key: string) {
  const page = await (await browser.newContext()).newPage()
  await page.goto(`${BASE}/enter`)
  await page.fill('input[name=key]', key)
  await page.click('button[type=submit]')
  await page.waitForURL(`${BASE}/project**`, { timeout: 15_000 })
  // Регистр приводится намеренно: метки набираются прописными стилями, и
  // сравнение точным регистром проверяло бы CSS, а не текст.
  const text = (await page.locator('body').innerText()).toLowerCase()
  await page.context().close()
  return text
}

/** Черновик без прогона: бриф действительно только что принят. */
{
  const text = await cabinet(freshKey)
  check(text.includes('brief accepted'), 'без прогона кабинет говорит, что бриф принят')
  check(
    !text.includes('team is not assembled yet'),
    'без прогона кабинет не пугает несобранной командой',
  )
}

/** Черновик после несобравшегося прогона: ради этого случая всё и написано. */
{
  const text = await cabinet(lostKey)
  check(
    !text.includes('brief accepted'),
    'после несобравшегося прогона «бриф принят» с экрана убрано',
  )
  check(text.includes('team not assembled yet'), 'метка называет положение своим именем')
  check(
    text.includes('team is not assembled yet'),
    'панель под меткой говорит то же самое, а не обратное',
  )
}

/** Нехватка подписи — отдельная новость, и метка это различает. */
{
  const text = await cabinet(unsignedKey)
  check(!text.includes('brief accepted'), 'нехватка подписи не показывается принятым брифом')
  check(text.includes('no one to sign yet'), 'метка называет именно нехватку подписи')
}

/** Список бюро: оператор и заказчик читают на одном проекте одно и то же. */
{
  const page = await (await browser.newContext()).newPage()
  await page.goto(`${BASE}/ops`)
  const password = page.locator('input[type=password]')
  if (await password.count()) {
    await password.fill(process.env.BUREAU_OPS_PASSWORD ?? 'bureau-ops')
    await page.click('button[type=submit]')
    await page.waitForTimeout(2500)
  }

  await page.goto(`${BASE}/ops/projects?q=Проверка положения`)
  const list = (await page.locator('body').innerText()).toLowerCase()

  check(list.includes('team not assembled yet'), 'список бюро называет несобравшийся черновик')
  check(list.includes('no one to sign yet'), 'нехватка подписи видна и в списке')
  check(list.includes('brief accepted'), 'только что принятый бриф остался принятым брифом')

  await page.goto(`${BASE}/ops/projects/${lost}`)
  const card = (await page.locator('body').innerText()).toLowerCase()
  check(card.includes('team not assembled yet'), 'карточка проекта говорит то же, что список')

  await page.context().close()
}

await browser.close()

await prisma.matchRun.deleteMany({ where: { projectId: { in: mine } } })
await prisma.project.deleteMany({ where: { id: { in: mine } } })
await prisma.$disconnect()

console.log(process.exitCode ? '\nЕсть расхождения.' : '\nВсё сошлось.')
