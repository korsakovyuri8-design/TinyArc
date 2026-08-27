import { massingDataUri } from './massing'
import type { GeneratedImage, ImageGenerator, ImageRequest } from './types'

/**
 * Режим без генератора: схема объёма вместо изображения.
 *
 * Работает без сети и без ключа, поэтому стенд и тесты воспроизводимы. Клиент
 * видит схему с явной подписью и выбирает направление по её смыслу, а не по
 * красоте картинки — что для фиксации намерения даже честнее.
 */
export class StubImageGenerator implements ImageGenerator {
  readonly mode = 'stub'

  async generate(request: ImageRequest): Promise<GeneratedImage> {
    return { url: massingDataUri(request.key, request.title), source: 'stub' }
  }
}
