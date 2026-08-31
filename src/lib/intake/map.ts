/**
 * Строка таблицы → черновик специалиста.
 *
 * Обязательны два поля: имя и адрес. Всё остальное — необязательно, и это
 * решение, а не послабление. База, собранная руками, никогда не содержит
 * двенадцати измерений таксономии; требовать их на импорте означало бы либо не
 * импортировать никого, либо заполнять их за человека. Второе хуже: отбор
 * начнёт работать по выдуманным данным, и это будет незаметно.
 *
 * Поэтому импорт заводит запись и приглашает человека дозаполнить профиль
 * самому. До этого момента он в пуле, но не в выборке: рейтинг портфолио
 * нулевой, а порог — восемь.
 */

import { clean } from '../text'
import {
  CLIMATE_ALIASES,
  DISCIPLINE_ALIASES,
  DOC_STAGE_ALIASES,
  JURISDICTION_ALIASES,
  LANGUAGE_ALIASES,
  MATERIAL_ALIASES,
  SOFTWARE_ALIASES,
  SPECIALIZATION_ALIASES,
  TYPOLOGY_ALIASES,
  matchMany,
  normalise,
} from './aliases'
import { parseCsv, type Row } from './csv'
import { DISCIPLINE_SPECIALIZATIONS, MAX_STOREYS } from '@/engine/taxonomy'
import type {
  ClimateZone,
  Discipline,
  DocStage,
  Jurisdiction,
  Language,
  MaterialSystem,
  Software,
  Specialization,
  Typology,
} from '@/engine/taxonomy'

/**
 * Как называется столбец в чужой таблице.
 *
 * Заголовки уже приведены к нижнему регистру без пробелов и дефисов
 * (см. csv.ts), поэтому здесь сравниваются слитные формы.
 */
const COLUMNS: Record<string, string[]> = {
  email: ['email', 'mail', 'почта', 'эл почта', 'элпочта', 'адрес', 'emailaddress'],
  displayName: ['name', 'имя', 'фио', 'displayname', 'fullname', 'специалист', 'контакт'],
  portfolioUrl: ['portfolio', 'портфолио', 'ссылка', 'url', 'сайт', 'site', 'behance', 'link'],
  disciplines: ['discipline', 'disciplines', 'role', 'roles', 'profession', 'дисциплина', 'дисциплины', 'роль', 'специальность', 'направление', 'профессия'],
  specializations: ['specialization', 'specializations', 'specialisation', 'specialisations', 'специализация', 'специализации'],
  jurisdictions: ['jurisdiction', 'jurisdictions', 'страна', 'страны', 'юрисдикция', 'country', 'countries', 'регион'],
  software: ['software', 'софт', 'по', 'программы', 'tools'],
  languages: ['language', 'languages', 'язык', 'языки'],
  typologies: ['typology', 'typologies', 'типология', 'типологии'],
  materialSystems: ['material', 'materials', 'материал', 'материалы'],
  climateZones: ['climate', 'климат'],
  docStages: ['stage', 'stages', 'стадия', 'стадии'],
  maxStoreys: ['storeys', 'floors', 'этажность', 'этажи', 'максэтажность'],
  utcOffset: ['utc', 'timezone', 'timezones', 'tz', 'часовойпояс', 'пояс'],
  note: ['note', 'notes', 'заметка', 'комментарий', 'комментарии', 'город', 'city'],
}

export type IntakeDraft = {
  email: string
  displayName: string
  portfolioUrl: string
  disciplines: Discipline[]
  specializations: Specialization[]
  jurisdictions: Jurisdiction[]
  software: Software[]
  languages: Language[]
  typologies: Typology[]
  materialSystems: MaterialSystem[]
  climateZones: ClimateZone[]
  docStages: DocStage[]
  maxStoreys: number | null
  utcOffset: number | null
  note: string
}

export type IntakeRow =
  | { ok: true; line: number; draft: IntakeDraft; unrecognised: string[] }
  | { ok: false; line: number; problem: string; name: string }

export type Intake = {
  rows: IntakeRow[]
  /** Какие столбцы удалось узнать: человек должен видеть, что мы прочли. */
  recognisedColumns: string[]
  /** Заголовки, которые ни на что не легли. Их содержимое не импортируется. */
  ignoredColumns: string[]
}

/** Значение поля по любому из его синонимов. */
function cell(row: Row, field: string): string {
  for (const alias of COLUMNS[field] ?? []) {
    const key = alias.replace(/\s+/g, '')
    const value = row[key]
    if (value) return value
  }

  return ''
}

/** Адрес почты: единственное поле, где ошибка стоит приглашения в никуда. */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)
}

function number(value: string): number | null {
  const match = value.match(/-?\d+/)
  if (!match) return null

  const parsed = Number(match[0])
  return Number.isFinite(parsed) ? parsed : null
}

