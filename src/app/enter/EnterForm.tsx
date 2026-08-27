'use client'

import { useActionState } from 'react'
import { Field, Submit } from '@/components/Fields'
import { enterWithKey, type EnterState } from './actions'

export function EnterForm() {
  const [state, action, pending] = useActionState<EnterState, FormData>(enterWithKey, {})

  return (
    <form action={action}>
      <Field
        label="Ключ доступа"
        name="key"
        error={state.error}
        hint="Клиенту он пришёл после брифа, специалисту — после подтверждения заявки"
      >
        <input id="key" name="key" autoComplete="off" placeholder="brief-… или spec-…" />
      </Field>

      <Submit pending={pending}>Войти</Submit>
    </form>
  )
}
