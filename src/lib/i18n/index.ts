/**
 * Язык текущего запроса на сервере.
 *
 * Словарь и сам перевод живут в `dict.ts`: этот модуль читает заголовки, а
 * значит доступен только серверным компонентам. Клиентские формы получают язык
 * свойством и зовут `translate` оттуда.
 *
 * Ключ словаря — русская фраза целиком, а не идентификатор вроде
 * `home.hero.title`. Это осознанный выбор с известной ценой: правка русского
 * текста рвёт связь с переводом, и её приходится чинить руками.
 *
 * Взамен продукт остаётся читаемым. Восемьсот идентификаторов в разметке
 * означают, что ни одну страницу нельзя прочесть, не держа словарь открытым
 * рядом, — а читать их приходится чаще, чем переводить. Обрыв связи при этом
 * не молчаливый: непереведённая фраза остаётся русской и видна глазом, тогда
 * как забытый идентификатор превращается в `home.hero.title` посреди экрана.
 */

import { headers } from 'next/headers'
import { DEFAULT_LOCALE, LOCALE_HEADER, isLocale, type Locale } from './locale'
import { translate } from './dict'

export * from './locale'
export { translate, missing } from './dict'

/**
 * Язык текущего запроса.
 *
 * Читается из заголовка, который поставил proxy. Если заголовка нет — значит
 * запрос пришёл мимо него (маршрут в исключениях matcher), и русский здесь
 * правильный ответ, а не признак поломки.
 */
export async function currentLocale(): Promise<Locale> {
  const value = (await headers()).get(LOCALE_HEADER)
  return isLocale(value) ? value : DEFAULT_LOCALE
}

/** Переводчик, привязанный к языку запроса. Сокращает `translate(x, locale)`. */
export async function translator(): Promise<{
  locale: Locale
  t: (text: string) => string
}> {
  const locale = await currentLocale()
  return { locale, t: (text: string) => translate(text, locale) }
}
