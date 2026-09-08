/**
 * Кто ждёт, чтобы бюро открыло доступ.
 *
 * Закрытое умолчание доступа завело состояние, о котором молчали обе стороны:
 * подтверждённый специалист читает у себя «ход бюро», считается в пуле — и
 * движок не рассматривает его вовсе, а бюро об этом нигде не говорят.
 *
 * Проверяется появление в очереди, названное последствие (войдёт в отбор или
 * упрётся в следующий гейт), исчезновение после открытия доступа и то, что
 * очередь не путает ожидание доступа с ожиданием разбора заявки.
 *
 * Сценарий заводит своих людей и убирает их в конце; подметает за прошлым
 * собой в начале, потому что упавший прогон до уборки не доходит.
 */

import { chromium } from 'playwright'
import { prisma } from '../src/lib/db'
import { awaitingAccess } from '../src/lib/services/access-queue'

const BASE = process.env.E2E_BASE ?? 'http://127.0.0.1:3100'
const EXECUTABLE = process.env.E2E_CHROMIUM ?? '/opt/pw-browsers/chromium'
const OPS_PASSWORD = process.env.BUREAU_OPS_PASSWORD ?? 'bureau-ops'
const DOMAIN = 'access-queue.invalid'

function check(condition: unknown, message: string) {
  if (!condition) {
    console.error(`  ✗ ${message}`)
    process.exitCode = 1
    return false
  }
  console.log(`  ✓ ${message}`)
  return true
}

console.log('Очередь на открытие доступа')

await prisma.specialist.deleteMany({ where: { email: { endsWith: `@${DOMAIN}` } } })

const shape = {
  disciplinesJson: JSON.stringify(['architecture']),
  specializationsJson: JSON.stringify(['arch_residential']),
  typologiesJson: JSON.stringify(['villa']),
  scaleBandsJson: JSON.stringify(['small']),
  maxStoreys: 3,
  materialSystemsJson: JSON.stringify(['concrete']),
  climateZonesJson: JSON.stringify(['mediterranean']),
}

const stamp = Date.now()

/** Готов работать: мешают только деньги. */
const ready = await prisma.specialist.create({
  data: {
    displayName: 'Access ready',
    accessKey: `aq-ready-${stamp}`,
    email: `ready@${DOMAIN}`,
    status: 'active',
    subscription: 'none',
    portfolioRating: 9,
    weeklyCapacityHours: 20,
    ...shape,
  },
  select: { id: true },
})

/** Доступ закрыт, но и часов нет: открытие само по себе ничего не даст. */
const idle = await prisma.specialist.create({
  data: {
    displayName: 'Access idle',
    accessKey: `aq-idle-${stamp}`,
    email: `idle@${DOMAIN}`,
    status: 'active',
    subscription: 'none',
    portfolioRating: 9,
    weeklyCapacityHours: 0,
    ...shape,
  },
  select: { id: true },
})

/** Заявка ещё на разборе: это другая очередь и другой ход. */
await prisma.specialist.create({
  data: {
    displayName: 'Access pending',
    accessKey: `aq-pending-${stamp}`,
    email: `pending@${DOMAIN}`,
    status: 'pending',
    subscription: 'none',
    portfolioRating: 0,
    weeklyCapacityHours: 20,
    ...shape,
  },
})

const queue = await awaitingAccess()
const mine = queue.filter((row) => row.email.endsWith(`@${DOMAIN}`))

check(mine.length === 2, `в очередь попали двое подтверждённых, а не трое: ${mine.length}`)
check(
  !mine.some((row) => row.email === `pending@${DOMAIN}`),
  'заявка на разборе в очередь доступа не входит: ход не бюро по деньгам',
)

const readyRow = mine.find((row) => row.id === ready.id)
const idleRow = mine.find((row) => row.id === idle.id)

check(readyRow?.readyToWork === true, 'про готового сказано, что доступ — единственное, что мешает')
check(readyRow?.nextGate === null, 'следующего гейта у него нет')
check(idleRow?.readyToWork === false, 'про человека с нулём часов сказано, что открытие его не выпустит')
check(
  (idleRow?.nextGate ?? '').toLowerCase().includes('capacity'),
  `названо, что именно остаётся в пути: ${idleRow?.nextGate}`,
)

/* ── Панель показывает то же самое ─────────────────────────────────────── */

const browser = await chromium.launch({ executablePath: EXECUTABLE })
const page = await browser.newPage()

await page.goto(`${BASE}/ops`)
await page.fill('#password', OPS_PASSWORD)
await page.click('button[type="submit"]')
await page.waitForLoadState('networkidle')

const panel = (await page.innerText('body')).toLowerCase()

check(panel.includes('waiting for access to be opened'), 'очередь есть в панели')
check(panel.includes('access ready'), 'ждущий назван по имени')
check(!panel.includes('access pending'), 'заявка на разборе в этой очереди не показана')

/* ── Открытый доступ убирает человека из очереди ───────────────────────── */

await page.goto(`${BASE}/ops/pool/${ready.id}`)
// Кнопка называется подписью словаря, а не значением поля: подпись — это то,
// что читает оператор, и сценарий обязан нажимать ровно её.
await page.click('button:has-text("Free during the pilot")')
await page.waitForLoadState('networkidle')

const after = await prisma.specialist.findUnique({ where: { id: ready.id }, select: { subscription: true } })
check(after?.subscription === 'founding', `бюро открыло доступ с карточки: ${after?.subscription}`)

const left = (await awaitingAccess()).filter((row) => row.email.endsWith(`@${DOMAIN}`))
check(left.length === 1, `открытый доступ убрал человека из очереди: осталось ${left.length}`)
check(left[0]?.id === idle.id, 'остался тот, кому ещё не открывали')

await browser.close()
await prisma.specialist.deleteMany({ where: { email: { endsWith: `@${DOMAIN}` } } })

console.log(process.exitCode ? 'Не сошлось.' : 'Всё сошлось.')
