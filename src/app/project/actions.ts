'use server'

import { revalidatePath } from 'next/cache'
import { allow } from '@/lib/guard'
import { retryMessage } from '@/lib/rate-limit'
import { MessageRefused, say } from '@/lib/services/dialogue'
import { currentProjectId } from '@/lib/session'

export type ProjectState = { error?: string; message?: string }

/**
 * Заказчик пишет бюро.
 *
 * Единственный канал, который у него есть, и единственный, который ему нужен:
 * его контрагент — бюро, а не команда. Исполнители этой переписки не видят —
 * сказанное переводит в постановку бюро, иначе клиент начинает руководить
 * командой напрямую (п.6, п.11).
 */
export async function sendToBureau(
  _prev: ProjectState,
  formData: FormData,
): Promise<ProjectState> {
  const projectId = await currentProjectId()
  if (!projectId) return { error: 'Сначала войдите по ключу.' }

  const verdict = await allow('clientMessage')
  if (!verdict.allowed) return { error: retryMessage(verdict.retryAfterSeconds) }

  try {
    await say(projectId, String(formData.get('body') ?? ''))
    revalidatePath('/project')

    return { message: 'Отправлено бюро. Ответ появится здесь же.' }
  } catch (error) {
    if (error instanceof MessageRefused) return { error: error.message }

    console.error('Сообщение бюро не отправлено:', error)
    return { error: 'Не отправилось. Попробуйте ещё раз.' }
  }
}
