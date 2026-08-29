import { Link } from '@/components/Link'
import { translator } from '@/lib/i18n'
import { pageMetadata } from '@/lib/i18n/metadata'

export const generateMetadata = () => pageMetadata('Адрес не открылся')

/**
 * Страница несуществующего адреса.
 *
 * Сюда попадают тремя путями, и все три — не «человек ошибся в наборе».
 * По устаревшей ссылке из старого письма; по адресу закрытого проекта; по
 * чужому тикету — потому что чужое у нас неотличимо от несуществующего, и это
 * решение принято намеренно (п.13).
 *
 * Поэтому здесь сказано и то, чего обычно не пишут: одинаковый ответ на «нет
 * такого» и «не ваше» — не сбой. Человек, вошедший не той стороной, иначе
 * будет считать, что система потеряла его проект.
 *
 * Выходы отсюда — те же три двери, что и на входе: главная, бриф, вход по
 * ключу. Страница без выхода превращает опечатку в конец сеанса.
 */
export default async function NotFound() {
  const { locale, t } = await translator()

  return (
    <section style={{ paddingTop: 'clamp(48px, 8vw, 96px)' }}>
      <div className="shell" style={{ maxWidth: 620 }}>
        <span className="eyebrow">404</span>
        <h1 style={{ maxWidth: '18ch' }}>{t('Такого адреса нет')}</h1>

        <p className="lead" style={{ marginTop: 20 }}>{t('Ссылка могла устареть — например, пришла из старого письма. Так же отвечает адрес, который существует, но не ваш: чужой проект и чужой тикет неотличимы от несуществующих намеренно, иначе по ответу можно было бы проверять, что у нас есть.')}</p>

        <div className="divider" style={{ marginTop: 36 }} />

        <div className="stack" style={{ gap: 10 }}>
          <Link locale={locale} href="/">{t('На главную')}</Link>
          <Link locale={locale} href="/enter">{t('Войти по ключу — кабинет проекта или доска работ')}</Link>
          <Link locale={locale} href="/brief">{t('Оставить бриф на свой проект')}</Link>
        </div>
      </div>
    </section>
  )
}
