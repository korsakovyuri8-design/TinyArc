/**
 * Сборка zip.
 *
 * Главная проверка здесь — распаковка настоящим распаковщиком, а не сравнение
 * собранных байтов с ожидаемыми байтами. Второе доказывает лишь то, что код
 * делает то же, что делал вчера; собранный по недопонятому формату архив
 * пройдёт такую проверку и не откроется у заказчика.
 *
 * Распаковщик берётся системный (python -m zipfile). Он про наш код ничего не
 * знает, и это ровно то, что нужно: так проверяется формат, а не наше
 * представление о нём.
 */

import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { crc32, dosDateTime, safeEntryPath, zipStream, TooLargeForZip } from './zip'

async function* entries(items: { name: string; dir?: string; text: string }[]) {
  for (const item of items) {
    yield { name: item.name, dir: item.dir, bytes: new TextEncoder().encode(item.text) }
  }
}

async function build(items: { name: string; dir?: string; text: string }[]): Promise<Uint8Array> {
  const chunks: Uint8Array[] = []

  for await (const chunk of zipStream(entries(items)) as unknown as AsyncIterable<Uint8Array>) {
    chunks.push(chunk)
  }

  const total = chunks.reduce((sum, c) => sum + c.length, 0)
  const out = new Uint8Array(total)
  let at = 0
  for (const chunk of chunks) {
    out.set(chunk, at)
    at += chunk.length
  }

  return out
}

/** Распаковывает архив системным распаковщиком и отдаёт, что получилось. */
function unpack(bytes: Uint8Array): Record<string, string> {
  const dir = mkdtempSync(join(tmpdir(), 'zip-test-'))

  try {
    const archive = join(dir, 'package.zip')
    writeFileSync(archive, bytes)

    // Сначала целостность: python проверяет CRC каждой записи и каталог.
    execFileSync('python3', ['-m', 'zipfile', '-t', archive])

    const out = join(dir, 'out')
    execFileSync('python3', ['-m', 'zipfile', '-e', archive, out])

    // Пустой архив распаковщик распаковывает в ничто и каталога не создаёт.
    // Это его поведение, а не наша ошибка: проверка целостности выше уже
    // прошла, а значит файл открывается и он пуст.
    if (!existsSync(out)) return {}

    // Спускаемся на уровень вниз: папки в архиве есть, и проверка, которая их
    // не видит, не увидит и того, что файлы разложены не туда.
    const result: Record<string, string> = {}
    const walk = (dir: string, prefix: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) walk(full, `${prefix}${entry.name}/`)
        else result[`${prefix}${entry.name}`] = readFileSync(full, 'utf8')
      }
    }
    walk(out, '')

    return result
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('crc32', () => {
  // Контрольные значения из стандарта, а не из нашего же кода.
  it('совпадает с известными значениями', () => {
    expect(crc32(new TextEncoder().encode(''))).toBe(0)
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
    expect(crc32(new TextEncoder().encode('The quick brown fox jumps over the lazy dog'))).toBe(
      0x414fa339,
    )
  })
})

describe('дата в формате MS-DOS', () => {
  it('раскладывает год, месяц и день', () => {
    const { dateWord } = dosDateTime(new Date(Date.UTC(2026, 7, 31, 12, 30, 20)))

    expect((dateWord >> 9) + 1980).toBe(2026)
    expect((dateWord >> 5) & 0x0f).toBe(8)
    expect(dateWord & 0x1f).toBe(31)
  })

  it('секунды лежат делёнными пополам: формату столько бит и отведено', () => {
    const { time } = dosDateTime(new Date(Date.UTC(2026, 0, 1, 12, 30, 20)))

    expect(time >> 11).toBe(12)
    expect((time >> 5) & 0x3f).toBe(30)
    expect((time & 0x1f) * 2).toBe(20)
  })

  it('до 1980 года прижимается к началу: отрицательный год записать некуда', () => {
    const { dateWord } = dosDateTime(new Date(Date.UTC(1970, 0, 1)))

    expect((dateWord >> 9) + 1980).toBe(1980)
  })
})

