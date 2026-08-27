'use client'

import { useActionState, useState } from 'react'
import { AVAILABILITY_LABELS } from '@/lib/labels'
import { setAvailability, type ProfileState } from './actions'

export function AvailabilityForm({
  status,
  hours,
}: {
  status: string
  hours: number
}) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(setAvailability, {})
  const [chosen, setChosen] = useState(status)

  return (
    <form action={action}>
      <div className="field">
        <label>Статус</label>
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
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="weeklyCapacityHours">Свободная ёмкость, ч/нед</label>
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
            ? 'Статус «занят» обнуляет ёмкость: в отборе вас не будет, пока не вернёте часы.'
            : 'Фактор доступности — множитель, а не слагаемое. Ноль часов означает выход из выборки.'}
        </div>
      </div>

      <button type="submit" className="btn btn-quiet" disabled={pending}>
        {pending ? 'Сохраняем…' : 'Сохранить'}
      </button>

      {state.error && (
        <div className="hint" style={{ color: 'var(--fail)', marginTop: 8 }}>
          {state.error}
        </div>
      )}
      {state.message && (
        <div className="hint" style={{ color: 'var(--accent)', marginTop: 8 }}>
          {state.message}
        </div>
      )}
    </form>
  )
}
