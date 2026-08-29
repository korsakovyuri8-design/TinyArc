import NextLink from 'next/link'
import { localePath, type Locale } from '@/lib/i18n/locale'

/**
 * Ссылка, которая помнит язык страницы.
 *
 * Нужна потому, что приставку `/en` снимает proxy, а обратно её никто не
 * добавляет: обычный `<Link href="/brief">` со страницы `/en` увёл бы человека
 * на русскую версию. Один такой переход посреди формы — и язык меняется без
 * всякого действия с его стороны.
 *
 * Язык передаётся явным свойством, а не читается изнутри. Компонент должен
 * работать и в клиентских формах, где `headers()` недоступны; тянуть ради
 * этого контекст в каждое дерево — дороже, чем передать строку.
 *
 * Внешние адреса и якоря проходят как есть: приставка языка к `https://…` или
 * `mailto:` — это сломанная ссылка.
 */
export function Link({
  href,
  locale,
  ...rest
}: React.ComponentProps<typeof NextLink> & { href: string; locale: Locale }) {
  const external = !href.startsWith('/') || href.startsWith('//')

  return <NextLink href={external ? href : localePath(href, locale)} {...rest} />
}
