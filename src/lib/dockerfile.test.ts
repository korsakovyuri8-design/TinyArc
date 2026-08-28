/**
 * Каждый COPY в Dockerfile должен иметь что копировать.
 *
 * Тест написан по факту: в образе стояла строка `COPY public ./public`, а
 * каталога `public` в репозитории не было. Локальная сборка этого не замечает —
 * Next живёт без него, — и выкладка падала на хостинге строкой
 * «"/public": not found», через десять минут после того, как всё «прошло».
 *
 * Проверяется не образ, а его контекст: файлы, которые Docker возьмёт из
 * репозитория. Строки с --from= сюда не входят — они копируют из предыдущей
 * стадии, и её содержимое отсюда не видно.
 */

import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '..', '..')

/** Источники COPY, которые Docker берёт из контекста сборки. */
async function contextSources(): Promise<string[]> {
  const dockerfile = await readFile(join(ROOT, 'Dockerfile'), 'utf8')

  return dockerfile
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('COPY '))
    .filter((line) => !line.includes('--from='))
    .flatMap((line) => {
      const args = line
        .slice('COPY '.length)
        .split(/\s+/)
        .filter((arg) => !arg.startsWith('--'))

      // Последний аргумент — назначение внутри образа, а не источник.
      return args.slice(0, -1)
    })
    .filter((source) => source !== '.')
}

describe('контекст сборки образа', () => {
  it('копирует только то, что есть в репозитории', async () => {
    const missing = (await contextSources()).filter(
      (source) => !existsSync(join(ROOT, source)),
    )

    expect(missing).toEqual([])
  })

  it('видит источники: тест бесполезен, если разбор Dockerfile ничего не нашёл', async () => {
    expect((await contextSources()).length).toBeGreaterThan(3)
  })
})
