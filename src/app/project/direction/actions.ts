'use server'

import { redirect } from 'next/navigation'
import { chooseDirection } from '@/lib/services/direction'
import { currentProjectId } from '@/lib/session'

export type DirectionState = { error?: string }

export async function pickDirection(
  _prev: DirectionState,
  formData: FormData,
): Promise<DirectionState> {
  const projectId = await currentProjectId()
  if (!projectId) return { error: 'Сначала войдите по ключу.' }

  const key = String(formData.get('key') ?? '')

  try {
    await chooseDirection(projectId, key)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Не получилось.' }
  }

  redirect('/project?issued=1')
}
