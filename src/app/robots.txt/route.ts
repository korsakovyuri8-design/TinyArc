export const dynamic = 'force-dynamic'

/**
 * robots.txt под режим стенда.
 *
 * Отдаётся кодом, а не лежит в `public`, потому что файл в `public` один на
 * оба режима: закрытый стенд и открытый продукт получили бы одинаковый ответ,
 * и переключение видимости пришлось бы делать правкой репозитория — то есть
 * выкладкой, в тот самый момент, когда хочется просто открыть.
 *
 * Сам по себе он ничего не закрывает: это просьба к добросовестному
 * обходчику. Настоящее закрытие — заголовок `X-Robots-Tag` на каждом ответе
 * (`next.config.ts`). Здесь — та же воля, сказанная там, где её ищут привычно.
 */
export function GET(): Response {
  const indexable = process.env.BUREAU_INDEXABLE === 'yes'

  const body = indexable
    ? ['User-agent: *', 'Disallow: /ops', 'Disallow: /work', 'Disallow: /project', 'Disallow: /api', '']
    : ['User-agent: *', 'Disallow: /', '']

  return new Response(body.join('\n'), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}
