'use client'

import { createContext, useContext } from 'react'
import { DEFAULT_LOCALE, type Locale } from './locale'
import { translate } from './dict'

/**
 * Язык внутри клиентской формы.
 *
 * Контекст, а не свойство у каждого поля. В форме специалиста двадцать полей и
 * втрое больше подписей; протаскивать язык через каждое означает, что однажды
 * одно поле его не получит и останется русским посреди английской формы —
 * ровно та ошибка, которую глазом не видно, пока на неё не наткнётся человек.
 *
 * Значение по умолчанию — русский: компонент вне провайдера должен показывать
 * исходный текст, а не падать.
 */
const LocaleContext = createContext<Locale>(DEFAULT_LOCALE)

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale
  children: React.ReactNode
}) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
}

/** Переводчик текущей формы. */
export function useT(): (text: string) => string {
  const locale = useContext(LocaleContext)
  return (text: string) => translate(text, locale)
}

export function useLocale(): Locale {
  return useContext(LocaleContext)
}
