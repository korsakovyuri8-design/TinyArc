/**
 * В продукте нет русского текста.
 *
 * Сквозная проверка языка (`e2e/english.mts`) смотрит на отрисованные
 * страницы и потому видит только те состояния, в которые заходит. Русское
 * пряталось ровно в остальных: в комментарии бюро при возврате на круг, в
 * подписи схемы объёма, в описании правовой страницы для поисковика, в тексте
 * закрытого проекта. Каждое из них человек увидел бы, а проверка — нет.
 *
 * Этот тест смотрит в исходники и потому видит всё сразу. Он груб: строка с
 * кириллицей вне разрешённых мест считается недоделанным переводом.
 *
 * Разрешены три места, и все три названы в AGENTS.md:
 *
 * 1. комментарии — инженерный документ, а не продукт;
 * 2. словари синонимов импорта и разбора текста: базу бюро собирали руками и
 *    по-русски, и выбрасывать эти слова значит выбрасывать саму базу;
 * 3. сообщения, которые видит только тот, кто выкладывает, — консоль и
 *    preflight.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '..')

/** Файлы, где русский — это данные или сообщение для выкладывающего. */
const ALLOWED = new Set([
  'lib/intake/aliases.ts',
  'lib/intake/map.ts',
  'lib/assist/stub.ts',
  'lib/env.ts',
  'lib/db-adapter.ts',
  'lib/schema-variant.ts',
  'lib/storage/s3.ts',
  'lib/storage/local.ts',
  'lib/images/index.ts',
  'lib/images/openai.ts',
  'lib/assist/anthropic.ts',
  'lib/assist/index.ts',
  'lib/mail/index.ts',
  'lib/mail/resend.ts',
  'lib/db.ts',
  'lib/db-provider.ts',
  'lib/storage/index.ts',
  /*
   * Выгрузка и восстановление базы — инструмент выкладывающего, а не продукт.
   * Их сообщения читает тот, кто запустил скрипт в терминале: имя таблицы,
   * причина отказа, число строк. В интерфейсе они не появляются нигде, и
   * появиться не должны — восстановление базы не бывает кнопкой.
   */
  'lib/backup.ts',
  'lib/services/backup.ts',
  /*
   * Страница импорта перечисляет, как может называться столбец в чужой
   * таблице, и русские заголовки там — данные. Её собственный текст при этом
   * не остаётся без присмотра: сквозная проверка языка проходит по ней,
   * выбрасывая помеченные образцы, — то есть ровно эту таблицу.
   */
  'app/ops/import/page.tsx',
])

const CYRILLIC = /[А-Яа-яЁё]/

function sources(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)

    if (statSync(full).isDirectory()) {
      if (entry === 'generated') continue
      sources(full, found)
      continue
    }

    if (!['.ts', '.tsx'].includes(extname(entry))) continue
    if (entry.includes('.test.')) continue

    found.push(full)
  }

  return found
}

/** Убирает то, где русский разрешён: комментарии и вызовы console. */
function strip(source: string): string {
  let text = source.replace(/\/\*[\s\S]*?\*\//g, '')
  text = text.replace(/(?<!:)\/\/[^\n]*/g, '')

  // console.error('…', error) — сообщение тому, кто читает журнал выкладки.
  return text.replace(/console\.\w+\((?:[^()]|\([^()]*\))*\)/g, '')
}

/** Русские куски: строковые литералы и текст разметки. */
function russian(source: string): string[] {
  const text = strip(source)
  const found: string[] = []

  const patterns = [
    /'((?:[^'\\\n]|\\')*)'/g,
    /"([^"\n]*)"/g,
    /`((?:[^`\\]|\\.)*)`/g,
    />([^<>{}]*)</g,
  ]

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const piece = match[1].trim()
      if (piece && CYRILLIC.test(piece)) found.push(' '.repeat(0) + piece.slice(0, 80))
    }
  }

  return found
}

describe('язык продукта', () => {
  it('английский везде, кроме комментариев, словарей импорта и консоли', () => {
    const leftovers: string[] = []

    for (const path of sources(ROOT)) {
      const relative = path.slice(ROOT.length + 1)
      if (ALLOWED.has(relative)) continue

      for (const piece of russian(readFileSync(path, 'utf8'))) {
        leftovers.push(`${relative}: ${piece}`)
      }
    }

    expect(leftovers).toEqual([])
  })
})
