'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { currentSpecialistId } from '@/lib/session'

export type ProfileState = { error?: string; message?: string }

const STATUSES = new Set(['available', 'part_time', 'busy'])

/**
 * Переключатель доступности.
 *
 * Он не трогает балл напрямую: «занят» означает нулевую свободную ёмкость, а
 * нулевая ёмкость — это гейт (см. engine/filter). Специалист управляет своим
 * временем, а не своим рейтингом.
 */
export async function setAvailability(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const id = await currentSpecialistId()
  if (!id) return { error: 'Sign in with your key first.' }

  const status = String(formData.get('availabilityStatus') ?? '')
  if (!STATUSES.has(status)) return { error: 'Unknown status.' }

  const hours = Number(formData.get('weeklyCapacityHours'))
  if (!Number.isFinite(hours) || hours < 0 || hours > 60) {
    return { error: 'Capacity runs from 0 to 60 hours a week.' }
  }

  await prisma.specialist.update({
    where: { id },
    data: {
      availabilityStatus: status,
      // «Занят» и есть ноль часов: два разных числа про одно и то же
      // разъезжаются в первый же день.
      weeklyCapacityHours: status === 'busy' ? 0 : Math.max(1, Math.round(hours)),
    },
  })

  revalidatePath('/work/profile')
  return { message: 'Availability updated.' }
}
