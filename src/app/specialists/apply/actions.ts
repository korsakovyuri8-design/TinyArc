'use server'

import { prisma } from '@/lib/db'
import { LEGAL_VERSION } from '@/lib/legal'
import { currentLocale } from '@/lib/i18n'
import { allow, spend } from '@/lib/guard'
import { retryMessage } from '@/lib/rate-limit'
import {
  accessKey,
  applicationWithConsentSchema,
  everyDisciplineCovered,
  fieldErrors,
  fromFormData,
  signaturesWithinJurisdictions,
  specializationsWithinDisciplines,
} from '@/lib/forms'
import { toList } from '@/lib/rows'

export type ApplicationState = {
  errors?: Record<string, string>
  values?: Record<string, unknown>
  submitted?: boolean
}

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

export async function submitApplication(
  _prev: ApplicationState,
  formData: FormData,
): Promise<ApplicationState> {
  const verdict = await allow('application')
  if (!verdict.allowed) {
    return { errors: { form: retryMessage(verdict.retryAfterSeconds) } }
  }

  const raw = fromFormData(formData, MULTI)
  const parsed = applicationWithConsentSchema.safeParse(raw)

  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw }

  const input = parsed.data

  if (!signaturesWithinJurisdictions(input)) {
    return {
      errors: { signsIn: 'Право подписи можно заявить только там, где вы работали.' },
      values: raw,
    }
  }

  if (!specializationsWithinDisciplines(input)) {
    return {
      errors: { specializations: 'Специализация должна принадлежать выбранной дисциплине.' },
      values: raw,
    }
  }

  if (!everyDisciplineCovered(input)) {
    return {
      errors: {
        specializations:
          'В каждой выбранной дисциплине отметьте хотя бы одну специализацию — иначе движку нечем вас отличить.',
      },
      values: raw,
    }
  }

  const existing = await prisma.specialist.findUnique({ where: { email: input.email } })
  if (existing) {
    return { errors: { email: 'Заявка с этим адресом уже есть.' }, values: raw }
  }

  // Проверки пройдены — списываем дорогую отправку. До этого места заявка
  // стоила одного разбора схемы.
  await spend('application')

  await prisma.specialist.create({
    data: {
      displayName: input.displayName,
      email: input.email,
      // Ключ выписывается сразу, но работать начнёт только после подтверждения:
      // статус, а не наличие ключа, решает, пускать ли (см. src/app/enter).
      accessKey: accessKey('spec'),
      // Согласие пишется вместе с редакцией: по одной дате не восстановить,
      // с чем именно человек согласился (см. src/lib/legal.ts).
      consentAt: new Date(),
      consentVersion: LEGAL_VERSION,
      consentLocale: await currentLocale(),
      // Рейтинг портфолио ставит бюро при разборе, а не заявитель о себе (п.9).
      portfolioRating: 0,
      status: 'pending',
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

  return { submitted: true }
}
