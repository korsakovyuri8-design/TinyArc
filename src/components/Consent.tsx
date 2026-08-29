import Link from 'next/link'
import { LEGAL_VERSION } from '@/lib/legal'

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
 */
export function Consent({ error }: { error?: string }) {
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
          Я прочитал и принимаю{' '}
          <Link href="/legal/offer" target="_blank">
            публичную оферту
          </Link>{' '}
          и{' '}
          <Link href="/legal/privacy" target="_blank">
            политику обработки данных
          </Link>{' '}
          в редакции {LEGAL_VERSION}.
        </span>
      </label>

      {error && (
        <div className="hint" style={{ color: 'var(--fail)', marginTop: 8 }}>
          {error}
        </div>
      )}
    </div>
  )
}
