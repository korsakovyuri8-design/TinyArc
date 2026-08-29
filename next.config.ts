import type { NextConfig } from 'next'

/**
 * Заголовки безопасности на каждом ответе.
 *
 * Их не было вовсе: кабинет заказчика можно было вставить в чужой iframe и
 * снять с него нажатия, браузеру разрешалось угадывать тип загруженного файла
 * вместо объявленного, а адрес проекта уезжал в Referer на любую внешнюю
 * ссылку — вместе с ключом в пути, если он там окажется.
 *
 * Полноценной CSP здесь нет намеренно. Next подставляет свои встроенные
 * скрипты, и правило `script-src` без nonce ломает страницы, а nonce нужен
 * proxy, который был удалён вместе с языковой механикой. Ставить CSP с
 * `unsafe-inline` значит записать в конфигурацию, что защита есть, а её нет.
 * `frame-ancestors` при этом взят отдельной строкой: он единственный из CSP,
 * который работает без разбора скриптов.
 */
const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Камера, микрофон и геопозиция продукту не нужны — значит, и разрешать их
  // нечему: запрос от встроенного скрипта не должен даже показывать окно.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  /*
   * HSTS: домен продукта работает только по HTTPS, сертификат выпускает
   * Render. Год и поддомены — обычные значения; preload не заявляем, потому
   * что это односторонняя дорога, и решать её должен владелец домена.
   */
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
]

const nextConfig: NextConfig = {
  typedRoutes: false,
  // Драйверы баз нативные и/или тянут свои файлы: бандлить их нельзя, они
  // подгружаются из node_modules во время работы.
  serverExternalPackages: [
    'better-sqlite3',
    'pg',
    '@prisma/adapter-better-sqlite3',
    '@prisma/adapter-pg',
  ],
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }]
  },
}

export default nextConfig
