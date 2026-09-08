/**
 * Первый день бюро: продукт на пустой базе.
 *
 * Это не редкий случай, а состояние, в котором продукт окажется на запуске:
 * ни пула, ни проектов, ни писем, ни правил, ни ставок — а бриф может прийти
 * раньше, чем бюро успеет завести людей. Проверено оно было один раз руками,
 * и тогда же на первом экране заказчика — том самом, где ему выдают ключ, —
 * нашлись две русские фразы и обещание письма при выключенной почте. Один раз
 * руками означает «до следующей правки»; поэтому здесь оно проверяется на
 * каждом прогоне.
 *
 * Стенд свой: сценарий поднимает второй сервер на пустой базе того же
 * провайдера, что и текущий прогон. Общий стенд для этого не годится — он
 * заполнен, а очистить его значит снести состояние, собранное сценариями до
 * этого.
 */

import { spawn } from 'node:child_process'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { providerFor, databaseUrl } from '../src/lib/db-provider'

const EXECUTABLE = process.env.E2E_CHROMIUM ?? '/opt/pw-browsers/chromium'
const OPS_PASSWORD = process.env.BUREAU_OPS_PASSWORD ?? 'bureau-ops'
const PORT = Number(process.env.E2E_EMPTY_PORT ?? 3211)
const BASE = `http://127.0.0.1:${PORT}`
const ROOT = join(import.meta.dirname, '..')

function check(condition: unknown, message: string) {
  if (!condition) {
    console.error(`  ✗ ${message}`)
    process.exitCode = 1
    return false
  }
  console.log(`  ✓ ${message}`)
  return true
}

console.log('Первый день бюро')

/*
 * Пустая база того же провайдера, что и текущий прогон. Провайдер менять
 * нельзя: клиент Prisma сгенерирован под один из двух, и вторая база под
 * чужим провайдером просто не откроется.
 */
const provider = providerFor(databaseUrl())
const SQLITE_FILE = join(ROOT, 'empty-stand.db')

/*
 * Провайдер, под который собран клиент Prisma, и провайдер этого прогона
 * обязаны совпадать. Расходятся они молча и стоят часа: адаптер под чужого
 * провайдера отдаёт 500 на каждой странице, которая трогает базу, — и это
 * выглядит дефектом продукта на пустой базе, а не сборкой не под ту базу.
 * Здесь это названо своим именем.
 */
const built = readFileSync(join(ROOT, 'src', 'generated', 'prisma', 'internal', 'class.ts'), 'utf8')
const builtProvider = built.match(/"activeProvider":\s*"(\w+)"/)?.[1]
const expected = provider === 'sqlite' ? 'sqlite' : 'postgresql'

if (builtProvider !== expected) {
  console.error(
    `  ✗ клиент Prisma собран под "${builtProvider}", а прогон идёт по "${expected}": сначала npx prisma generate`,
  )
  process.exit(1)
}

/*
 * Своё имя на прогон, а не одно на всех. Сброс чужой базы здесь не нужен и
 * опасен: `db push --force-reset` стирает то, на что направлен, и направлен он
 * на то, что лежит в DATABASE_URL. Пустоту даёт новое место, а не очистка
 * старого.
 */
const SCHEMA = `empty_stand_${Date.now()}`

const url =
  provider === 'sqlite' ? 'file:./empty-stand.db' : `${databaseUrl().split('?')[0]}?schema=${SCHEMA}`

function sql(statement: string) {
  // Адрес базы — через окружение, а не флагом: датасорс задаёт prisma.config.ts,
  // и `--url` эта версия не принимает вовсе.
  execFileSync('npx', ['prisma', 'db', 'execute', '--stdin'], {
    cwd: ROOT,
    input: statement,
    env: { ...process.env, DATABASE_URL: databaseUrl() },
    stdio: 'pipe',
  })
}

