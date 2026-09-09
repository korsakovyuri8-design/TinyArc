/**
 * Синтетический пул не попадает в живое бюро.
 *
 * Проверка по исходникам, потому что иначе не проверяется вовсе: в
 * разработке и в CI сид работает как рабочий инструмент, `NODE_ENV` там не
 * боевой, и ветка отказа не выполняется ни разу. Значит рабочую защиту от
 * снятой отличает только внимательность правящего.
 *
 * Цена ошибки здесь выше обычной. Блюпринт разворачивает демонстрационную
 * команду, а переход на боевую — комментарий в файле, исполняемый по памяти:
 * забыли — и живое бюро поднимается с восемью десятками выдуманных
 * специалистов и шестью правилами, помеченными «not a legal source». Алгоритм
 * собирает команды из людей, которых нет, а комплект считается по нормам,
 * которых нет, — под нашей подписью.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '..', '..')
const seed = readFileSync(join(ROOT, 'prisma', 'seed.ts'), 'utf8')
const demoStart = readFileSync(join(ROOT, 'scripts', 'demo-start.sh'), 'utf8')
const start = readFileSync(join(ROOT, 'scripts', 'start.sh'), 'utf8')

describe('сид закрыт от боевой базы', () => {
  it('в бою спрашивает явное разрешение', () => {
    expect(seed).toContain('isProduction()')
    expect(seed).toContain("process.env.BUREAU_DEMO !== '1'")
  })

  /*
   * Второй порог. Флаг, оставшийся включённым на базе, которую повысили из
   * витрины в боевую, — ровно та ошибка, которую флаг сам по себе не ловит.
   */
  it('отказывается и при живых записях, даже с разрешением', () => {
    expect(seed).toContain('liveRecords')
    expect(seed).toMatch(/accessKey:\s*\{\s*not:\s*\{\s*startsWith:\s*'seed-key-'/)
    expect(seed).toMatch(/clientKey:\s*\{\s*not:\s*\{\s*startsWith:\s*'seed-brief-'/)
  })

  /*
   * Порядок решает всё: проверка после первого `deleteMany` — это проверка
   * после того, как уже стёрли.
   */
  it('отказ стоит раньше любой записи и любого удаления', () => {
    const refusal = seed.indexOf('const refusal = await refuseInProduction()')
    const wipe = seed.indexOf('deleteMany', seed.indexOf('async function main'))

    expect(refusal).toBeGreaterThan(-1)
    expect(wipe).toBeGreaterThan(refusal)
  })

  it('отказ виден снаружи кодом возврата, а не только строкой в логе', () => {
    expect(seed).toContain('process.exitCode = 1')
  })

  /*
   * Разрешение даётся ровно в том файле, который отличает витрину от боевого
   * бюро, — и в боевом его нет. Если оно однажды окажется в `start.sh`,
   * защита останется на месте и перестанет что-либо значить.
   */
  it('разрешение живёт в команде витрины, а не в боевой', () => {
    expect(demoStart).toContain('BUREAU_DEMO=1')
    expect(start).not.toContain('BUREAU_DEMO')
    expect(start).not.toContain('seed')
  })
})
