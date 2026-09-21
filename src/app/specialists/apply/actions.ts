'use server'

import { collectLicences } from '@/lib/licence-form'
import { prisma } from '@/lib/db'
import { LEGAL_VERSION } from '@/lib/legal'
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
import { newcomerAccess } from '@/lib/services/settings'

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

  /*
   * Лицензии приходят россыпью: `licence_ME_number`, `licence_RS_authority` и
   * так далее, по три поля на каждую отмеченную страну. Собираются здесь, а не
   * в схеме, потому что имена полей зависят от того, что человек отметил, и
   * заранее их не перечислить.
   *
   * Берутся только страны из signsIn. Поля от страны, которую человек отметил,
   * а потом снял, браузер всё равно пришлёт, и без этой отсечки в базу попала
   * бы лицензия для страны, где человек не заявлял подписи вовсе.
   */
  raw.licences = collectLicences(formData, raw.signsIn, raw.residenceCountry)

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
      errors: { specializations: 'A specialisation must belong to a chosen discipline.' },
      values: raw,
    }
  }

  if (!everyDisciplineCovered(input)) {
    return {
      errors: {
        specializations:
          'In each discipline you chose, mark at least one specialisation, otherwise the engine has nothing to tell you apart by.',
      },
      values: raw,
    }
  }

  const existing = await prisma.specialist.findUnique({ where: { email: input.email } })
  if (existing) {
    /*
     * Сообщение ведёт ко входу, а не сообщает тупик.
     *
     * Человек, который подал анкету и вернулся на эту страницу, почти всегда
     * не помнит, дошла ли она: ответ «такая уже есть» подтверждает, что дошла,
     * и не говорит, что делать дальше. Ему нужен вход, и он в двух словах
     * отсюда.
     */
    return {
      errors: {
        email: 'An application from this address already exists. Sign in at /enter to see it.',
      },
      values: raw,
    }
  }

  // Проверки пройдены, списываем дорогую отправку. До этого места заявка
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
      // Рейтинг портфолио ставит бюро при разборе, а не заявитель о себе (п.9).
      portfolioRating: 0,
      // Доступ спрашивается у настройки пилота, а не берётся умолчанием
      // схемы: бесплатный доступ, решение с датой, и оно принимается в
      // панели, а не в строке схемы, которую меняют выкладкой.
      subscription: await newcomerAccess(),
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
      licencesJson: JSON.stringify(input.licences),
      residenceCountry: input.residenceCountry,
      // Статус проверки ставит бюро, посмотрев реестр. При создании он всегда
      // «со слов»: иначе анкета удостоверяла бы сама себя.
      licenceStatus: 'declared',
      linkedinUrl: input.linkedinUrl,
      phone: input.phone,
      phoneWhatsapp: input.phoneWhatsapp,
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