function wipe() {
  if (provider === 'sqlite') {
    for (const suffix of ['', '-journal', '-wal', '-shm']) {
      const path = `${SQLITE_FILE}${suffix}`
      if (existsSync(path)) rmSync(path)
    }
    return
  }

  // Своё и только своё: имя схемы собрано этим же прогоном.
  sql(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`)
}

/*
 * Подметаем за прошлым собой. Упавший прогон до уборки не доходит, и его
 * схема остаётся в базе разработки навсегда — а таких прогонов будет много.
 */
if (provider === 'postgresql') {
  sql(`
    DO $$
    DECLARE name text;
    BEGIN
      FOR name IN SELECT nspname FROM pg_namespace WHERE nspname LIKE 'empty_stand_%'
      LOOP EXECUTE format('DROP SCHEMA %I CASCADE', name);
      END LOOP;
    END $$;
  `)
}

wipe()

execFileSync('npx', ['prisma', 'db', 'push'], {
  cwd: ROOT,
  env: { ...process.env, DATABASE_URL: url },
  stdio: 'pipe',
})

const server = spawn('npx', ['next', 'start', '-p', String(PORT)], {
  cwd: ROOT,
  env: { ...process.env, DATABASE_URL: url, BUREAU_OPS_PASSWORD: OPS_PASSWORD },
  stdio: 'pipe',
})

const log: string[] = []
server.stdout.on('data', (chunk) => log.push(String(chunk)))
server.stderr.on('data', (chunk) => log.push(String(chunk)))

async function ready(): Promise<boolean> {
  for (let i = 0; i < 60; i++) {
    try {
      const response = await fetch(`${BASE}/`)
      if (response.ok) return true
    } catch {
      /* сервер ещё поднимается */
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  return false
}

async function stop() {
  server.kill('SIGTERM')
  await new Promise((resolve) => setTimeout(resolve, 500))
  server.kill('SIGKILL')
  wipe()
}

if (!(await ready())) {
  console.error(`  ✗ пустой стенд не поднялся:\n${log.join('')}`)
  await stop()
  process.exit(1)
}

check(true, 'продукт поднялся на пустой базе')

const browser = await chromium.launch({ executablePath: EXECUTABLE })

try {
  /* ── Открытые страницы отвечают ──────────────────────────────────────── */

  const open = ['/', '/specialists', '/specialists/apply', '/brief', '/enter', '/legal/offer', '/legal/specialists', '/legal/privacy']

  for (const path of open) {
    const response = await fetch(`${BASE}${path}`)
    check(response.ok, `${path} отвечает на пустой базе: ${response.status}`)
  }

  /* ── Панель бюро целиком ─────────────────────────────────────────────── */

  const page = await browser.newPage()
  await page.goto(`${BASE}/ops`)
  await page.fill('#password', OPS_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForLoadState('networkidle')

  const panel = ['/ops', '/ops/applications', '/ops/import', '/ops/pool', '/ops/projects', '/ops/letters', '/ops/payouts', '/ops/norms', '/ops/contractors']

  for (const path of panel) {
    const response = await page.goto(`${BASE}${path}`)
    check(response?.status() === 200, `${path} отвечает на пустой базе: ${response?.status()}`)

    /*
     * Пустота вместо числа. На пустой базе каждый счётчик равен нулю, и ноль
     * обязан быть написан нулём: «—», «NaN» и пустое место в ячейке числа —
     * это три разных способа сказать «мы не знаем», причём последний не
     * читается вовсе.
     */
    const text = await page.innerText('body')
    check(!text.includes('NaN'), `${path} не показывает NaN`)
    check(!text.includes('undefined'), `${path} не показывает undefined`)
    check(!text.toLowerCase().includes('internal server error'), `${path} не падает`)
  }

  /* ── Бриф проходит раньше, чем в бюро появились люди ─────────────────── */

  await page.goto(`${BASE}/brief`)
  await page.fill('#title', 'Empty stand villa')
  await page.fill('#areaSqm', '380')
  await page.fill('#storeys', '2')
  await page.fill('#clientName', 'First client')
  await page.fill('#clientEmail', 'first@example.invalid')
  await page.check('input[name="languages"][value="en"]')
  await page.check('#consent')
  // Форма помощника стоит на той же странице первой: кнопка называется своей
  // формой, а не порядком на странице.
  await page.click('form:has(#consent) button[type="submit"]')
  await page.waitForLoadState('networkidle')

  const after = (await page.innerText('body')).toLowerCase()

  check(!after.includes('internal server error'), 'бриф на пустом пуле не роняет продукт')
  /*
   * Именно этот экран и проверяется. Он показывается только сразу после
   * отправки брифа, и русское уехало на него ровно потому, что сюда не
   * заходил ни один сценарий.
   */
  check(page.url().includes('issued=1'), `бриф принят и ведёт к выбору направления: ${page.url()}`)
  check(after.includes('access key'), 'ключ выдан на экране, а не только в письме')
  /*
   * Роль, которой не хватило, названа человеческими словами: пул пуст, и
   * заказчику обязаны сказать почему, а не показать «черновик» без причины.
   */
  check(!after.includes('discipline "'), 'причина названа словами, а не языком движка')

  /*
   * Русского на первом экране заказчика быть не должно. Именно здесь оно
   * однажды и нашлось: панель с ключом показывается только сразу после
   * отправки, и ни один сценарий в это состояние не заходил.
   */
  const russian = after.match(/[а-яё]{3,}/gi)
  check(
    russian === null,
    russian === null
      ? 'первый экран заказчика по-английски'
      : `на первом экране заказчика осталось русское: ${russian.slice(0, 5).join(', ')}`,
  )

  /*
   * Обещание письма при выключенной почте. Заглушка ничего не отправляет, и
   * человек, которому сказали «копия ушла на почту», уходит ждать письма,
   * которого нет.
   */
  const mailMode = process.env.BUREAU_MAIL ?? 'stub'
  if (mailMode === 'stub') {
    check(
      !after.includes('sent to your email') && !after.includes('a copy has gone'),
      'при выключенной почте копия ключа не обещается',
    )
  }

  await browser.close()
} finally {
  if (browser.isConnected()) await browser.close()
  await stop()
}

console.log(process.exitCode ? 'Не сошлось.' : 'Всё сошлось.')

/*
 * Выход явный. Сценарий держит трубы своего сервера, и после убийства группы
 * они закрываются не сразу: процесс отработал, всё напечатал и висел, а
 * цепочка стояла за ним и ждала — снаружи это выглядит зависшим прогоном, а
 * не законченным сценарием.
 */
process.exit(process.exitCode ?? 0)
