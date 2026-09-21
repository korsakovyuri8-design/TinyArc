import type { MetadataRoute } from 'next'

export const dynamic = 'force-dynamic'

/**
 * robots.txt под режим стенда.
 *
 * Пишется соглашением Next (`app/robots.ts`), а не обычным маршрутом:
 * фреймворк обслуживает этот адрес сам, и собственный обработчик на нём
 * сталкивается с встроенным, сборка падает, а не страница.
 *
 * Отдаётся кодом, а не лежит в `public`, потому что файл в `public` один на оба
 * режима: переключение видимости требовало бы правки репозитория и выкладки
 * ровно тогда, когда хочется просто открыть.
 *
 * Сам по себе он ничего не закрывает, это просьба к добросовестному
 * обходчику. Настоящее закрытие, заголовок `X-Robots-Tag` на каждом ответе
 * (`next.config.ts`). Здесь та же воля, сказанная там, где её ищут привычно.
 */
export default function robots(): MetadataRoute.Robots {
  const indexable = process.env.BUREAU_INDEXABLE === 'yes'

  if (!indexable) {
    return { rules: { userAgent: '*', disallow: '/' } }
  }

  return {
    rules: { userAgent: '*', disallow: ['/ops', '/work', '/project', '/api'] },
  }
}
