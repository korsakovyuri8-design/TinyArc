/**
 * Отбор строк в списке пула панели бюро.
 *
 * Это не логика подбора: движок ищет, кто годится на проект, а здесь оператор
 * ищет человека, о котором уже думает. Поэтому фильтр живёт в `lib`, а не в
 * `engine`, и ни одно его правило в формулу не заходит.
 *
 * Предикат вынесен из страницы, потому что у него есть углы, которые видно
 * только тестом: пустой запрос не должен вычёркивать никого, а поиск по
 * подстроке — находить человека, чьё имя оператор помнит с ошибкой в регистре.
 */

import type { Discipline, Jurisdiction } from '@/engine/taxonomy'

export type PoolCriteria = {
  /** Подстрока имени или адреса. Пустая строка — не фильтр, а его отсутствие. */
  query: string
  discipline: Discipline | ''
  jurisdiction: Jurisdiction | ''
  status: string
}

export type PoolRow = {
  displayName: string
  email: string
  status: string
  disciplines: readonly string[]
  jurisdictions: readonly string[]
}

export const EMPTY_CRITERIA: PoolCriteria = {
  query: '',
  discipline: '',
  jurisdiction: '',
  status: '',
}

/** Заданы ли хоть какие-то условия: по этому решается, показывать ли сброс. */
export function isNarrowed(criteria: PoolCriteria): boolean {
  return Boolean(criteria.query || criteria.discipline || criteria.jurisdiction || criteria.status)
}

/**
 * Разбор строки запроса. Значения, которых нет в словаре, отбрасываются
 * молча — из адресной строки может прийти что угодно, и падать на этом
 * значило бы отдавать оператору ошибку вместо списка.
 */
export function readCriteria(
  params: Record<string, string | string[] | undefined>,
  allowed: { disciplines: readonly string[]; jurisdictions: readonly string[]; statuses: readonly string[] },
): PoolCriteria {
  const one = (key: string): string => {
    const value = params[key]
    return (Array.isArray(value) ? value[0] : value)?.trim() ?? ''
  }

  const pick = (key: string, list: readonly string[]): string => {
    const value = one(key)
    return list.includes(value) ? value : ''
  }

  return {
    query: one('q'),
    discipline: pick('discipline', allowed.disciplines) as Discipline | '',
    jurisdiction: pick('country', allowed.jurisdictions) as Jurisdiction | '',
    status: pick('status', allowed.statuses),
  }
}

/** Годится ли строка под условия. Пустое условие пропускает всех. */
export function matches(row: PoolRow, criteria: PoolCriteria): boolean {
  if (criteria.status && row.status !== criteria.status) return false
  if (criteria.discipline && !row.disciplines.includes(criteria.discipline)) return false
  if (criteria.jurisdiction && !row.jurisdictions.includes(criteria.jurisdiction)) return false

  if (criteria.query) {
    // Адрес ищется наравне с именем: оператор приходит сюда из письма чаще,
    // чем из памяти. Регистр не учитывается — имя пишут как придётся.
    const needle = criteria.query.toLowerCase()
    const haystack = `${row.displayName} ${row.email}`.toLowerCase()
    if (!haystack.includes(needle)) return false
  }

  return true
}
