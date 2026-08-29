/**
 * Приём базы специалистов: импорт → приглашение → вход по ключу → дозаполнение.
 *
 * Это путь, которым пул наполняется на запуске, и он проходит через четыре
 * поверхности и две роли. Модульные тесты покрывают разбор таблицы, но не
 * ответят, пускает ли вход ключ приглашённого и стоят ли распознанные поля
 * отмеченными в форме, — а ошибка там обесценивает всю рассылку.
 *
 * Нужен запущенный сервер и пароль панели в BUREAU_OPS_PASSWORD.
 */

import { existsSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE = process.env.E2E_BASE ?? 'http://127.0.0.1:3100'
const EXECUTABLE = process.env.E2E_CHROMIUM ?? '/opt/pw-browsers/chromium'
const PASSWORD = process.env.BUREAU_OPS_PASSWORD

if (!PASSWORD) {
  console.error('Нужен BUREAU_OPS_PASSWORD: без пароля панель не открыть.')
  process.exit(1)
}

// Адрес уникален на прогон: импорт намеренно не заводит второй раз того, кто
// уже есть, и повторный прогон на том же адресе проверял бы не то.
const EMAIL = `e2e.${Date.now()}@example.com`

function check(condition, message) {
  if (!condition) {
    console.error(`  ✗ ${message}`)
    process.exitCode = 1
    return false
  }
  console.log(`  ✓ ${message}`)
  return true
}

const browser = await chromium.launch(
  existsSync(EXECUTABLE) ? { executablePath: EXECUTABLE } : {},
)
const bureau = await (await browser.newContext()).newPage()

console.log('Приём базы специалистов')

await bureau.goto(`${BASE}/ops`)
await bureau.fill('input[type=password]', PASSWORD)
await bureau.click('button[type=submit]')
// Ждём не адрес — он и до входа тот же, — а ссылку, которой у гостя нет.
await bureau.waitForSelector('a[href="/ops/import"]')

const CSV = [
  'Name;Email;Role;Country;Software;Rate',
  `Test Specialist;${EMAIL};Landscape architect;Montenegro;Revit, ArchiCAD;40`,
  'Без Почты;телеграм;Архитектор;Сербия;Revit;30',
].join('\n')

await bureau.goto(`${BASE}/ops/import`)
await bureau.fill('#csv-preview', CSV)
await bureau.click('form:has(#csv-preview) button[type=submit]')
await bureau.waitForTimeout(1500)

let text = await bureau.textContent('body')
check(text.includes('Ready to create: 1'), 'предпросмотр отделяет годные строки от битых')
check(text.includes('the address does not look like an email'), 'называет строку, которую не возьмёт')
check(text.includes('rate'), 'называет столбец, который не прочитан')

await bureau.fill('#csv-run', CSV)
await bureau.click('form:has(#csv-run) button[type=submit]')
await bureau.waitForTimeout(2500)
text = await bureau.textContent('body')
check(text.includes('Created: 1'), 'заведена одна запись')
check(text.includes('The invitations have not been sent yet'), 'заведение не рассылает писем само')

await bureau.fill('#csv-run', CSV)
await bureau.click('form:has(#csv-run) button[type=submit]')
await bureau.waitForTimeout(2000)
check(
  (await bureau.textContent('body')).includes('Created: 0'),
  'повторный импорт того же файла не создаёт дублей',
)

await bureau.click('form:has(button:has-text("Send the invitations")) button[type=submit]')
await bureau.waitForTimeout(3000)
check(
  (await bureau.textContent('body')).includes('Sent:'),
  'рассылка отдельной кнопкой отчитывается о числе писем',
)

await bureau.goto(`${BASE}/ops/applications`)
const row = bureau.locator('tr', { hasText: EMAIL })
check(await row.count() > 0, 'приглашённый виден бюро отдельным списком')

// Ключ читается из своей ячейки, а не из текста строки: соседняя колонка
// «Молчит: 0 дн.» приклеивается к нему без пробела и удлиняет ключ на цифру.
const key = (await row.first().locator('td').nth(2).textContent()).trim()
check(/^pool-[a-z0-9]+$/.test(key), `ключ доступа виден бюро: ${key || 'не найден'}`)

console.log('Путь приглашённого')

const person = await (await browser.newContext()).newPage()

await person.goto(`${BASE}/enter`)
await person.fill('input[name=key]', key)
await person.click('button[type=submit]')
await person.waitForTimeout(2000)
check(person.url().includes('/work/profile/complete'), 'ключ приглашённого пускает и ведёт к профилю')

text = await person.textContent('body')
check(text.includes('Test Specialist'), 'обращение по имени из базы бюро')

check(
  await person.isChecked('input[name=disciplines][value=landscape]'),
  '«Ландшафтный архитектор» распознан как ландшафт, а не как архитектура',
)
check(
  await person.isChecked('input[name=jurisdictions][value=ME]'),
  '«Черногория» распознана и отмечена',
)
check(await person.isChecked('input[name=software][value=revit]'), 'пакет из таблицы отмечен')

await person.goto(`${BASE}/work`)
await person.waitForTimeout(800)
check(person.url().includes('/complete'), 'доска работ возвращает к незаполненному профилю')

await person.goto(`${BASE}/work/profile/complete`)
await person.fill('input[name=portfolioUrl]', 'https://example.com/e2e')
for (const [name, value] of [
  ['specializations', 'landscape_garden'],
  ['typologies', 'villa'],
  ['scaleBands', 'upto_250'],
  ['materialSystems', 'concrete'],
  ['climateZones', 'mediterranean'],
  ['docStages', 'permit'],
  ['languages', 'ru'],
]) {
  await person.check(`input[name=${name}][value=${value}]`)
}

// Приглашённого завели импортом из базы бюро, то есть до всякого его согласия.
// Дозаполнение профиля — первый момент, когда он может сказать «да».
check(
  (await person.locator('#consent').count()) > 0,
  'у приглашённого спрашивают согласие: до сих пор его никто не спрашивал',
)
await person.check('#consent')

await person.click('button[type=submit]')
await person.waitForTimeout(2500)
check((await person.textContent('body')).includes('Profile submitted'), 'профиль ушёл на разбор')

await person.goto(`${BASE}/work/profile/complete`)
await person.waitForTimeout(800)
check(!person.url().includes('/complete'), 'дозаполнение закрыто: поля отбора правит бюро')

await bureau.goto(`${BASE}/ops/applications`)
check(
  (await bureau.textContent('body')).includes(EMAIL),
  'бюро видит его уже как заявку на разборе',
)

await browser.close()

if (process.exitCode) {
  console.log('\nЕсть расхождения.')
} else {
  console.log('\nВсё сошлось.')
}