describe('имя внутри архива', () => {
  it('снимает разделители: иначе имя превращается в путь', () => {
    expect(safeEntryPath('../../etc/passwd', 'x')).toBe('..-..-etc-passwd')
    expect(safeEntryPath('a\\b', 'x')).toBe('a-b')
  })

  it('пустое имя заменяется: иначе запись не достать', () => {
    expect(safeEntryPath('   ', 'file-1')).toBe('file-1')
    expect(safeEntryPath('///', 'file-1')).toBe('file-1')
  })

  it('кириллицу и пробелы оставляет: это имя, которое дал человек', () => {
    expect(safeEntryPath('Планировка 1 этажа.pdf', 'x')).toBe('Планировка 1 этажа.pdf')
  })
})

describe('архив', () => {
  it('распаковывается системным распаковщиком', () => {
    return build([
      { name: 'plan.txt', text: 'ground floor' },
      { name: 'section.txt', text: 'A-A' },
    ]).then((bytes) => {
      expect(unpack(bytes)).toEqual({
        'plan.txt': 'ground floor',
        'section.txt': 'A-A',
      })
    })
  })

  it('доносит кириллицу в имени: без флага UTF-8 оно приезжает нечитаемым', async () => {
    const unpacked = unpack(await build([{ name: 'Разрез А-А.txt', text: 'разрез' }]))

    expect(Object.keys(unpacked)).toEqual(['Разрез А-А.txt'])
    expect(unpacked['Разрез А-А.txt']).toBe('разрез')
  })

  it('пустой архив тоже архив: комплекта ещё нет, а файл открывается', async () => {
    expect(unpack(await build([]))).toEqual({})
  })

  it('держит содержимое в целости: CRC проверяет распаковщик, а не мы', async () => {
    const long = 'x'.repeat(200_000)
    const unpacked = unpack(await build([{ name: 'big.txt', text: long }]))

    expect(unpacked['big.txt']).toBe(long)
  })

  it('слишком много записей — отказ, а не молча битый архив', async () => {
    async function* many() {
      for (let i = 0; i <= 0xffff; i += 1) {
        yield { name: `f${i}`, bytes: new Uint8Array(0) }
      }
    }

    const stream = zipStream(many()) as unknown as AsyncIterable<Uint8Array>

    await expect(
      (async () => {
        for await (const _ of stream) {
          // читаем до конца или до отказа
        }
      })(),
    ).rejects.toBeInstanceOf(TooLargeForZip)
  })
})

describe('папки и совпадения имён', () => {
  it('раскладывает по папкам, которые задали мы', async () => {
    const unpacked = await build([
      { dir: 'Concept', name: 'plan.txt', text: 'c' },
      { dir: 'Permit', name: 'plan.txt', text: 'p' },
    ]).then(unpack)

    expect(unpacked).toEqual({ 'Concept/plan.txt': 'c', 'Permit/plan.txt': 'p' })
  })

  /*
   * Совпадающие имена zip не запрещает, и в этом ловушка: распаковщик молча
   * пишет второй файл поверх первого, а заказчик недосчитывается листа.
   */
  it('разводит совпадающие имена, а не теряет второй файл', async () => {
    const unpacked = await build([
      { dir: 'Permit', name: 'Разрез.pdf', text: 'первый' },
      { dir: 'Permit', name: 'Разрез.pdf', text: 'второй' },
      { dir: 'Permit', name: 'Разрез.pdf', text: 'третий' },
    ]).then(unpack)

    expect(Object.keys(unpacked)).toHaveLength(3)
    expect(Object.values(unpacked).sort()).toEqual(['первый', 'второй', 'третий'].sort())
  })

  it('номер ставится перед расширением: файл должен открыться по типу', async () => {
    const unpacked = await build([
      { name: 'plan.pdf', text: 'a' },
      { name: 'plan.pdf', text: 'b' },
    ]).then(unpack)

    expect(Object.keys(unpacked).sort()).toEqual(['plan (2).pdf', 'plan.pdf'])
  })

  it('одно и то же имя в разных папках совпадением не считается', async () => {
    const unpacked = await build([
      { dir: 'A', name: 'x.txt', text: '1' },
      { dir: 'B', name: 'x.txt', text: '2' },
    ]).then(unpack)

    expect(Object.keys(unpacked).sort()).toEqual(['A/x.txt', 'B/x.txt'])
  })
})
