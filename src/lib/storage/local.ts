/**
 * Файлы на диске рядом с приложением.
 *
 * Режим разработки и только он. На Render и в любом контейнерном хостинге диск
 * контейнера живёт до следующей выкладки — файлы, сложенные сюда в бою,
 * исчезнут вместе с ним, и обещание «материалы передаются в полном объёме»
 * (п.13) окажется невыполнимым ровно в тот момент, когда его пора выполнять.
 * Поэтому в боевом окружении этот режим не проходит preflight.
 *
 * Ключ приходит из кода, а не от человека, но проверяется всё равно: путь,
 * собранный из чужой строки, — это чтение любого файла на диске, и стоит эта
 * проверка одну строку.
 */

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import type { Storage, StoredFile } from './types'

const SAFE_KEY = /^[a-zA-Z0-9][a-zA-Z0-9/_.-]*$/

export class LocalStorage implements Storage {
  readonly mode = 'local'

  constructor(private readonly root: string) {}

  private pathFor(key: string): string {
    if (!SAFE_KEY.test(key) || key.includes('..')) {
      throw new Error(`Недопустимый ключ файла: ${key}`)
    }

    const full = resolve(join(this.root, key))

    // Второй рубеж на случай, если регулярное выражение когда-нибудь ослабят.
    if (!full.startsWith(resolve(this.root))) {
      throw new Error(`Ключ ведёт за пределы хранилища: ${key}`)
    }

    return full
  }

  async put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    const path = this.pathFor(key)

    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, bytes)
    await writeFile(`${path}.type`, contentType, 'utf8')
  }

  async get(key: string): Promise<StoredFile | null> {
    const path = this.pathFor(key)

    try {
      const [bytes, contentType] = await Promise.all([
        readFile(path),
        readFile(`${path}.type`, 'utf8').catch(() => 'application/octet-stream'),
      ])

      return { key, bytes: new Uint8Array(bytes), contentType: contentType.trim() }
    } catch {
      return null
    }
  }

  async remove(key: string): Promise<void> {
    const path = this.pathFor(key)

    await rm(path, { force: true })
    await rm(`${path}.type`, { force: true })
  }
}
