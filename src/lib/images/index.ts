/**
 * Генерация изображений направлений.
 *
 * Режим задаётся окружением и виден из конфигурации. Неизвестное значение
 * роняет приложение, а не откатывается на схему молча: клиент должен понимать,
 * смотрит он на изображение или на схему, и выяснять это на нём нельзя.
 */

import { OpenAiImageGenerator, configFromEnv } from './openai'
import { StubImageGenerator } from './stub'
import type { ImageGenerator } from './types'

export * from './types'
export { massingSvg, massingDataUri } from './massing'

const globalForImages = globalThis as unknown as { bureauImages?: ImageGenerator }

function build(): ImageGenerator {
  const mode = process.env.BUREAU_IMAGES ?? 'stub'

  if (mode === 'stub') return new StubImageGenerator()
  if (mode === 'openai') return new OpenAiImageGenerator(configFromEnv(process.env))

  throw new Error(
    `BUREAU_IMAGES="${mode}": такого режима нет. Доступны "stub" и "openai"; новый подключается адаптером рядом с ними.`,
  )
}

export function images(): ImageGenerator {
  globalForImages.bureauImages ??= build()
  return globalForImages.bureauImages
}
