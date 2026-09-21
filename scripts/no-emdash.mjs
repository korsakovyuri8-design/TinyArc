/**
 * Убирает длинные тире из исходников сайта.
 *
 * Правила идут по порядку, и порядок важен:
 *
 *   1. «</strong> — »  → «</strong>: »   подпись перед пояснением
 *   2. одиночное тире как заглушка «нет значения» ('—', >—<) → n/a
 *   3. « — » между словами → «, »
 *   4. тире как маркер пункта в начале строки ('— ') → «- »
 *
 * Второе правило стоит до третьего не случайно: без него пустая ячейка
 * таблицы в панели показала бы запятую. Всё, что не подошло ни под одно
 * правило, скрипт не трогает, а печатает: такие места читаются глазами.
 *
 * Тесты не трогаются: в них тире живёт в названиях проверок.
 *
 *     node scripts/no-emdash.mjs
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = 'src'
const DASH = '\u2014'

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (name === 'generated' || name === 'node_modules') continue
    if (statSync(path).isDirectory()) yield* walk(path)
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) yield path
  }
}

let files = 0
let replaced = 0
const leftovers = []

for (const path of walk(ROOT)) {
  const before = readFileSync(path, 'utf8')
  if (!before.includes(DASH)) continue

  let after = before
    .replaceAll(`</strong> ${DASH} `, '</strong>: ')
    .replace(/(['"`])\u2014\1/g, '$1n/a$1')
    .replaceAll(`>${DASH}<`, '>n/a<')
    .replaceAll(` ${DASH} `, ', ')
    // Тире как маркер списка в строке: в тексте задания и в подсказке модели.
    .replace(/(['"`])\u2014 /g, '$1- ')

  replaced += before.split(DASH).length - after.split(DASH).length
  if (after !== before) {
    writeFileSync(path, after)
    files++
  }

  after.split('\n').forEach((line, i) => {
    if (line.includes(DASH)) leftovers.push(`${path}:${i + 1}: ${line.trim().slice(0, 100)}`)
  })
}

console.log(`Файлов изменено: ${files}, тире убрано: ${replaced}`)
if (leftovers.length > 0) {
  console.log(`\nОстались, посмотреть глазами (${leftovers.length}):`)
  for (const l of leftovers) console.log('  ' + l)
}
