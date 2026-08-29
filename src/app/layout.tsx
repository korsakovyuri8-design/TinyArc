import type { Metadata } from 'next'
import { DM_Sans, Golos_Text, Playfair_Display, Space_Mono } from 'next/font/google'
import { Link } from '@/components/Link'
import { LocaleSwitch } from '@/components/LocaleSwitch'
import { headers } from 'next/headers'
import { currentLocale, translate, translator } from '@/lib/i18n'
import { LOCALES, PATH_HEADER, localePath } from '@/lib/i18n/locale'
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

/**
 * Метаданные на языке запроса.
 *
 * metadataBase задаёт хост, относительно которого Next разворачивает
 * относительные ссылки — канонические адреса и og:image. Без него страница,
 * открытая по любому другому адресу (превью Render, IP), уводит поисковик и
 * мессенджер на себя, а не на домен продукта.
 *
 * Через generateMetadata, а не статическим объектом: статический считается на
 * сборке и не знает, кто пришёл, — русский заголовок в поисковой выдаче для
 * англоязычного запроса означает, что английской версии как будто нет.
 *
 * alternates.languages — то, чем поисковику объясняют, что это одна и та же
 * страница на двух языках, а не две разные и не дубль. Без них он выбирает
 * одну сам, и обычно не ту.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await translator()
  const path = (await headers()).get(PATH_HEADER) ?? '/'

  return {
    metadataBase: new URL(siteUrl()),
    title: t('TinyArc Cloud Bureau — AI-native архитектурное бюро'),
    description: t(DESCRIPTION),
    alternates: {
      canonical: localePath(path, locale),
      languages: Object.fromEntries(LOCALES.map((code) => [code, localePath(path, code)])),
    },
    openGraph: {
      type: 'website',
      url: localePath(path, locale),
      siteName: 'TinyArc Cloud Bureau',
      locale: locale === 'ru' ? 'ru_RU' : 'en_GB',
      title: t('TinyArc Cloud Bureau — AI-native архитектурное бюро'),
      description: t(DESCRIPTION),
    },
  }
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
