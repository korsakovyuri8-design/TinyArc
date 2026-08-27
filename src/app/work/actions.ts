'use server'

import { revalidatePath } from 'next/cache'
import { comment, submit } from '@/lib/services/relay'
import { currentSpecialistId } from '@/lib/session'

export type WorkState = { error?: string }

/**
 * Действия специалиста по тикету.
 *
 * Оба проверяют, что тикет принадлежит вошедшему: серверное действие достижимо
 * прямым POST, а не только из своей формы.
 */
export async function postComment(_prev: WorkState, formData: FormData): Promise<WorkState> {
  const specialistId = await currentSpecialistId()
  if (!specialistId) return { error: 'Сначала войдите по ключу.' }

  const ticketId = String(formData.get('ticketId') ?? '')
  const body = String(formData.get('body') ?? '').trim()
  if (!body) return { error: 'Пустой комментарий.' }

  try {
    await comment(ticketId, { role: 'specialist', specialistId }, body)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Не получилось.' }
  }

  revalidatePath(`/work/${ticketId}`)
  return {}
}

export async function submitTicket(_prev: WorkState, formData: FormData): Promise<WorkState> {
  const specialistId = await currentSpecialistId()
  if (!specialistId) return { error: 'Сначала войдите по ключу.' }

  const ticketId = String(formData.get('ticketId') ?? '')

  try {
    await submit(ticketId, specialistId)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Не получилось.' }
  }

  revalidatePath(`/work/${ticketId}`)
  revalidatePath('/work')
  return {}
}
