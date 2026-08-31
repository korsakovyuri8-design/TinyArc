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

/**
 * Адрес почты — в одном виде, всегда.
 *
 * Формы писали адрес так, как его набрали, а ищут по нему уже приведённым к
 * нижнему регистру: и напоминание ключа, и импорт базы. Из-за этого заказчик,
 * набравший Ivan@Example.com, терял кабинет навсегда — ключ здесь заменяет
 * пароль, другого пути назад нет, а форма честно отвечала ему, что за этим
 * адресом ничего не числится. Тот же разнобой проводил одного человека мимо
 * уникального ключа дважды: две записи, два ключа, два разбора портфолио.
 *
 * Домен регистра не различает по стандарту; локальная часть формально может,
 * но так не делает ни один почтовый сервис, и нормализуют её все. Пробелы
 * снимаются до проверки: адрес, вставленный из письма, приходит с ними.
 */
const emailField = (message: string) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
    z.email(message),
  )

/**
 * Адрес, как его набрали, — в тот вид, в каком он лежит в базе.
 *
 * То же приведение, что и на записи, но для чтения: журнал писем ищет по
 * адресу, а `contains` у prisma смотрит на регистр по-разному — на SQLite не
 * смотрит, на Postgres смотрит. Поиск без приведения работал бы на стенде и
 * молчал в бою: оператор на жалобу «мне ничего не приходило» отвечал бы «и
 * правда ничего», набрав адрес с заглавной.
 *
 * Ни одного адреса это не теряет: тот же нижний регистр стоит на записи, и
 * сторожит его `emailField` рядом.
 */
export function readEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

/**
 * Согласие с офертой и политикой обработки данных.
 *
 * Проверяется схемой, а не только атрибутом required в разметке. Атрибут
 * снимается инструментами разработчика за секунду, и тогда запись появляется
 * без согласия — а доказать потом, что человек соглашался, будет нечем.
 *
 * Чекбокс присылает "on" или не присылает ничего: незаполненное поле формы
 * браузер не отправляет вовсе, поэтому пустая строка здесь — это «не отметил».
 */
const consent = z
  .literal('on', { message: 'We cannot accept a submission without agreement to the terms and the data policy' })

export const briefSchema = z.object({
  title: trimmed.min(2, 'Name the project').max(120),
  clientName: trimmed.min(2, 'How to address you').max(120),
  clientEmail: emailField('We need a working address: the access key goes there'),

  typology: z.enum(TYPOLOGIES),
  storeys: z.coerce.number().int().min(1, 'At least one storey').max(60),
  areaSqm: z.coerce.number().int().min(10, 'Too small').max(200_000),
  jurisdiction: z.enum(JURISDICTIONS),
  climateZone: z.enum(CLIMATE_ZONES),
  materialSystem: z.enum(MATERIAL_SYSTEMS),
  regulatoryTrack: z.enum(REGULATORY_TRACKS),
  targetStage: z.enum(DOC_STAGES),
  terrain: z.enum(TERRAINS),
  gridConnection: z.enum(GRID_CONNECTIONS),

  software: z.array(z.enum(SOFTWARE)),
  languages: z.array(z.enum(LANGUAGES)).min(1, 'Name at least one language'),

  requiredHoursPerWeek: z.coerce.number().int().min(1).max(40),
  horizonDays: z.coerce.number().int().min(7).max(365),

  briefNotes: trimmed.max(4000).default(''),

  consent,
})

export type BriefInput = z.infer<typeof briefSchema>

