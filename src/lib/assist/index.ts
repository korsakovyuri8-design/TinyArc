/**
 * Помощники бюро: выбор режима.
 *
 * Как и с почтой и изображениями: режим виден из конфигурации, неизвестное
 * значение роняет приложение. По умолчанию — режим без модели, поэтому ключ
 * нужен только тому, кто сознательно его включил.
 */

import { AnthropicAssistant } from './anthropic'
import { StubAssistant } from './stub'
import type { Assistant } from './types'

export * from './types'

const globalForAssist = globalThis as unknown as { bureauAssistant?: Assistant }

function build(): Assistant {
  const mode = process.env.BUREAU_ASSIST ?? 'stub'

  if (mode === 'stub') return new StubAssistant()
  if (mode === 'anthropic') return new AnthropicAssistant()

  throw new Error(
    `BUREAU_ASSIST="${mode}": такого режима нет. Доступны "stub" и "anthropic"; новый подключается адаптером рядом с ними.`,
  )
}

export function assistant(): Assistant {
  globalForAssist.bureauAssistant ??= build()
  return globalForAssist.bureauAssistant
}
