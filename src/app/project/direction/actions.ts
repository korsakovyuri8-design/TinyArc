'use server'

import { redirect } from 'next/navigation'
import { DirectionClosed, UnknownDirection, chooseDirection } from '@/lib/services/direction'
import { currentProjectId } from '@/lib/session'

export type DirectionState = { error?: string }

export async function pickDirection(
  _prev: DirectionState,
  formData: FormData,
): Promise<DirectionState> {
  const projectId = await currentProjectId()
  if (!projectId) return { error: 'Sign in with your key first.' }

  const key = String(formData.get('key') ?? '')

  try {
    await chooseDirection(projectId, key)
  } catch (error) {
    // Наружу идут только те две причины, которые заказчик может понять и с
    // которыми может что-то сделать. Всё остальное — наше, и в тексте на
    // экране от него пользы нет.
    if (error instanceof DirectionClosed || error instanceof UnknownDirection) {
      return { error: error.message }
    }

    console.error('Направление не выбрано:', error)
    return { error: 'The choice did not go through. Try again.' }
  }

  redirect('/project?issued=1')
}
