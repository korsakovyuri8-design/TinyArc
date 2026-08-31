/**
 * Формат копии.
 *
 * Проверяется то, что ломается молча. Забытая в списке таблица не роняет
 * выгрузку — файл просто выходит без неё, и обнаруживается это при
 * восстановлении, то есть в худший день года. Дата, оставшаяся строкой,
 * ложится в базу строкой и всплывает через месяц на сортировке.
 */

import { describe, expect, it } from 'vitest'
import { SKIPPED, TABLES, dateFields, decode, encode, modelsIn, revive, schemaText } from './backup'

const schema = schemaText()

describe('копия знает все таблицы', () => {
  /*
   * Главная проверка этого файла. Новая модель в схеме появляется не ради
   * красоты — в ней лежат чьи-то данные, — и попасть в копию она обязана в тот
   * же день. Пропуск не виден ничем: выгрузка проходит, файл получается,
   * восстановление отрабатывает.
   */
  it('в списке или в исключениях названа каждая модель схемы', () => {
    const covered = new Set<string>([...TABLES, ...Object.keys(SKIPPED)])

    for (const model of modelsIn(schema)) {
      expect(covered.has(model), `модель ${model} не попадает в копию и не названа исключением`).toBe(true)
    }
  })

  it('в списке нет того, чего нет в схеме', () => {
    const models = new Set(modelsIn(schema))

    for (const table of TABLES) {
      expect(models.has(table), `таблицы ${table} в схеме больше нет`).toBe(true)
    }
  })

  it('у каждого исключения названа причина', () => {
    for (const [table, why] of Object.entries(SKIPPED)) {
      expect(why.length, table).toBeGreaterThan(20)
    }
  })

  /*
   * Порядок нужен восстановлению: строка со ссылкой на несуществующую запись
   * не запишется. Проверяются пары, про которые это известно наверняка.
   */
  it('те, на кого ссылаются, идут раньше', () => {
    const at = (table: string) => TABLES.indexOf(table as never)

    expect(at('Specialist')).toBeLessThan(at('TeamSlot'))
    expect(at('Project')).toBeLessThan(at('Ticket'))
    expect(at('MatchRun')).toBeLessThan(at('Candidate'))
    expect(at('Ticket')).toBeLessThan(at('TicketDependency'))
    expect(at('Ticket')).toBeLessThan(at('TicketComment'))
    expect(at('Ticket')).toBeLessThan(at('Artifact'))
    expect(at('Project')).toBeLessThan(at('Invoice'))
  })
})

describe('даты остаются датами', () => {
  const dates = dateFields(schema)

  it('находит поля дат по схеме', () => {
    expect(dates.get('Ticket')?.has('dueAt')).toBe(true)
    expect(dates.get('Ticket')?.has('acceptedAt')).toBe(true)
    expect(dates.get('Notification')?.has('sentAt')).toBe(true)
  })

  it('не считает датой обычное поле', () => {
    expect(dates.get('Ticket')?.has('title')).toBe(false)
    expect(dates.get('Ticket')?.has('spec')).toBe(false)
  })

  it('возвращает дате тип', () => {
    const row = revive({ sentAt: '2026-03-10T12:00:00.000Z' }, new Set(['sentAt']))

    expect(row.sentAt).toBeInstanceOf(Date)
    expect((row.sentAt as Date).toISOString()).toBe('2026-03-10T12:00:00.000Z')
  })

  /*
   * И обратное. Человек, написавший дату в комментарии, не должен получить
   * дату вместо своего текста: угадывание по виду строки здесь запрещено.
   */
  it('текст, похожий на дату, остаётся текстом', () => {
    const row = revive({ body: '2026-03-10T12:00:00.000Z' }, new Set(['sentAt']))

    expect(typeof row.body).toBe('string')
  })
})

describe('строки файла', () => {
  it('переживают запись и чтение', () => {
    const line = { table: 'Ticket' as const, row: { id: 'x', title: 'Планы' } }

    expect(decode(encode(line))).toEqual(line)
  })

  it('в строке нет переводов строки: файл читается построчно', () => {
    const line = encode({ table: 'Ticket' as const, row: { id: 'x', spec: 'первая\nвторая' } })

    expect(line.includes('\n')).toBe(false)
  })
})