function draftFrom(row: Row): { draft: IntakeDraft; unrecognised: string[] } {
  const unrecognised: string[] = []

  const collect = <T extends string>(field: string, aliases: Record<T, string[]>): T[] => {
    const raw = cell(row, field)
    if (!raw) return []

    const { values, unknown } = matchMany(raw, aliases)
    unrecognised.push(...unknown)
    return values
  }

  const disciplines = collect<Discipline>('disciplines', DISCIPLINE_ALIASES)
  const specializations = collect<Specialization>('specializations', SPECIALIZATION_ALIASES)

  // Специализация, не принадлежащая заявленной дисциплине, — это чужая
  // строка в таблице, а не уточнение. Она отбрасывается и попадает в отчёт:
  // «конструктор по бетону, специализация — генплан» надо увидеть глазами.
  const allowed = new Set(disciplines.flatMap((d) => DISCIPLINE_SPECIALIZATIONS[d]))
  const kept = specializations.filter((s) => disciplines.length === 0 || allowed.has(s))
  for (const dropped of specializations.filter((s) => !kept.includes(s))) {
    unrecognised.push(`${dropped} (не из заявленной дисциплины)`)
  }

  const storeys = number(cell(row, 'maxStoreys'))
  const offset = number(cell(row, 'utcOffset'))

  return {
    draft: {
      email: cell(row, 'email').toLowerCase(),
      displayName: cell(row, 'displayName'),
      portfolioUrl: cell(row, 'portfolioUrl'),
      disciplines,
      specializations: kept,
      jurisdictions: collect<Jurisdiction>('jurisdictions', JURISDICTION_ALIASES),
      software: collect<Software>('software', SOFTWARE_ALIASES),
      languages: collect<Language>('languages', LANGUAGE_ALIASES),
      typologies: collect<Typology>('typologies', TYPOLOGY_ALIASES),
      materialSystems: collect<MaterialSystem>('materialSystems', MATERIAL_ALIASES),
      climateZones: collect<ClimateZone>('climateZones', CLIMATE_ALIASES),
      docStages: collect<DocStage>('docStages', DOC_STAGE_ALIASES),
      // Этажность выше продуктовой границы не импортируется как есть: она
      // означает опыт, которого мы всё равно не используем (п.5).
      maxStoreys: storeys === null ? null : Math.min(Math.max(storeys, 1), MAX_STOREYS),
      utcOffset: offset === null ? null : Math.min(Math.max(offset, -12), 14),
      note: cell(row, 'note'),
    },
    unrecognised,
  }
}

/** Разбор всей выгрузки. Порядок строк сохраняется — по нему человек ищет. */
export function readIntake(text: string): Intake {
  // Управляющие знаки снимаются до разбора: таблицу сюда вставляют из чужого
  // файла, а нулевой байт Postgres не хранит вовсе — импорт упал бы уже на
  // записи, разобрав всё до конца.
  const rows = parseCsv(clean(text))

  if (rows.length === 0) {
    return { rows: [], recognisedColumns: [], ignoredColumns: [] }
  }

  const headers = Object.keys(rows[0]!)
  const known = new Map<string, string>()

  for (const [field, aliases] of Object.entries(COLUMNS)) {
    for (const alias of aliases) {
      const key = alias.replace(/\s+/g, '')
      if (headers.includes(key)) known.set(key, field)
    }
  }

  const seen = new Set<string>()

  const parsed: IntakeRow[] = rows.map((row, i) => {
    // Первая строка файла — заголовки, поэтому нумерация с двойки: человек
    // ищет строку в своей таблице, а не в нашем массиве.
    const line = i + 2
    const { draft, unrecognised } = draftFrom(row)

    if (!draft.displayName) return { ok: false, line, problem: 'no name', name: draft.email }
    if (!looksLikeEmail(draft.email)) {
      return { ok: false, line, problem: 'the address does not look like an email', name: draft.displayName }
    }
    if (seen.has(draft.email)) {
      return { ok: false, line, problem: 'this address already appeared above', name: draft.displayName }
    }

    seen.add(draft.email)
    return { ok: true, line, draft, unrecognised }
  })

  return {
    rows: parsed,
    recognisedColumns: [...new Set(known.values())],
    ignoredColumns: headers.filter((h) => !known.has(h)),
  }
}

/** Чего в черновике не хватает, чтобы участвовать в отборе. */
export function missingForSelection(draft: IntakeDraft): string[] {
  const gaps: string[] = []

  if (draft.disciplines.length === 0) gaps.push('дисциплина')
  if (draft.jurisdictions.length === 0) gaps.push('юрисдикция')
  if (draft.software.length === 0) gaps.push('пакет')
  if (draft.languages.length === 0) gaps.push('язык')
  if (draft.docStages.length === 0) gaps.push('стадия')
  if (!draft.portfolioUrl) gaps.push('портфолио')

  return gaps
}
