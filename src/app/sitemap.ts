import type { MetadataRoute } from 'next'
import { absolute } from '@/lib/site'
import { LOCALES, localePath } from '@/lib/i18n/locale'

/**
 * Публичные страницы продукта.
 *
 * Список ведётся руками, а не обходом файлов: рабочие поверхности лежат в том
 * же дереве, и автоматический обход рано или поздно вынес бы в карту сайта
 * адрес чьего-то проекта.
 */
const PUBLIC_PAGES = [
  { path: '/', priority: 1 },
  { path: '/how-it-works', priority: 0.8 },
  { path: '/algorithm', priority: 0.8 },
  { path: '/brief', priority: 0.9 },
  { path: '/specialists', priority: 0.7 },
  { path: '/specialists/apply', priority: 0.6 },
  { path: '/legal/offer', priority: 0.3 },
  { path: '/legal/privacy', priority: 0.3 },
]

/**
 * Каждая страница объявлена на обоих языках.
 *
 * Английская версия сделана ради рынка, который ищет по-английски, — а из
 * карты сайта о ней до сих пор нельзя было узнать: в ней стояли только русские
 * адреса. Поисковик находил бы английские страницы по ссылкам с русских, то
 * есть в последнюю очередь и не всегда.
 *
 * В `languages` перечислены обе версии, включая ту, чей это адрес. Набор
 * языковых версий должен быть полным в каждой записи: версия, не сославшаяся
 * сама на себя, для поисковика неполна.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PAGES.flatMap(({ path, priority }) =>
    LOCALES.map((locale) => ({
      url: absolute(localePath(path, locale)),
      priority,
      alternates: {
        languages: Object.fromEntries(
          LOCALES.map((other) => [other, absolute(localePath(path, other))]),
        ),
      },
    })),
  )
}
