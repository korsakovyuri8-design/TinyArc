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
  if (!projectId) return { error: 'Sign in with your key first.' }

  const key = String(formData.get('key') ?? '')

  try {
    await chooseDirection(projectId, key)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'That did not work.' }
  }

  redirect('/project?issued=1')
}
