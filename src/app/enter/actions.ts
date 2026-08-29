'use server'

import { redirect } from 'next/navigation'
import { allow, forgive, spend } from '@/lib/guard'
import { remindKeys } from '@/lib/services/access'
import { mailer } from '@/lib/mail'
import { company } from '@/lib/legal'
import { fill } from '@/lib/fill'
import { retryMessage } from '@/lib/rate-limit'
import {
  projectByKey,
  signInClient,
  signInSpecialist,
  specialistByKey,
} from '@/lib/session'

export type EnterState = { error?: string }
export type RecoverState = { error?: string; message?: string }

/**
 * Вход по ключу. Ключ выдаётся тем каналом, которым с человеком разговаривали:
 * регистрации как отдельного действия в системе нет.
 *
 * Одна форма на обе стороны намеренно: человек не должен помнить, кем он тут
 * числится, — ключ сам знает, чей он.
 */
export async function enterWithKey(_prev: EnterState, formData: FormData): Promise<EnterState> {

  // Вход по ключу дёшев, но это перебор ключа: ограничиваем именно поэтому.
  const verdict = await allow('enter')
  if (!verdict.allowed) return { error: retryMessage(verdict.retryAfterSeconds) }

  const key = String(formData.get('key') ?? '').trim()
  if (!key) return { error: 'Enter your access key.' }

  /*
   * Успешный вход обнуляет счётчик.
   *
   * Ограничитель здесь про подбор ключа, а подбор — это неудачные попытки.
   * Человек, вошедший с телефона, ноутбука и чужого компьютера, атакой не
   * является, а до правки третий вход закрывал ему кабинет на четверть часа.
   * Защиту это не ослабляет: обнулить счётчик может только тот, кто ключ уже
   * знает.
   */
  const project = await projectByKey(key)
  if (project) {
    await forgive('enter')
    await signInClient(project.id)
    redirect('/project')
  }

  const specialist = await specialistByKey(key)
  if (specialist) {
    // Приглашённый входит по ключу до всякого разбора: его позвало бюро, и
    // войти ему нужно ровно затем, чтобы заполнить профиль. Дальше кабинета
    // дозаполнения он не пройдёт — статус проверяется и там.
    if (specialist.status === 'invited') {
      await forgive('enter')
      await signInSpecialist(specialist.id)
      redirect('/work/profile/complete')
    }

    if (specialist.status !== 'active') {
      return {
        error:
          specialist.status === 'pending'
            ? 'The application is still under review. The key starts working once the portfolio passes the threshold.'
            : 'This key is no longer active.',
      }
    }

    await forgive('enter')
    await signInSpecialist(specialist.id)
    redirect('/work')
  }

  return { error: 'No such key.' }
}

/**
 * Напомнить ключ на почту.
 *
 * Ответ один и тот же, нашёлся адрес или нет. Форма, которая отвечает
 * «такого адреса у нас нет», отвечает не тому, кто забыл ключ, а тому, кто
 * проверяет по списку, кто у нас заказчик.
 *
 * Дорогой счётчик списывается до отправки, а не после: письмо уходит чужому
 * человеку, и платить за него должна попытка, а не удача.
 */
export async function remindKey(
  _prev: RecoverState,
  formData: FormData,
): Promise<RecoverState> {

  const verdict = await allow('recover')
  if (!verdict.allowed) return { error: retryMessage(verdict.retryAfterSeconds) }

  const email = String(formData.get('email') ?? '').trim()
  if (!email.includes('@')) return { error: 'Enter an email address.' }

  await spend('recover')

  /*
   * Режим почты называется до отправки и одинаково для всех.
   *
   * При заглушке письмо никуда не уходит, и ответ «письмо ушло» — просто
   * неправда: человек будет ждать его и не дождётся. Сказать про режим можно
   * всем сразу — это свойство стенда, а не ответ на вопрос, есть ли у нас
   * такой адрес.
   */
  if (mailer().mode === 'stub') {
    const address = company().email

    return {
      message: address
        ? fill(
            'Email delivery is off on this stand, so nothing will arrive. Write to {email} and the bureau will hand the key over.',
            { email: address },
          )
        : 'Email delivery is off on this stand, so nothing will arrive. Reply to the email that carried your key, and the bureau will hand it over.',
    }
  }

  try {
    await remindKeys(email)
  } catch (error) {
    // Молча: сказать «письмо не ушло» — значит сказать, что адрес нашёлся.
    console.error('Напоминание ключа не ушло:', error)
  }

  return {
    message: 'If we have this address, the email with the key has already gone out. Check your inbox.',
  }
}
