'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { currentSpecialistId } from '@/lib/session'
import { DISCIPLINES, DOC_STAGES, type Discipline, type DocStage } from '@/engine/taxonomy'
import { PayoutRefused, clearOwnRate, setOwnRate } from '@/lib/services/payouts'

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

/**
 * Своя ставка за дисциплину на стадии.
 *
 * Цену называет человек, а не бюро: гонорар — его деньги. Ставка бюро
 * остаётся умолчанием для тех, кто своей не назвал, и его собственная её
 * перекрывает.
 *
 * В балл она не входит и войти не может. Цена решает, кто по карману, и
 * никогда — кто выше: назвавший меньше не поднимается в выдаче. Обратное
 * означало бы, что место покупается скидкой.
 */
export async function setOwnFee(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const specialistId = await currentSpecialistId()
  if (!specialistId) return { error: 'Sign in with your key first.' }

  const discipline = String(formData.get('discipline') ?? '')
  const stage = String(formData.get('stage') ?? '')
  const raw = String(formData.get('amount') ?? '').trim()

  if (!DISCIPLINES.includes(discipline as Discipline)) return { error: 'Unknown discipline.' }
  if (!DOC_STAGES.includes(stage as DocStage)) return { error: 'Unknown stage.' }

  try {
    /*
     * Пустое поле снимает ставку, а не ставит ноль. Ноль означал бы «работаю
     * бесплатно» — заявление, которого человек не делал, и которое прошло бы
     * любой бюджет.
     */
    if (raw === '') {
      await clearOwnRate(specialistId, discipline as Discipline, stage as DocStage)
      revalidatePath('/work/profile')

      return { message: 'Fee removed. The bureau’s default applies again, if it has one.' }
    }

    await setOwnRate(specialistId, discipline as Discipline, stage as DocStage, Number(raw))
    revalidatePath('/work/profile')

    return { message: 'Saved. It applies to the runs that come after it, not to work already assigned.' }
  } catch (error) {
    if (error instanceof PayoutRefused) return { error: error.message }

    console.error('Ставка специалиста не записана:', error)
    return { error: 'Saving the fee failed.' }
  }
}
