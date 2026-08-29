import type { Metadata } from 'next'
import { currentLocale } from './index'
import { translate } from './dict'

/**
 * Заголовок и описание страницы на языке запроса.
 *
 * Через `generateMetadata`, а не статическим `metadata`: статический считается
 * один раз на сборке и не знает, кто пришёл. Для страницы, которую ищут из
 * другой страны, русский заголовок в выдаче — это и есть отсутствие
 * английской версии, даже если сама страница переведена целиком.
 */
export async function pageMetadata(title: string, description?: string): Promise<Metadata> {
  const locale = await currentLocale()
  const translated = translate(title, locale)

  return {
    title: `${translated} — TinyArc Cloud Bureau`,
    ...(description ? { description: translate(description, locale) } : {}),
  }
}
