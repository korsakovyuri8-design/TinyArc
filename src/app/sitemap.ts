import type { MetadataRoute } from 'next'
import { absolute } from '@/lib/site'

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
  { path: '/legal/specialists', priority: 0.3 },
  { path: '/legal/privacy', priority: 0.3 },
]

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PAGES.map(({ path, priority }) => ({
    url: absolute(path),
    priority,
  }))
}
