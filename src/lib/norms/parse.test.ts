import { describe, expect, it } from 'vitest'
import { HEADER, parseRules } from './parse'

const row = (parts: Partial<Record<string, string>> = {}, delimiter = ',') => {
  const base: Record<string, string> = {
    layer: 'zoning',
    jurisdiction: 'ME',
    municipality: 'Tivat',
    zone: '',
    subject: 'height_m',
    operator: 'max',
    value: '10.5',
    document: 'Prostorno-urbanistički plan',
    article: 'čl. 42',
    effective_from: '2024-01-01',
    checked_at: '2026-09-01',
    url: 'https://example.org/plan',
  }

  const merged = { ...base, ...parts }
  const order = HEADER.split(',')
  const header = order.join(delimiter)
  return `${header}\n${order.map((k) => merged[k] ?? '').join(delimiter)}`
}

describe('разбор корпуса норм', () => {
  it('полная строка становится правилом', () => {
    const { drafts, rejected } = parseRules(row())

    expect(rejected).toEqual([])
    expect(drafts).toHaveLength(1)
    expect(drafts[0]?.value).toBe(10.5)
    expect(drafts[0]?.municipality).toBe('Tivat')
    expect(drafts[0]?.effectiveFrom.toISOString().slice(0, 10)).toBe('2024-01-01')
  })

  /*
   * Ради этого разбор и строгий. Норма без первоисточника нечем защитить перед
   * органом и нечем перепроверить, когда она изменится, — а она изменится.
   */
  it('строка без документа не берётся, и сказано почему', () => {
    const { drafts, rejected } = parseRules(row({ document: '' }))

    expect(drafts).toEqual([])
    expect(rejected[0]?.reason).toContain('document')
  })

  it('строка без статьи не берётся: «где-то в законе» — не ссылка', () => {
    expect(parseRules(row({ article: '' })).rejected[0]?.reason).toContain('article')
  })

  /*
   * Странового отступа не существует. Записанный на уровне страны, он молча
   * применится в каждом городе, где местный план говорит другое.
   */
  it('зонирование без муниципалитета не берётся', () => {
    const { rejected } = parseRules(row({ municipality: '' }))
    expect(rejected[0]?.reason).toContain('municipality')
  })

  it('инженерный слой без муниципалитета берётся: он обобщается', () => {
    const { drafts } = parseRules(row({ layer: 'energy', municipality: '' }))
    expect(drafts).toHaveLength(1)
  })

  /*
   * Третье апреля и четвёртое марта — два разных дня, а «03/04/2026» читается
   * и так, и так в зависимости от того, чей это формат.
   */
  it('дата принимается только в ISO', () => {
    expect(parseRules(row({ effective_from: '03/04/2026' })).rejected[0]?.reason).toContain(
      'effectiveFrom',
    )
    expect(parseRules(row({ checked_at: '1 сентября 2026' })).rejected[0]?.reason).toContain(
      'checkedAt',
    )
  })

  /*
   * Excel в европейской локали сохраняет с точкой с запятой и пишет «10,5».
   * Через запятую как разделитель такое число не проходит вовсе — оно
   * распадается на два поля, — поэтому проверяется именно тот вид, в котором
   * оно и приходит.
   */
  it('европейская запятая в числе принимается', () => {
    expect(parseRules(row({ value: '10,5' }, ';')).drafts[0]?.value).toBe(10.5)
  })

  it('нечисловое значение не берётся', () => {
    expect(parseRules(row({ value: 'about ten' })).rejected[0]?.reason).toContain('value')
  })

  it('чужой предмет не берётся: проверять его движку нечем', () => {
    expect(parseRules(row({ subject: 'balcony_depth' })).rejected[0]?.reason).toContain('subject')
  })

  it('чужая страна не берётся', () => {
    expect(parseRules(row({ jurisdiction: 'FR' })).rejected[0]?.reason).toContain('jurisdiction')
  })

  it('оператор только max или min', () => {
    expect(parseRules(row({ operator: 'не больше' })).rejected[0]?.reason).toContain('operator')
  })

  it('номер строки называется по таблице, а не по массиву', () => {
    const two = `${HEADER}\n${'zoning,ME,Tivat,,height_m,max,10,Doc,42,2024-01-01,2026-09-01,'}\n${'zoning,ME,,,height_m,max,10,Doc,42,2024-01-01,2026-09-01,'}`
    expect(parseRules(two).rejected[0]?.line).toBe(3)
  })

  it('пустой текст не падает и ничего не заводит', () => {
    expect(parseRules('')).toEqual({ drafts: [], rejected: [] })
    expect(parseRules(HEADER)).toEqual({ drafts: [], rejected: [] })
  })
})
