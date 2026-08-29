'use client'

import { useActionState } from 'react'
import { Field, Submit } from '@/components/Fields'
import { translate } from '@/lib/i18n/dict'
import type { Locale } from '@/lib/i18n/locale'
import { enterWithKey, type EnterState } from './actions'

/**
 * Язык приходит свойством: клиентский компонент заголовков запроса не видит.
 * Сообщения об ошибках при этом собирает сервер и переводит там же — здесь
 * переводить их было бы поздно.
 */
export function EnterForm({ locale }: { locale: Locale }) {
  const [state, action, pending] = useActionState<EnterState, FormData>(enterWithKey, {})
  const t = (text: string) => translate(text, locale)

  return (
    <form action={action}>
      <Field
        label={t('Ключ доступа')}
        name="key"
        error={state.error}
        hint={t('Клиенту он пришёл после брифа, специалисту — после подтверждения заявки')}
      >
        <input id="key" name="key" autoComplete="off" placeholder={t('brief-… или spec-…')} />
      </Field>

      <Submit pending={pending}>{t('Войти')}</Submit>
    </form>
  )
}
