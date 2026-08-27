export type ImageRequest = {
  /** Ключ направления. Нужен режиму без генератора, чтобы нарисовать схему. */
  key: string
  title: string
  prompt: string
}

export type GeneratedImage = {
  /** Адрес изображения либо data-URI со схемой. */
  url: string
  /** Чем получено. `stub` означает схему, а не изображение. */
  source: string
}

export interface ImageGenerator {
  readonly mode: string
  generate(request: ImageRequest): Promise<GeneratedImage>
}
