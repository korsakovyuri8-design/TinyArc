import type { MetadataRoute } from 'next'
import { absolute, siteUrl } from '@/lib/site'

/**
 * Что показывать поисковику, а что нет.
 *
 * Публичны страницы, объясняющие продукт, и две формы входа в него — бриф и
 * заявка в пул. Всё остальное — рабочие поверхности: кабинет проекта, доска
 * специалиста, панель бюро. Они закрыты сессией и ключом, но в выдаче им делать
 * нечего: адрес проекта — сам по себе сведение о заказчике.
 *
 * Это не защита. Защита — сессия и подпись; robots лишь избавляет от того,
 * чтобы личные адреса кто-то находил поиском.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/ops', '/work', '/project', '/enter', '/api'],
    },
    sitemap: absolute('/sitemap.xml'),
    host: siteUrl(),
  }
}
