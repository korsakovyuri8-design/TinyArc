'use server'

import { revalidatePath } from 'next/cache'
import {
  applicationWithConsentSchema,
  everyDisciplineCovered,
  fieldErrors,
  fromFormData,
  signaturesWithinJurisdictions,
  specializationsWithinDisciplines,
} from '@/lib/forms'
import type { ApplicationState } from '@/app/specialists/apply/actions'
import { prisma } from '@/lib/db'
import { LEGAL_VERSION } from '@/lib/legal'
import { toList } from '@/lib/rows'
import { currentSpecialistId } from '@/lib/session'

const MULTI = [
  'disciplines',
  'specializations',
  'typologies',
  'scaleBands',
  'materialSystems',
  'climateZones',
  'jurisdictions',
  'signsIn',
  'software',
  'docStages',
  'regulatoryTracks',
  'languages',
]

/**
 * Дозаполнение профиля по приглашению.
 *
 * Проверки те же, что и у публичной заявки, и это не экономия: одинаковые
 * данные обязаны проходить одинаковый контроль, иначе приглашение становится
 * дверью в обход правил. Имя и адрес при этом не трогаются — по адресу человека
 * позвали, и подменять его через форму значило бы уводить чужую запись.
 *
 * По сохранению запись уходит на разбор портфолио: статус invited → pending.
 * Балл по-прежнему ставит бюро — человек даёт данные о себе, а не оценку себе.
 */
export async function completeProfile(
  _prev: ApplicationState,
  formData: FormData,
): Promise<ApplicationState> {
  const id = await currentSpecialistId()
  if (!id) return { errors: { form: 'Sign in with your key first.' } }

  const row = await prisma.specialist.findUnique({ where: { id } })
  if (!row) return { errors: { form: 'Record not found.' } }

  if (row.status !== 'invited') {
    return {
      errors: {
        form: 'The profile is already under review or in the pool. Changes to selection fields go through the bureau.',
      },
    }
  }

  // Имя и адрес берём из записи, а не из формы: они пришли из базы бюро.
  const raw = { ...fromFormData(formData, MULTI), displayName: row.displayName, email: row.email }
  const parsed = applicationWithConsentSchema.safeParse(raw)

  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw }

  const input = parsed.data

  if (!signaturesWithinJurisdictions(input)) {
    return {
      errors: { signsIn: 'Signing rights can only be declared where you have worked.' },
      values: raw,
    }
  }

  if (!specializationsWithinDisciplines(input)) {
    return {
      errors: { specializations: 'A specialisation must belong to a declared discipline.' },
      values: raw,
    }
  }

  if (!everyDisciplineCovered(input)) {
    return {
      errors: { specializations: 'In each discipline, mark what exactly you do.' },
      values: raw,
    }
  }

  await prisma.specialist.update({
    where: { id },
    data: {
      status: 'pending',
      // Приглашённого завели импортом из базы бюро, то есть до всякого его
      // согласия. Дозаполнение профиля — первый момент, когда он может сказать
      // «да», и молчаливо считать согласие полученным здесь нельзя.
      consentAt: new Date(),
      consentVersion: LEGAL_VERSION,
      portfolioUrl: input.portfolioUrl,
      disciplinesJson: toList(input.disciplines),
      specializationsJson: toList(input.specializations),
      typologiesJson: toList(input.typologies),
      scaleBandsJson: toList(input.scaleBands),
      maxStoreys: input.maxStoreys,
      materialSystemsJson: toList(input.materialSystems),
      climateZonesJson: toList(input.climateZones),
      jurisdictionsJson: toList(input.jurisdictions),
      signsInJson: toList(input.signsIn),
      softwareJson: toList(input.software),
      ifcLevel: input.ifcLevel,
      docStagesJson: toList(input.docStages),
      regulatoryTracksJson: toList(input.regulatoryTracks),
      languagesJson: toList(input.languages),
      workMode: input.workMode,
      utcOffset: input.utcOffset,
      weeklyCapacityHours: input.weeklyCapacityHours,
      leadTimeDays: input.leadTimeDays,
    },
  })

  revalidatePath('/work/profile')
  revalidatePath('/ops/applications')

  return { submitted: true }
}
