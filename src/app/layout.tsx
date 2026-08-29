import type { Metadata } from 'next'
import { DM_Sans, Golos_Text, Playfair_Display, Space_Mono } from 'next/font/google'
import { Link } from '@/components/Link'
import { LocaleSwitch } from '@/components/LocaleSwitch'
import { currentLocale, translate } from '@/lib/i18n'
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await currentLocale()
  const t = (text: string) => translate(text, locale)

  return (
    <html lang={locale} className={`${playfair.variable} ${dmSans.variable} ${golos.variable} ${spaceMono.variable}`}>
      <body>
        <header className="site-header">
          <div className="shell">
            <Link locale={locale} href="/" className="brand">
              TinyArc<span style={{ color: 'var(--accent)' }}>/</span>Bureau
            </Link>
            <nav className="nav">
              <Link locale={locale} href="/how-it-works">
                {t('Как это работает')}
              </Link>
              <Link locale={locale} href="/algorithm">
                {t('Алгоритм')}
              </Link>
              <Link locale={locale} href="/brief">
                {t('Бриф')}
              </Link>
              <Link locale={locale} href="/specialists">
                {t('Специалистам')}
              </Link>
              <Link locale={locale} href="/enter">
                {t('Вход')}
              </Link>
              <LocaleSwitch locale={locale} />
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
                  {t(
                    'Проект в составе TinyArc Group. Отдельный венчур, финансово и структурно отделённый от других проектов группы.',
                  )}
                </p>
              </div>
              <div className="stack">
                <Link locale={locale} href="/how-it-works">
                  {t('Три стадии')}
                </Link>
                <Link locale={locale} href="/algorithm">
                  {t('Демонстрация алгоритма')}
                </Link>
                <Link locale={locale} href="/specialists">
                  {t('Вступить в пул')}
                </Link>
                <Link locale={locale} href="/legal/offer">
                  {t('Публичная оферта')}
                </Link>
                <Link locale={locale} href="/legal/privacy">
                  {t('Обработка данных')}
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
