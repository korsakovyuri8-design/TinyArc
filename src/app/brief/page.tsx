import { translator } from '@/lib/i18n'
import { pageMetadata } from '@/lib/i18n/metadata'
import { BriefForm } from './BriefForm'

export const generateMetadata = () =>
  pageMetadata(
    'Бриф проекта',
    'Опишите проект. Движок проверит его на продуктовую границу, отберёт специалистов по двенадцати измерениям и соберёт команду.',
  )

export default async function BriefPage() {
  const { locale, t } = await translator()

  return (
    <section style={{ paddingTop: 'clamp(48px, 8vw, 88px)' }}>
      <div className="shell" style={{ maxWidth: 880 }}>
        <span className="eyebrow">{t('Стадия 01 · Filter')}</span>
        <h1>{t('Бриф проекта')}</h1>
        <p className="lead" style={{ marginTop: 20 }}>
          {t(
            'Чем точнее вход, тем меньше в отборе догадок. Ни одно поле здесь не про вкус — всё это измерения, по которым движок считает.',
          )}
        </p>

        <div style={{ marginTop: 44 }}>
          <BriefForm locale={locale} />
        </div>
      </div>
    </section>
  )
}
