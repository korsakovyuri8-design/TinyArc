/**
 * Хранилище файлов.
 *
 * Режим задаётся окружением и виден из конфигурации, как у почты и картинок.
 * Неизвестное значение роняет приложение, а не откатывается на диск молча:
 * «кажется, файлы где-то лежат» — худшее из состояний для того, что мы обязаны
 * отдать заказчику целиком (п.13).
 */

import { join } from 'node:path'
import { LocalStorage } from './local'
import { S3Storage, configFromEnv } from './s3'
import type { Storage } from './types'

export * from './types'
export { MAX_FILE_BYTES } from './limits'

const globalForStorage = globalThis as unknown as { bureauStorage?: Storage }

/** Куда кладёт локальный режим. Вне репозитория смысла не имеет: это разработка. */
export const LOCAL_ROOT = process.env.BUREAU_STORAGE_ROOT?.trim() || join(process.cwd(), '.storage')

function build(): Storage {
  const mode = process.env.BUREAU_STORAGE ?? 'local'

  if (mode === 'local') return new LocalStorage(LOCAL_ROOT)
  if (mode === 's3') return new S3Storage(configFromEnv(process.env))

  throw new Error(
    `BUREAU_STORAGE="${mode}": такого режима нет. Доступны "local" и "s3"; новый подключается адаптером рядом с ними.`,
  )
}

export function storage(): Storage {
  globalForStorage.bureauStorage ??= build()
  return globalForStorage.bureauStorage
}

/**
 * Ключ файла артефакта.
 *
 * Собирается из идентификаторов, а не из имени файла: имя приходит от человека,
 * и складывать его в путь означает получить и кириллицу, и пробелы, и «../» —
 * в одном и том же месте. Имя хранится отдельно, в базе, и человеку показывают
 * именно его.
 */
export function artifactKey(projectId: string, artifactId: string): string {
  return `projects/${projectId}/${artifactId}`
}
