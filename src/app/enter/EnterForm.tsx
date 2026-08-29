'use client'

import { useActionState } from 'react'
import { Field, Submit } from '@/components/Fields'
import { LocaleProvider, useT } from '@/lib/i18n/context'
import type { Locale } from '@/lib/i18n/locale'
import { enterWithKey, remindKey, type EnterState, type RecoverState } from './actions'

/**
 * Язык приходит свойством: клиентский компонент заголовков запроса не видит.
 * Сообщения об ошибках при этом собирает и переводит сервер — здесь переводить
 * их было бы поздно, а часть из них подставляет минуты и не нашлась бы в
 * словаре как есть.
 */
export function EnterForm({ locale }: { locale: Locale }) {
  return (
    <LocaleProvider locale={locale}>
      <KeyForm />
    </LocaleProvider>
  )
}

function KeyForm() {
  const [state, action, pending] = useActionState<EnterState, FormData>(enterWithKey, {})
  const t = useT()

  return (
    <form action={action}>
      <Field
        label="Ключ доступа"
        name="key"
        error={state.error}
        hint="Клиенту он пришёл после брифа, специалисту — после подтверждения заявки"
      >
        <input id="key" name="key" autoComplete="off" placeholder={t('brief-… или spec-…')} />
      </Field>

      <Submit pending={pending}>{t('Войти')}</Submit>
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
export function RecoverForm({ locale }: { locale: Locale }) {
  return (
    <LocaleProvider locale={locale}>
      <RecoverFields />
    </LocaleProvider>
  )
}

function RecoverFields() {
  const [state, action, pending] = useActionState<RecoverState, FormData>(remindKey, {})
  const t = useT()

  return (
    <form action={action}>
      <Field
        label="Адрес почты"
        name="email"
        error={state.error}
        hint="Тот, на который выдавали ключ"
      >
        <input id="email" name="email" type="email" autoComplete="email" />
      </Field>

      <button type="submit" className="btn btn-quiet" disabled={pending}>
        {pending ? '…' : t('Напомнить ключ')}
      </button>

      {state.message && (
        <div className="hint" style={{ color: 'var(--accent)', marginTop: 10 }}>
          {state.message}
        </div>
      )}
    </form>
  )
}
