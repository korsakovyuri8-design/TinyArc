/**
 * Перевод фразы. Общая часть: работает и на сервере, и в браузере.
 *
 * Отделена от `index.ts` потому, что тот читает заголовки запроса, а формы —
 * клиентские компоненты, и `headers()` им недоступны. Им язык приходит
 * свойством сверху, а словарь уезжает в бандл: несколько килобайт текста
 * дешевле, чем полсотни отдельных свойств с переведёнными строками.
 *
 * Почему ключ — русская фраза, а не идентификатор, объяснено в `index.ts`.
 */

import type { Locale } from './locale'
import { en } from './en'

const DICTIONARIES: Record<Locale, Record<string, string> | null> = {
  // Русский — исходный текст, а не перевод: словаря для него нет и не нужно.
  ru: null,
  en,
}

/**
 * Непереведённое возвращается как есть.
 *
 * Это видно на экране и чинится дописыванием строки в словарь; пустое место
 * или ключ вида `hero.title` пришлось бы сначала найти.
 */
export function translate(text: string, locale: Locale): string {
  const dictionary = DICTIONARIES[locale]
  if (!dictionary) return text

  return dictionary[text] ?? text
}

/**
 * Чего ещё нет в словаре.
 *
 * Нужна тесту, а не продукту: он проходит по фразам, которые обязаны быть
 * переведены, и называет пропущенные. Без такой проверки английская страница
 * доезжает до человека наполовину русской, и заметить это может только тот,
 * кто на неё специально посмотрит.
 */
export function missing(texts: string[], locale: Locale): string[] {
  const dictionary = DICTIONARIES[locale]
  if (!dictionary) return []

  return texts.filter((text) => !(text in dictionary))
}
