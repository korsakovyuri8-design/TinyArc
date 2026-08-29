'use client'

import { useActionState } from 'react'
import { Field, Submit } from '@/components/Fields'
import { enterWithKey, remindKey, type EnterState, type RecoverState } from './actions'

/**
 * Язык приходит свойством: клиентский компонент заголовков запроса не видит.
 * Сообщения об ошибках при этом собирает и переводит сервер — здесь переводить
 * их было бы поздно, а часть из них подставляет минуты и не нашлась бы в
 * словаре как есть.
 */
export function EnterForm() {
  return (
          <KeyForm />
  )
}

function KeyForm() {
  const [state, action, pending] = useActionState<EnterState, FormData>(enterWithKey, {})

  return (
    <form action={action}>
      <Field
        label="Access key"
        name="key"
        error={state.error}
        hint="Sent to clients after the brief, to specialists after approval"
      >
        <input id="key" name="key" autoComplete="off" placeholder="brief-… or spec-…" />
      </Field>

      <Submit pending={pending}>Sign in</Submit>
    </form>
  )
}

/**
 * Ключ не сохранился.
 *
 * Пароля здесь нет, восстанавливать нечего: ключ — это и есть учётные данные.
 * Поэтому форма не выдаёт новый ключ, а присылает тот же самый на тот же
 * адрес. Новый ключ означал бы, что старое письмо перестало работать, — а оно
 * у человека, скорее всего, есть и просто не нашлось за минуту.
 *
 * Ответ один и тот же, нашёлся адрес или нет: иначе форма отвечает не тому,
 * кто забыл ключ, а тому, кто проверяет, кто у нас в заказчиках.
 */
export function RecoverForm() {
  return (
          <RecoverFields />
  )
}

function RecoverFields() {
  const [state, action, pending] = useActionState<RecoverState, FormData>(remindKey, {})

  return (
    <form action={action}>
      <Field
        label="Email address"
        name="email"
        error={state.error}
        hint="The one the key was issued to"
      >
        <input id="email" name="email" type="email" autoComplete="email" />
      </Field>

      <button type="submit" className="btn btn-quiet" disabled={pending}>
        {pending ? '…' : 'Remind me'}
      </button>

      {state.message && (
        <div className="hint" style={{ color: 'var(--accent)', marginTop: 10 }}>
          {state.message}
        </div>
      )}
    </form>
  )
}
