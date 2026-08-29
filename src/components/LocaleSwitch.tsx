import NextLink from 'next/link'
import { headers } from 'next/headers'
import { LOCALES, PATH_HEADER, localePath, type Locale } from '@/lib/i18n/locale'

const NAMES: Record<Locale, string> = { ru: 'RU', en: 'EN' }

/**
 * Переключатель языка.
 *
 * Ведёт на ту же страницу, а не на главную. Переключатель, сбрасывающий на
 * главную, заставляет человека второй раз искать то, что он уже нашёл, — и
 * этого достаточно, чтобы им не пользовались.
 *
 * Обычными ссылками, а не кнопкой с обработчиком: у каждого языка свой адрес,
 * и его должно быть видно в строке браузера, можно скопировать и отправить.
 */
export async function LocaleSwitch({ locale }: { locale: Locale }) {
  const path = (await headers()).get(PATH_HEADER) ?? '/'

  return (
    <span className="locale-switch">
      {LOCALES.map((code) => (
        <NextLink
          key={code}
          href={localePath(path, code)}
          className={code === locale ? 'locale-current' : undefined}
          hrefLang={code}
          aria-current={code === locale ? 'true' : undefined}
        >
          {NAMES[code]}
        </NextLink>
      ))}
    </span>
  )
}
