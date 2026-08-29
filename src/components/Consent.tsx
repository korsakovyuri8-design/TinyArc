import Link from 'next/link'
import { LEGAL_VERSION } from '@/lib/legal'
import { useLocale, useT } from '@/lib/i18n/context'
import { localePath } from '@/lib/i18n/locale'

/**
 * Согласие с офертой и политикой обработки данных.
 *
 * Один компонент на обе публичные формы намеренно: текст согласия, разошедшийся
 * между заявкой и брифом, — это два разных согласия, и потом не скажешь, на
 * какое из них человек нажал.
 *
 * Отметка не проставлена заранее. Предотмеченная галочка согласием не
 * является ни по смыслу, ни по праву: человек ничего не сделал.
 *
 * Обязательность проверяется схемой на сервере, а не только атрибутом здесь —
 * `required` снимается инструментами разработчика за секунду.
 *
 * Ссылки уводят на документ того языка, на котором человек согласие даёт:
 * согласие с редакцией, которую он не прочитал, потому что она открылась на
 * другом языке, — не согласие (п.13а).
 */
export function Consent({ error }: { error?: string }) {
  const t = useT()
  const locale = useLocale()

  return (
    <div style={{ marginBottom: 24 }}>
      <label
        className="row"
        style={{ gap: 12, alignItems: 'flex-start', cursor: 'pointer' }}
        htmlFor="consent"
      >
        <input
          id="consent"
          name="consent"
          type="checkbox"
          required
          style={{ marginTop: 4, width: 'auto', flex: '0 0 auto' }}
        />
        <span className="muted" style={{ fontSize: '0.9rem' }}>
          {t('Я прочитал и принимаю')}{' '}
          <Link href={localePath('/legal/offer', locale)} target="_blank">
            {t('публичную оферту')}
          </Link>{' '}
          {t('и')}{' '}
          <Link href={localePath('/legal/privacy', locale)} target="_blank">
            {t('политику обработки данных')}
          </Link>
          {t('в редакции')} {LEGAL_VERSION}.
        </span>
      </label>

      {error && (
        <div className="hint" style={{ color: 'var(--fail)', marginTop: 8 }}>
          {t(error)}
        </div>
      )}
    </div>
  )
}
