import type { Metadata } from 'next'
import { DM_Sans, Golos_Text, Playfair_Display, Space_Mono } from 'next/font/google'
import Link from 'next/link'
import './globals.css'
import { siteUrl } from '@/lib/site'

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
  'Бюро, которое заканчивает бюро. Алгоритм отбирает специалистов по фактам, собирает команду под проект и ведёт её до пакета документации. Здания до пяти этажей в Черногории, Сербии и Греции.'

/*
 * metadataBase задаёт хост, относительно которого Next разворачивает
 * относительные ссылки в разметке — канонические адреса и og:image. Без него
 * страница, открытая по любому другому адресу (превью Render, IP), уводит
 * поисковик и мессенджер на себя, а не на домен продукта.
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: 'TinyArc Cloud Bureau — AI-native архитектурное бюро',
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'TinyArc Cloud Bureau',
    locale: 'ru_RU',
    title: 'TinyArc Cloud Bureau — AI-native архитектурное бюро',
    description: DESCRIPTION,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${playfair.variable} ${dmSans.variable} ${golos.variable} ${spaceMono.variable}`}>
      <body>
        <header className="site-header">
          <div className="shell">
            <Link href="/" className="brand">
              TinyArc<span style={{ color: 'var(--accent)' }}>/</span>Bureau
            </Link>
            <nav className="nav">
              <Link href="/how-it-works">Как это работает</Link>
              <Link href="/algorithm">Алгоритм</Link>
              <Link href="/brief">Бриф</Link>
              <Link href="/specialists">Специалистам</Link>
              <Link href="/enter">Вход</Link>
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
                  Проект в составе TinyArc Group. Отдельный венчур, финансово и структурно
                  отделённый от других проектов группы.
                </p>
              </div>
              <div className="stack">
                <Link href="/how-it-works">Три стадии</Link>
                <Link href="/algorithm">Демонстрация алгоритма</Link>
                <Link href="/specialists">Вступить в пул</Link>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
