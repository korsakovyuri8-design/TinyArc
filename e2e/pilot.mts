/**
 * Пилот кончается настройкой, а не выкладкой.
 *
 * Бесплатный доступ специалиста задавался умолчанием схемы
 * (`subscription @default("founding")`): решение о цене продукта принимала
 * строка, невидимая из панели, и кончиться оно могло только правкой схемы,
 * миграцией и выкладкой. Бесплатное при этом не порождает жалоб — про него
 * никто не вспоминает, — и переживает и пилот, и год после него.
 *
 * Проверяются оба пути, которыми человек появляется в базе (заявка и импорт
 * базы), обе стороны настройки и её граница: истёкший пилот не трогает тех,
 * кто уже пришёл. Последнее важнее всего остального: одна настройка, снявшая
 * доступ у всего пула, сняла бы с живых проектов целые команды, а замена
 * выпавшему не нашлась бы по тому же гейту.
 *
 * Сценарий убирает своих людей и свою настройку в конце и подметает за
 * прошлым собой в начале: упавший прогон до уборки не доходит, а оставленная
 * им настройка пилота меняет ответ следующего прогона.
 */

import { chromium } from 'playwright'
import { prisma } from '../src/lib/db'
import { importDrafts } from '../src/lib/services/intake'
import { PILOT_UNTIL, clearPilotUntil, newcomerAccess, setPilotUntil } from '../src/lib/services/settings'

const BASE = process.env.E2E_BASE ?? 'http://127.0.0.1:3100'
const EXECUTABLE = process.env.E2E_CHROMIUM ?? '/opt/pw-browsers/chromium'
const OPS_PASSWORD = process.env.BUREAU_OPS_PASSWORD ?? 'bureau-ops'
const DOMAIN = 'pilot-probe.invalid'

function check(condition: unknown, message: string) {
  if (!condition) {
    console.error(`  ✗ ${message}`)
    process.exitCode = 1
    return false
  }
  console.log(`  ✓ ${message}`)
  return true
}

console.log('Пилот и доступ новичка')

// Уборка за прошлым собой: домен постоянный, чтобы находилось.
await prisma.specialist.deleteMany({ where: { email: { endsWith: `@${DOMAIN}` } } })
const priorPilot = await prisma.setting.findUnique({ where: { key: PILOT_UNTIL } })
await clearPilotUntil()

// ── Пилот выключен ───────────────────────────────────────────────────────────

check((await newcomerAccess()) === 'none', 'без настройки новичок приходит с закрытым доступом')

await importDrafts([
  {
    displayName: 'Closed arrival',
    email: `closed@${DOMAIN}`,
    portfolioUrl: '',
    note: '',
    disciplines: ['architecture'],
    specializations: [],
    jurisdictions: ['ME'],
    software: [],
    languages: [],
    typologies: [],
    materialSystems: [],
    climateZones: [],
    docStages: [],
    maxStoreys: null,
    utcOffset: null,
  },
])

const closed = await prisma.specialist.findUnique({ where: { email: `closed@${DOMAIN}` } })
check(closed?.subscription === 'none', `импорт вне пилота не раздаёт доступ: ${closed?.subscription}`)

// ── Пилот включён ────────────────────────────────────────────────────────────

const until = new Date(Date.now() + 30 * 24 * 3600 * 1000)
await setPilotUntil(until)

check((await newcomerAccess()) === 'founding', 'на пилоте новичок приходит с открытым доступом')

await importDrafts([
  {
    displayName: 'Free arrival',
    email: `free@${DOMAIN}`,
    portfolioUrl: '',
    note: '',
    disciplines: ['architecture'],
    specializations: [],
    jurisdictions: ['ME'],
    software: [],
    languages: [],
    typologies: [],
    materialSystems: [],
    climateZones: [],
    docStages: [],
    maxStoreys: null,
    utcOffset: null,
  },
])

const free = await prisma.specialist.findUnique({ where: { email: `free@${DOMAIN}` } })
check(free?.subscription === 'founding', `импорт на пилоте открывает доступ: ${free?.subscription}`)

// ── Дата задним числом ───────────────────────────────────────────────────────

let refused = false
try {
  await setPilotUntil(new Date(Date.now() - 1000))
} catch {
  refused = true
}
check(refused, 'пилот, кончившийся вчера, не записывается: его снимают, а не датируют назад')

const stillOn = await prisma.setting.findUnique({ where: { key: PILOT_UNTIL } })
check(stillOn?.value === until.toISOString(), 'отвергнутая дата не затёрла действующую')

// ── Конец пилота никого не выкидывает ───────────────────────────────────────

await clearPilotUntil()

check((await newcomerAccess()) === 'none', 'после пилота новичок снова приходит с закрытым доступом')

const survivor = await prisma.specialist.findUnique({ where: { email: `free@${DOMAIN}` } })
check(
  survivor?.subscription === 'founding',
  `пришедший на пилоте доступа не теряет: ${survivor?.subscription}`,
)

const poolIntact = await prisma.specialist.count({
  where: { status: 'active', subscription: { not: 'none' } },
})
check(poolIntact > 0, `пул после конца пилота не обнулился: с доступом ${poolIntact}`)

// ── Панель говорит, что происходит ──────────────────────────────────────────

const browser = await chromium.launch({ executablePath: EXECUTABLE })
const page = await browser.newPage()

await page.goto(`${BASE}/ops`)
await page.fill('#password', OPS_PASSWORD)
await page.click('button[type="submit"]')
await page.waitForLoadState('networkidle')

await page.goto(`${BASE}/ops/pool`)
const off = (await page.innerText('body')).toLowerCase()

check(off.includes('how new specialists arrive'), 'в панели есть блок о доступе новичков')
check(off.includes('not free'), 'выключенный пилот назван выключенным')
check(
  off.includes('arrives without access'),
  'сказано, что происходит с новичком, а не только то, что настройка снята',
)

await page.fill('#until', until.toISOString().slice(0, 10))
await page.click('form:has(#until) button[type="submit"]')
await page.waitForLoadState('networkidle')

const on = (await page.innerText('body')).toLowerCase()
check(on.includes(`free until ${until.toISOString().slice(0, 10)}`), 'включённый пилот показывает свою дату')
check((await newcomerAccess()) === 'founding', 'настройка из панели дошла до политики')

await browser.close()

// ── Уборка ───────────────────────────────────────────────────────────────────

await prisma.specialist.deleteMany({ where: { email: { endsWith: `@${DOMAIN}` } } })

if (priorPilot) {
  await prisma.setting.upsert({
    where: { key: PILOT_UNTIL },
    create: { key: PILOT_UNTIL, value: priorPilot.value },
    update: { value: priorPilot.value },
  })
} else {
  await clearPilotUntil()
}

console.log(process.exitCode ? 'Не сошлось.' : 'Всё сошлось.')
