/**
 * Строка таблицы → правило нормы.
 *
 * Разбор нарочно строгий, и это главное отличие от импорта базы специалистов.
 * Там столбцы угадываются по синонимам, а недостающее заполняется человеком
 * позже: запись без таксономии просто не попадает в выборку, и цена ошибки —
 * один невызванный специалист. Здесь цена ошибки другая. Норма, разобранная
 * не из того столбца, уезжает в комплект под нашей подписью и всплывает
 * отказом органа через полгода.
 *
 * Поэтому: имена столбцов ровно те, что названы ниже; словари закрыты;
 * первоисточник обязателен целиком — документ, статья, дата вступления, дата
 * сверки. Строка, в которой чего-то нет, не берётся и называет, чего именно.
 */

import { RULE_LAYERS, RULE_SUBJECTS, type RuleLayer, type RuleSubject } from '@/engine/compliance'
import { JURISDICTIONS, type Jurisdiction } from '@/engine/taxonomy'
import { parseCsv } from '../intake/csv'
import { clean } from '../text'

export type RuleDraft = {
  layer: RuleLayer
  jurisdiction: Jurisdiction
  municipality: string
  zone: string
  subject: RuleSubject
  operator: 'max' | 'min'
  value: number
  document: string
  article: string
  effectiveFrom: Date
  checkedAt: Date
  url: string
}

export type ParsedRow = { ok: true; draft: RuleDraft } | { ok: false; line: number; reason: string }

/**
 * Строка шапки для образца: её же ждёт разбор.
 *
 * Через подчёркивание, а не слитно. Разбор приводит имена столбцов, снимая
 * подчёркивания и дефисы, поэтому `effective_from` и `effectiveFrom` для него
 * одно и то же — а на экране слипшиеся слова читаются как опечатка и ловятся
 * проверкой языка, которая ищет ровно её.
 */
export const HEADER =
  'layer,jurisdiction,municipality,zone,subject,operator,value,document,article,effective_from,checked_at,url'

/**
 * Дата в ISO и только в ISO.
 *
 * `Date.parse` понимает и «03/04/2026», но понимает по-разному в зависимости
 * от того, чей это формат: третье апреля и четвёртое марта — два разных дня,
 * и на дате вступления нормы в силу разница между ними бывает решающей.
 */
function isoDate(raw: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null

  const parsed = new Date(`${raw}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/**
 * Число нормы.
 *
 * Запятая как десятичный разделитель принимается: европейские документы пишут
 * «10,5», и требовать точку значило бы требовать переписывания первоисточника
 * руками — то есть заводить ещё одно место, где значение меняется по дороге.
 */
function ruleValue(raw: string): number | null {
  const normalised = raw.replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(normalised)) return null

  const value = Number(normalised)
  return Number.isFinite(value) ? value : null
}

function readRow(row: Record<string, string>, line: number): ParsedRow {
  const at = (name: string) => clean(row[name] ?? '').trim()
  const fail = (reason: string): ParsedRow => ({ ok: false, line, reason })

  const layer = at('layer').toLowerCase()
  if (!RULE_LAYERS.includes(layer as RuleLayer)) {
    return fail(`layer “${layer || '—'}” is not one of ${RULE_LAYERS.join(', ')}`)
  }

  const jurisdiction = at('jurisdiction').toUpperCase()
  if (!JURISDICTIONS.includes(jurisdiction as Jurisdiction)) {
    return fail(`jurisdiction “${jurisdiction || '—'}” is not one of ${JURISDICTIONS.join(', ')}`)
  }

  const subject = at('subject').toLowerCase()
  if (!RULE_SUBJECTS.includes(subject as RuleSubject)) {
    return fail(`subject “${subject || '—'}” is not one the engine can check`)
  }

  const operator = at('operator').toLowerCase()
  if (operator !== 'max' && operator !== 'min') {
    return fail(`operator “${operator || '—'}” is neither max nor min`)
  }

  const value = ruleValue(at('value'))
  if (value === null) return fail(`value “${at('value') || '—'}” is not a number`)

  const document = at('document')
  if (!document) return fail('document is empty: a rule with no source cannot be defended')

  const article = at('article')
  if (!article) return fail('article is empty: “somewhere in the law” is not a citation')

  const effectiveFrom = isoDate(at('effectivefrom'))
  if (!effectiveFrom) return fail(`effectiveFrom “${at('effectivefrom') || '—'}” is not YYYY-MM-DD`)

  const checkedAt = isoDate(at('checkedat'))
  if (!checkedAt) return fail(`checkedAt “${at('checkedat') || '—'}” is not YYYY-MM-DD`)

  /*
   * Зонирование без муниципалитета — самая дорогая из возможных ошибок здесь.
   * Странового отступа не существует: он живёт в местном плане, и записанный
   * на уровне страны молча применится в каждом городе, где план говорит другое.
   */
  const municipality = at('municipality')
  if (layer === 'zoning' && !municipality) {
    return fail('a zoning rule needs a municipality: zoning does not exist at country level')
  }

  return {
    ok: true,
    draft: {
      layer: layer as RuleLayer,
      jurisdiction: jurisdiction as Jurisdiction,
      municipality,
      zone: at('zone'),
      subject: subject as RuleSubject,
      operator,
      value,
      document,
      article,
      effectiveFrom,
      checkedAt,
      url: at('url'),
    },
  }
}

export type ParseResult = {
  drafts: RuleDraft[]
  rejected: { line: number; reason: string }[]
}

/** Сколько строк берётся за раз. Корпус набирают частями, а не одним куском. */
export const MAX_RULE_ROWS = 500

export function parseRules(text: string): ParseResult {
  const rows = parseCsv(text).slice(0, MAX_RULE_ROWS)

  const drafts: RuleDraft[] = []
  const rejected: { line: number; reason: string }[] = []

  rows.forEach((row, index) => {
    // Со второй: первая строка таблицы — шапка.
    const parsed = readRow(row, index + 2)
    if (parsed.ok) drafts.push(parsed.draft)
    else rejected.push({ line: parsed.line, reason: parsed.reason })
  })

  return { drafts, rejected }
}
