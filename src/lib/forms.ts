/**
 * Разбор форм.
 *
 * На чтении из базы неизвестное значение словаря отбрасывается молча (rows.ts),
 * а вот на записи — нет: здесь всё проверяется по тем же словарям, что читает
 * движок. Иначе в базу попадает значение, которого таксономия не знает, и отбор
 * тихо перестаёт работать.
 */

import { z } from 'zod'
import {
  CLIMATE_ZONES,
  DISCIPLINES,
  DOC_STAGES,
  IFC_LEVELS,
  JURISDICTIONS,
  LANGUAGES,
  MATERIAL_SYSTEMS,
  REGULATORY_TRACKS,
  SCALE_BANDS,
  SOFTWARE,
  SPECIALIZATIONS,
  TERRAINS,
  TYPOLOGIES,
  WORK_MODES,
  GRID_CONNECTIONS,
  DISCIPLINE_SPECIALIZATIONS,
} from '@/engine/taxonomy'

const trimmed = z.string().trim()

export const briefSchema = z.object({
  title: trimmed.min(2, 'Назовите проект').max(120),
  clientName: trimmed.min(2, 'Как к вам обращаться').max(120),
  clientEmail: z.email('Нужен рабочий адрес: ключ доступа придёт на него'),

  typology: z.enum(TYPOLOGIES),
  storeys: z.coerce.number().int().min(1, 'Минимум один этаж').max(60),
  areaSqm: z.coerce.number().int().min(10, 'Слишком мало').max(200_000),
  jurisdiction: z.enum(JURISDICTIONS),
  climateZone: z.enum(CLIMATE_ZONES),
  materialSystem: z.enum(MATERIAL_SYSTEMS),
  regulatoryTrack: z.enum(REGULATORY_TRACKS),
  targetStage: z.enum(DOC_STAGES),
  terrain: z.enum(TERRAINS),
  gridConnection: z.enum(GRID_CONNECTIONS),

  software: z.array(z.enum(SOFTWARE)),
  languages: z.array(z.enum(LANGUAGES)).min(1, 'Укажите хотя бы один язык'),

  requiredHoursPerWeek: z.coerce.number().int().min(1).max(40),
  horizonDays: z.coerce.number().int().min(7).max(365),

  briefNotes: trimmed.max(4000).default(''),
})

export type BriefInput = z.infer<typeof briefSchema>

export const applicationSchema = z.object({
  displayName: trimmed.min(2, 'Как вас показывать клиенту').max(120),
  email: z.email('Нужен рабочий адрес: ключ доступа придёт на него'),
  portfolioUrl: z.url('Ссылка на портфолио обязательна: это главный вход отбора'),

  disciplines: z.array(z.enum(DISCIPLINES)).min(1, 'Выберите хотя бы одну дисциплину'),
  specializations: z
    .array(z.enum(SPECIALIZATIONS))
    .min(1, 'Отметьте, чем именно вы занимаетесь внутри дисциплины'),
  typologies: z.array(z.enum(TYPOLOGIES)).min(1, 'С какими типологиями работали'),
  scaleBands: z.array(z.enum(SCALE_BANDS)).min(1, 'Какой масштаб вели'),
  maxStoreys: z.coerce.number().int().min(1).max(60),
  materialSystems: z.array(z.enum(MATERIAL_SYSTEMS)).min(1, 'Какие системы вели'),
  climateZones: z.array(z.enum(CLIMATE_ZONES)).min(1, 'В каком климате строили'),
  jurisdictions: z.array(z.enum(JURISDICTIONS)).min(1, 'Где проходили согласования'),
  signsIn: z.array(z.enum(JURISDICTIONS)),
  software: z.array(z.enum(SOFTWARE)).min(1, 'В чём работаете'),
  ifcLevel: z.enum(IFC_LEVELS),
  docStages: z.array(z.enum(DOC_STAGES)).min(1, 'До какой стадии ведёте'),
  regulatoryTracks: z.array(z.enum(REGULATORY_TRACKS)).min(1),
  languages: z.array(z.enum(LANGUAGES)).min(1, 'На каких языках работаете'),
  workMode: z.enum(WORK_MODES),
  utcOffset: z.coerce.number().int().min(-12).max(14),
  weeklyCapacityHours: z.coerce.number().int().min(0).max(60),
  leadTimeDays: z.coerce.number().int().min(0).max(120),
})

export type ApplicationInput = z.infer<typeof applicationSchema>

/**
 * Право подписи — подмножество юрисдикций. Заявить подпись там, где не работал,
 * нельзя: это гейт, на котором держится юридическая сила пакета (п.10).
 */
export function signaturesWithinJurisdictions(input: ApplicationInput): boolean {
  return input.signsIn.every((j) => input.jurisdictions.includes(j))
}

/**
 * Специализация обязана принадлежать заявленной дисциплине.
 *
 * Иначе в профиле появляется конструктор по бетону, который «немного ландшафт»,
 * и роль закрывается человеком, которого на неё никто не звал.
 */
export function specializationsWithinDisciplines(input: ApplicationInput): boolean {
  const allowed = new Set(input.disciplines.flatMap((d) => DISCIPLINE_SPECIALIZATIONS[d]))
  return input.specializations.every((s) => allowed.has(s))
}

/** Дисциплины, у которых есть словарь специализаций, требуют хотя бы одну. */
export function everyDisciplineCovered(input: ApplicationInput): boolean {
  return input.disciplines.every((d) => {
    const own = DISCIPLINE_SPECIALIZATIONS[d]
    return own.length === 0 || own.some((s) => input.specializations.includes(s))
  })
}

/** Значения формы в объект: множественные поля приходят из getAll. */
export function fromFormData(formData: FormData, multi: string[]): Record<string, unknown> {
  const raw: Record<string, unknown> = {}

  for (const [key, value] of formData.entries()) {
    if (multi.includes(key)) continue
    raw[key] = value
  }

  for (const key of multi) raw[key] = formData.getAll(key)

  return raw
}

/** Первое сообщение по каждому полю: форма показывает по одному, не список. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {}

  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form'
    if (!result[key]) result[key] = issue.message
  }

  return result
}

/** Ключ доступа, который можно продиктовать голосом. */
export function accessKey(prefix: string): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(10))

  return `${prefix}-${[...bytes].map((b) => alphabet[b % alphabet.length]).join('')}`
}
