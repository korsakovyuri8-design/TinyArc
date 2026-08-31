import type { MetadataRoute } from 'next'

/**
 * Манифест приложения.
 *
 * Продукт живёт в трёх местах сразу: кабинет заказчика, доска специалиста,
 * панель бюро. Установленный на телефон, он перестаёт быть вкладкой среди
 * сорока других — а для специалиста это существенно: у него часовые сроки, и
 * доска, до которой надо доскроллиться в браузере, проигрывает значку.
 *
 * start_url — вход по ключу, а не главная. Установивший приложение это не
 * гость: он уже чей-то, и первый экран должен вести туда, где он работает.
 * Главная нужна тому, кто ещё выбирает, а такой человек приложение не ставит.
 *
 * display: standalone — без адресной строки. Это не украшение: адрес проекта
 * сам по себе сведение о заказчике (см. robots.ts), и убрать его с экрана в
 * общественном месте — то же соображение, что и не пускать его в Referer.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TinyArc Cloud Bureau',
    short_name: 'TinyArc',
    description:
      'Project documentation from a team the engine assembles: brief, stages, acceptance and the set of files.',
    start_url: '/enter',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0a0e14',
    theme_color: '#0a0e14',
    lang: 'en',
    dir: 'ltr',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Android обрезает иконку по своей форме. Без отдельной маскируемой
      // рисунок теряет края, и значок приезжает подрезанным.
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // Быстрые действия по долгому нажатию на значок. Ровно три, потому что
    // ролей в продукте три, и человеку нужна одна из них — своя.
    shortcuts: [
      { name: 'Work board', short_name: 'Work', url: '/work' },
      { name: 'Project cabinet', short_name: 'Project', url: '/project' },
      { name: 'Start a brief', short_name: 'Brief', url: '/brief' },
    ],
  }
}
