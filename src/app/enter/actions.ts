'use server'

import { redirect } from 'next/navigation'
import { allow } from '@/lib/guard'
import { retryMessage } from '@/lib/rate-limit'
import {
  projectByKey,
  signInClient,
  signInSpecialist,
  specialistByKey,
} from '@/lib/session'

export type EnterState = { error?: string }

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
  if (!key) return { error: 'Введите ключ доступа.' }

  const project = await projectByKey(key)
  if (project) {
    await signInClient(project.id)
    redirect('/project')
  }

  const specialist = await specialistByKey(key)
  if (specialist) {
    if (specialist.status !== 'active') {
      return {
        error:
          specialist.status === 'pending'
            ? 'Заявка ещё на разборе. Ключ заработает, когда портфолио пройдёт порог.'
            : 'Этот ключ больше не активен.',
      }
    }

    await signInSpecialist(specialist.id)
    redirect('/work')
  }

  return { error: 'Такого ключа нет.' }
}
