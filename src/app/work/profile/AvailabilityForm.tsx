'use client'

import { useActionState, useState } from 'react'
import { AVAILABILITY_LABELS, DISCIPLINE_LABELS, DOC_STAGE_LABELS } from '@/lib/labels'
import { DOC_STAGES, type Discipline, type DocStage } from '@/engine/taxonomy'
import { fill } from '@/lib/fill'
import { setAvailability, setOwnFee, type ProfileState } from './actions'

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

/**
 * Своя ставка за дисциплину на стадии.
 *
 * Второе, чем человек управляет сам, — после времени. Цену называет он, а не
 * бюро: гонорар это его деньги. В балл она не входит, и об этом сказано прямо
 * — иначе первым делом её начнут занижать, чтобы «подняться в выдаче».
 */
export function FeeForm({
  disciplines,
  rates,
  currency,
}: {
  disciplines: string[]
  rates: { discipline: string; stage: string; amount: number }[]
  currency: string
}) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(setOwnFee, {})
  const named = new Map(rates.map((r) => [`${r.discipline}:${r.stage}`, r.amount]))

  return (
    <form action={action}>
      <div className="grid grid-2" style={{ gap: 16, marginBottom: 14 }}>
        <div className="field">
          <label htmlFor="fee-discipline">Discipline</label>
          <select id="fee-discipline" name="discipline" defaultValue={disciplines[0] ?? ''}>
            {disciplines.map((value) => (
              <option key={value} value={value}>
                {DISCIPLINE_LABELS[value as Discipline] ?? value}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="fee-stage">Stage</label>
          <select id="fee-stage" name="stage" defaultValue={DOC_STAGES[0]}>
            {DOC_STAGES.map((value) => (
              <option key={value} value={value}>
                {DOC_STAGE_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field" style={{ marginBottom: 14 }}>
        <label htmlFor="fee-amount">{fill('Your fee, {currency}', { currency })}</label>
        <input id="fee-amount" name="amount" type="number" min="0" step="1" placeholder="Leave empty to remove" />
      </div>

      <button type="submit" className="btn btn-solid" disabled={pending}>
        {pending ? '…' : 'Save the fee'}
      </button>

      {state.error && (
        <div className="hint" style={{ color: 'var(--fail)', marginTop: 10 }}>
          {state.error}
        </div>
      )}
      {state.message && (
        <div className="hint" style={{ color: 'var(--accent)', marginTop: 10 }}>
          {state.message}
        </div>
      )}

      {named.size > 0 && (
        <div className="stack" style={{ gap: 6, marginTop: 18 }}>
          {[...named.entries()].map(([key, amount]) => {
            const [discipline, stage] = key.split(':')

            return (
              <div key={key} className="row" style={{ gap: 10, alignItems: 'baseline' }}>
                <span className="dim" style={{ fontSize: '0.82rem' }}>
                  {DISCIPLINE_LABELS[discipline as Discipline] ?? discipline} ·{' '}
                  {DOC_STAGE_LABELS[stage as DocStage] ?? stage}
                </span>
                <span className="num">
                  {amount} {currency}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </form>
  )
}
