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
export function Consent({
  error,
  side = 'client',
}: {
  error?: string
  /**
   * Кому этот документ.
   *
   * Заказчик соглашается с офертой — договором об услуге. Специалист до сих
   * пор соглашался с ней же, хотя про него там нет ни строки: ни отбора
   * алгоритмом, ни подписки, ни метрик, ни правил выхода из проекта. Галочка
   * под чужим документом — это тот случай, когда согласие есть, а согласия
   * нет.
   */
  side?: 'client' | 'specialist'
}) {
  const terms =
    side === 'specialist'
      ? { href: '/legal/specialists', title: 'terms for specialists' }
      : { href: '/legal/offer', title: 'terms of service' }

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
          I have read and accept the{' '}
          <Link href={terms.href} target="_blank">
            {terms.title}
          </Link>{' '}
          and the{' '}
          <Link href="/legal/privacy" target="_blank">
            data processing policy
          </Link>
          , revision {LEGAL_VERSION}.
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
