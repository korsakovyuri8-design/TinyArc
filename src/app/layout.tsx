import type { Metadata, Viewport } from 'next'
import { DM_Sans, Golos_Text, Playfair_Display, Space_Mono } from 'next/font/google'
import Link from 'next/link'
import './globals.css'
import { siteUrl } from '@/lib/site'
import { ServiceWorker } from '@/components/ServiceWorker'

/*
 * Гарнитуры зафиксированы концептом (п.23): Playfair Display — заголовки,
 * DM Sans — текст, Space Mono — лейблы.
 *
 * Оговорка, которую нельзя спрятать: у DM Sans и Space Mono нет кириллицы — ни
 * в наборе Next, ни на самих Google Fonts. Интерфейс при этом русский. Поэтому
 * в стеке текста DM Sans стоит первым, а за ним Golos Text: браузер подставляет
 * гарнитуру поглифно, латиница остаётся в брендовой DM Sans, кириллица
 * набирается Golos Text. Space Mono так и остаётся на лейблах и числах —
 * латинице и цифрам.
 */
const playfair = Playfair_Display({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-playfair',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const golos = Golos_Text({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-golos',
  display: 'swap',
})

const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-space-mono',
  display: 'swap',
})

const DESCRIPTION =
  'The bureau that ends the bureau. An algorithm selects specialists on facts, assembles a team for the project and runs it through to the documentation set. Buildings up to five storeys in Montenegro, Serbia and Greece.'

/**
 * Метаданные сайта.
 *
 * metadataBase задаёт хост, относительно которого Next разворачивает
 * относительные ссылки — канонические адреса и og:image. Без него страница,
 * открытая по любому другому адресу (превью Render, IP), уводит поисковик и
 * мессенджер на себя, а не на домен продукта.
 *
 * Языковых вариантов больше нет: продукт существует на английском, и
 * объяснять поисковику, что это одна страница на двух языках, стало нечего.
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: 'TinyArc Cloud Bureau — an AI-native architectural practice',
  description: DESCRIPTION,
  openGraph: {
    type: 'website',
    siteName: 'TinyArc Cloud Bureau',
    locale: 'en_GB',
    title: 'TinyArc Cloud Bureau — an AI-native architectural practice',
    description: DESCRIPTION,
  },
  /*
   * Карточку собирает opengraph-image.tsx; здесь сказано только, какого она
   * размера в X. Без этой строки ссылка приходит туда узкой строкой с
   * миниатюрой — то есть картинка есть, а видно её не будет.
   */
  twitter: {
    card: 'summary_large_image',
    title: 'TinyArc Cloud Bureau — an AI-native architectural practice',
    description: DESCRIPTION,
  },
  /*
   * Установленное приложение. Манифест лежит в app/manifest.ts; здесь —
   * то, что читает именно iOS: он манифест почти игнорирует и берёт своё.
   *
   * `capable` убирает адресную строку у ярлыка на домашнем экране,
   * `statusBarStyle` красит полосу под тёмный фон продукта — иначе поверх
   * тёмного экрана стоит светлая полоса с чёрным временем.
   */
  appleWebApp: {
    capable: true,
    title: 'TinyArc',
    statusBarStyle: 'black-translucent',
  },
}

/*
 * Цвет полосы браузера и то, как страница ведёт себя под вырезом экрана.
 *
 * viewportFit: 'cover' нужен установленному приложению: без него под «чёлкой»
 * и внизу остаются серые поля, и приложение выглядит вставленным в рамку. Сами
 * отступы берёт на себя вёрстка через env(safe-area-inset-*).
 */
export const viewport: Viewport = {
  themeColor: '#0a0e14',
  colorScheme: 'dark',
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${dmSans.variable} ${golos.variable} ${spaceMono.variable}`}>
      <body>
        <ServiceWorker />

        <header className="site-header">
          <div className="shell">
            <Link href="/" className="brand">
              TinyArc<span style={{ color: 'var(--accent)' }}>/</span>Bureau
            </Link>
            <nav className="nav">
              <Link href="/how-it-works">
                How it works
              </Link>
              <Link href="/algorithm">
                Algorithm
              </Link>
              <Link href="/brief">
                Brief
              </Link>
              <Link href="/specialists">
                For specialists
              </Link>
              <Link href="/enter">
                Sign in
              </Link>
            </nav>
          </div>
        </header>

        <main>{children}</main>

        <footer className="site-footer">
          <div className="shell">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="label">The bureau that ends the bureau</div>
                <p className="dim" style={{ marginTop: 12, maxWidth: '42ch' }}>
                  {'Part of TinyArc Group. A separate venture, financially and structurally independent of the group’s other projects.'}
                </p>
              </div>
              <div className="stack">
                <Link href="/how-it-works">
                  Three stages
                </Link>
                <Link href="/algorithm">
                  See the algorithm
                </Link>
                <Link href="/specialists">
                  Join the pool
                </Link>
                <Link href="/legal/offer">
                  Terms of service
                </Link>
                <Link href="/legal/specialists">
                  Terms for specialists
                </Link>
                <Link href="/legal/privacy">
                  Data processing
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
