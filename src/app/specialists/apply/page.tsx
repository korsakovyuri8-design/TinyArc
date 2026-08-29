import { SpecialistForm } from '@/components/SpecialistForm'
import { translator } from '@/lib/i18n'
import { pageMetadata } from '@/lib/i18n/metadata'
import { submitApplication } from './actions'

export const generateMetadata = () => pageMetadata('Заявка специалиста')

export default async function ApplyPage() {
  const { locale, t } = await translator()

  return (
    <section style={{ paddingTop: 'clamp(48px, 8vw, 88px)' }}>
      <div className="shell" style={{ maxWidth: 880 }}>
        <span className="eyebrow">{t('Заявка')}</span>
        <h1>{t('Двенадцать измерений')}</h1>
        <p className="lead" style={{ marginTop: 20 }}>{t('Это не резюме. Каждое поле — измерение, по которому движок считает пересечение с проектом. Заявить лишнее не выгодно: несовпадение вскроется на первом же тикете и осядет в метриках.')}</p>

        <div style={{ marginTop: 44 }}>
          <SpecialistForm action={submitApplication} askConsent locale={locale} />
        </div>
      </div>
    </section>
  )
}
