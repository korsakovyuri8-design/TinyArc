import { NextResponse, type NextRequest } from 'next/server'
import { DEFAULT_LOCALE, LOCALE_HEADER, PATH_HEADER, splitLocale } from '@/lib/i18n/locale'

/**
 * Снимает приставку языка и передаёт язык странице заголовком.
 *
 * Файл называется `proxy.ts`, а не `middleware.ts`: в Next 16 прежнее имя
 * объявлено устаревшим и переименовано, механика при этом та же
 * (`node_modules/next/dist/docs/.../proxy.md`).
 *
 * `/en/brief` разбирается сюда как «английский» плюс `/brief`, и дальше
 * работает та же страница, что и всегда. Ни один файл маршрута не переезжает,
 * ни один существующий адрес не меняется, и ни одна ссылка внутри продукта не
 * ломается — приставку к ним добавляет `Link` из `@/components/Link`.
 *
 * Заголовок, а не cookie. Cookie означала бы, что одна страница отдаёт два
 * языка в зависимости от того, кто пришёл: поисковый робот и человек по
 * присланной ссылке видели бы русский, что бы ни выбрал отправитель. Для
 * продукта, который ищут из другой страны, это и есть отсутствие английского.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const { locale, rest } = splitLocale(pathname)

  const headers = new Headers(request.headers)
  headers.set(LOCALE_HEADER, locale)
  // Путь без приставки: по нему переключатель собирает эту же страницу на
  // другом языке. Next серверному компоненту путь не отдаёт.
  headers.set(PATH_HEADER, rest)

  if (locale === DEFAULT_LOCALE) {
    return NextResponse.next({ request: { headers } })
  }

  const url = request.nextUrl.clone()
  url.pathname = rest

  return NextResponse.rewrite(url, { request: { headers } })
}

export const config = {
  /*
   * Мимо proxy идёт то, у чего языка нет вовсе: статика, изображения,
   * файлы проекта и служебные адреса. Пропускать их через разбор пути значит
   * платить за это на каждой картинке.
   */
  matcher: ['/((?!_next/static|_next/image|api/|favicon|robots.txt|sitemap.xml).*)'],
}
