import type { GeneratedImage, ImageGenerator, ImageRequest } from './types'

export type OpenAiImagesConfig = { apiKey: string; model: string }

/**
 * Генерация изображения по HTTP.
 *
 * Провайдер выбран за отсутствие зависимости: обычный fetch. Заменяется
 * адаптером рядом — интерфейс ImageGenerator один.
 *
 * Оговорка: этот адаптер не проверялся на живом ключе. Он написан по
 * документации провайдера, и первый настоящий запрос произойдёт там, где ключ
 * задан. Режим по умолчанию — stub, поэтому непроверенный код не включается
 * сам собой.
 */
export class OpenAiImageGenerator implements ImageGenerator {
  readonly mode = 'openai'

  constructor(private readonly config: OpenAiImagesConfig) {}

  async generate(request: ImageRequest): Promise<GeneratedImage> {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.config.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        prompt: request.prompt,
        size: '1536x1024',
        n: 1,
      }),
    })

    if (!response.ok) {
      throw new Error(`Изображение не получено: провайдер ответил ${response.status}.`)
    }

    const payload = (await response.json()) as { data?: { url?: string; b64_json?: string }[] }
    const first = payload.data?.[0]

    if (first?.url) return { url: first.url, source: this.mode }
    if (first?.b64_json) {
      return { url: `data:image/png;base64,${first.b64_json}`, source: this.mode }
    }

    throw new Error('Изображение не получено: провайдер вернул пустой ответ.')
  }
}

export function configFromEnv(env: Record<string, string | undefined>): OpenAiImagesConfig {
  const apiKey = env.OPENAI_API_KEY?.trim()
  if (!apiKey) throw new Error('BUREAU_IMAGES="openai": не задан OPENAI_API_KEY.')

  return { apiKey, model: env.BUREAU_IMAGES_MODEL?.trim() || 'gpt-image-1' }
}