export const applicationSchema = z.object({
  displayName: trimmed.min(2, 'How to show you to the client').max(120),
  email: emailField('We need a working address: the access key goes there'),
  portfolioUrl: z.url('A portfolio link is required: it is the main entrance to selection'),

  disciplines: z.array(z.enum(DISCIPLINES)).min(1, 'Choose at least one discipline'),
  /**
   * Минимума по списку здесь нет намеренно.
   *
   * У геодезии словаря специализаций нет: подоснова есть подоснова, делить её
   * не на что. Требование «хотя бы одна» закрывало геодезисту вход целиком —
   * отметить в форме нечего, а форма требует отметить. Обязательность решается
   * не длиной списка, а словарём дисциплины: см. everyDisciplineCovered.
   */
  specializations: z.array(z.enum(SPECIALIZATIONS)),
  typologies: z.array(z.enum(TYPOLOGIES)).min(1, 'Which typologies you have worked on'),
  scaleBands: z.array(z.enum(SCALE_BANDS)).min(1, 'Which scale you have led'),
  maxStoreys: z.coerce.number().int().min(1).max(60),
  materialSystems: z.array(z.enum(MATERIAL_SYSTEMS)).min(1, 'Which systems you have led'),
  climateZones: z.array(z.enum(CLIMATE_ZONES)).min(1, 'Which climates you have built in'),
  jurisdictions: z.array(z.enum(JURISDICTIONS)).min(1, 'Where you have taken projects through approvals'),
  signsIn: z.array(z.enum(JURISDICTIONS)),
  software: z.array(z.enum(SOFTWARE)).min(1, 'What you work in'),
  ifcLevel: z.enum(IFC_LEVELS),
  docStages: z.array(z.enum(DOC_STAGES)).min(1, 'How far you carry documentation'),
  regulatoryTracks: z.array(z.enum(REGULATORY_TRACKS)).min(1),
  languages: z.array(z.enum(LANGUAGES)).min(1, 'Which languages you work in'),
  workMode: z.enum(WORK_MODES),
  utcOffset: z.coerce.number().int().min(-12).max(14),
  weeklyCapacityHours: z.coerce.number().int().min(0).max(60),
  leadTimeDays: z.coerce.number().int().min(0).max(120),
})

export type ApplicationInput = z.infer<typeof applicationSchema>

/**
 * Заявка вместе с согласием.
 *
 * Отдельной схемой, а не полем в основной: `applicationSchema` обслуживает три
 * формы. Публичную заявку и дозаполнение профиля приглашённым — там согласие
 * обязательно, потому что человек впервые отдаёт свои данные сам. И правку
 * профиля в панели бюро — там его спрашивать не у кого: за формой сидит
 * оператор, а не тот, чьи это данные.
 *
 * Приглашённый согласие даёт наравне с пришедшим сам, и это не формальность:
 * его завели импортом из базы бюро, то есть до всякого согласия. Дозаполнение
 * профиля — первый момент, когда он вообще может сказать «да».
 */
export const applicationWithConsentSchema = applicationSchema.extend({ consent })

export type ApplicationWithConsentInput = z.infer<typeof applicationWithConsentSchema>

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

/**
 * Алфавит ключа.
 *
 * Без заглавных и без похожих друг на друга знаков: ключ должен диктоваться
 * голосом и переписываться с бумаги без вопроса «это единица или l». Отсюда же
 * следует, что регистр в ключе ничего не значит — см. readKey.
 */
const KEY_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'

/** Ключ доступа, который можно продиктовать голосом. */
export function accessKey(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10))

  return `${prefix}-${[...bytes].map((b) => KEY_ALPHABET[b % KEY_ALPHABET.length]).join('')}`
}

/**
 * Ключ, как его набрал человек, — в тот вид, в каком он лежит в базе.
 *
 * Сравнивался он точно, и это закрывало кабинет там, где человек ничего не
 * перепутал: телефон поднимает первую букву в текстовом поле сам, а с бумаги
 * ключ переписывают как придётся. Ответ при этом честный — «такого ключа
 * нет», — и понять по нему, что дело в регистре, невозможно.
 *
 * Ни одного бита это не теряет: заглавных в алфавите нет вовсе, и тест это
 * сторожит. Приведение регистра там, где алфавит смешанный, было бы ослаблением
 * ключа, а здесь оно просто снимает различие, которого в ключе никогда не было.
 */
export function readKey(raw: string): string {
  return raw.trim().toLowerCase()
}

/** Виден тесту: приведение регистра допустимо ровно потому, что он таков. */
export const keyAlphabet = KEY_ALPHABET
