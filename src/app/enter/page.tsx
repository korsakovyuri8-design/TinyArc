import { Link } from '@/components/Link'
import { translator } from '@/lib/i18n'
import { pageMetadata } from '@/lib/i18n/metadata'
import { EnterForm, RecoverForm } from './EnterForm'

export const generateMetadata = () => pageMetadata('Вход')

export default async function EnterPage() {
  const { locale, t } = await translator()

  return (
    <section style={{ paddingTop: 'clamp(48px, 8vw, 96px)' }}>
      <div className="shell" style={{ maxWidth: 520 }}>
        <span className="eyebrow">{t('Вход')}</span>
        <h1>{t('По ключу')}</h1>
        <p className="lead" style={{ marginTop: 18 }}>
          {t(
            'Регистрации как отдельного действия здесь нет. Клиент получает ключ после брифа, специалист — после того, как заявку подтвердили.',
          )}
        </p>

        <div style={{ marginTop: 36 }}>
          <EnterForm locale={locale} />
        </div>

        <div className="divider" />

        <details style={{ marginBottom: 28 }}>
          <summary className="label" style={{ cursor: 'pointer' }}>
            {t('Ключ не сохранился')}
          </summary>
          <p className="muted" style={{ marginTop: 14, fontSize: '0.92rem' }}>{t('Ключ пришлём на тот адрес, на который выдавали. Нового ключа не будет: старое письмо, если оно найдётся, продолжит работать.')}</p>
          <div style={{ marginTop: 16 }}>
            <RecoverForm locale={locale} />
          </div>
        </details>

        <div className="stack" style={{ gap: 10 }}>
          <Link locale={locale} href="/brief">
            {t('Нет ключа и есть участок → оставить бриф')}
          </Link>
          <Link locale={locale} href="/specialists">
            {t('Нет ключа и вы специалист → подать заявку')}
          </Link>
          <Link locale={locale} href="/ops" className="dim">
            {t('Вход для бюро')}
          </Link>
        </div>
      </div>
    </section>
  )
}
