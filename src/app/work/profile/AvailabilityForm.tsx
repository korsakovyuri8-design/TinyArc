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
  return (
          <AvailabilityFields status={status} hours={hours} />
  )
}

/**
 * Поля отдельным компонентом: переводчик берётся из контекста, а провайдер
 * обязан стоять выше того, кто его читает.
 */
function AvailabilityFields({ status, hours }: { status: string; hours: number }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(setAvailability, {})
  const [chosen, setChosen] = useState(status)

  return (
    <form action={action}>
      <div className="field">
        <label>Status</label>
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
        <label htmlFor="weeklyCapacityHours">Free capacity, h/week</label>
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
            ? 'The “busy” status zeroes your capacity: you stay out of selection until you put the hours back.'
            : 'Availability is a multiplier, not a term added on. Zero hours means dropping out of selection.'}
        </div>
      </div>

      <button type="submit" className="btn btn-quiet" disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
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
