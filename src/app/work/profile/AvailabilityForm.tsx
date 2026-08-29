'use client'

import { useActionState, useState } from 'react'
import { AVAILABILITY_LABELS } from '@/lib/labels'
import { LocaleProvider, useT } from '@/lib/i18n/context'
import type { Locale } from '@/lib/i18n/locale'
import { setAvailability, type ProfileState } from './actions'

export function AvailabilityForm({
  status,
  hours,
  locale,
}: {
  status: string
  hours: number
  locale: Locale
}) {
  return (
    <LocaleProvider locale={locale}>
      <AvailabilityFields status={status} hours={hours} />
    </LocaleProvider>
  )
}

/**
 * Поля отдельным компонентом: переводчик берётся из контекста, а провайдер
 * обязан стоять выше того, кто его читает.
 */
function AvailabilityFields({ status, hours }: { status: string; hours: number }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(setAvailability, {})
  const [chosen, setChosen] = useState(status)
  const t = useT()

  return (
    <form action={action}>
      <div className="field">
        <label>{t('Статус')}</label>
        <div className="choices">
          {Object.entries(AVAILABILITY_LABELS).map(([value, label]) => (
            <label key={value} className="choice">
              <input
                type="radio"
                name="availabilityStatus"
                value={value}
                checked={chosen === value}
                onChange={() => setChosen(value)}
              />
              {t(label)}
            </label>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="weeklyCapacityHours">{t('Свободная ёмкость, ч/нед')}</label>
        <input
          id="weeklyCapacityHours"
          name="weeklyCapacityHours"
          type="number"
          min={0}
          max={60}
          defaultValue={hours}
          disabled={chosen === 'busy'}
        />
        <div className="hint">
          {chosen === 'busy'
            ? t('Статус «занят» обнуляет ёмкость: в отборе вас не будет, пока не вернёте часы.')
            : t('Фактор доступности — множитель, а не слагаемое. Ноль часов означает выход из выборки.')}
        </div>
      </div>

      <button type="submit" className="btn btn-quiet" disabled={pending}>
        {pending ? t('Сохраняем…') : t('Сохранить')}
      </button>

      {state.error && (
        <div className="hint" style={{ color: 'var(--fail)', marginTop: 8 }}>
          {t(state.error)}
        </div>
      )}
      {state.message && (
        <div className="hint" style={{ color: 'var(--accent)', marginTop: 8 }}>
          {t(state.message)}
        </div>
      )}
    </form>
  )
}
