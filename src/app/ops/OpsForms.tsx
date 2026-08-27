'use client'

import { useActionState } from 'react'
import type { OpsState } from './actions'
import { opsSignIn } from './actions'

type Action = (prev: OpsState, formData: FormData) => Promise<OpsState>

/** Одна форма на все действия панели: кнопка, скрытые поля, строка ответа. */
export function OpsAction({
  action,
  hidden = {},
  label,
  solid,
  children,
}: {
  action: Action
  /** Пусто, если действие ни к чему не привязано, — например, разбор общей очереди. */
  hidden?: Record<string, string>
  label: string
  solid?: boolean
  children?: React.ReactNode
}) {
  const [state, formAction, pending] = useActionState<OpsState, FormData>(action, {})

  return (
    <form action={formAction}>
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
      <button type="submit" className={solid ? 'btn btn-solid' : 'btn btn-quiet'} disabled={pending}>
        {pending ? '…' : label}
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

export function OpsSignIn() {
  const [state, action, pending] = useActionState<OpsState, FormData>(opsSignIn, {})

  return (
    <form action={action}>
      <div className="field">
        <label htmlFor="password">Пароль бюро</label>
        <input id="password" name="password" type="password" autoComplete="current-password" />
        {state.error && (
          <div className="hint" style={{ color: 'var(--fail)' }}>
            {state.error}
          </div>
        )}
      </div>
      <button type="submit" className="btn btn-solid" disabled={pending}>
        {pending ? 'Проверяем…' : 'Войти'}
      </button>
    </form>
  )
}
