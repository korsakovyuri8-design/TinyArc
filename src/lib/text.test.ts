import { describe, expect, it } from 'vitest'
import { TEXT_MAX, TooMuchText, bounded, clean } from './text'

describe('потолок свободного текста', () => {
  it('пропускает обычный текст, сняв пробелы по краям', () => {
    expect(bounded('  два слова  ', TEXT_MAX.note)).toBe('два слова')
  })

  it('пропускает текст ровно в потолок', () => {
    expect(bounded('a'.repeat(TEXT_MAX.note), TEXT_MAX.note)).toHaveLength(TEXT_MAX.note)
  })

  it('отказывает длиннее потолка, а не обрезает молча', () => {
    expect(() => bounded('a'.repeat(TEXT_MAX.note + 1), TEXT_MAX.note)).toThrow(TooMuchText)
  })

  /*
   * Пробелы снимаются до проверки, а не после: текст, который помещается
   * после снятия, отвергать не за что — человек его таким и написал.
   */
  it('не считает пробелы по краям', () => {
    const text = `   ${'a'.repeat(TEXT_MAX.title)}   `
    expect(bounded(text, TEXT_MAX.title)).toHaveLength(TEXT_MAX.title)
  })

  it('говорит человеку число, а не «слишком длинно»', () => {
    try {
      bounded('a'.repeat(TEXT_MAX.line + 1), TEXT_MAX.line)
      throw new Error('не отказал')
    } catch (error) {
      expect((error as Error).message).toContain(String(TEXT_MAX.line))
    }
  })

  /*
   * Потолки не должны разъезжаться в разные стороны от смысла поля: строка
   * короче абзаца, абзац короче постановки задачи.
   */
  it('идёт по возрастанию от строки к постановке задачи', () => {
    expect(TEXT_MAX.title).toBeLessThan(TEXT_MAX.line)
    expect(TEXT_MAX.line).toBeLessThan(TEXT_MAX.note)
    expect(TEXT_MAX.note).toBeLessThan(TEXT_MAX.spec)
  })
})

/**
 * Управляющие знаки.
 *
 * Нулевой байт Postgres не хранит вовсе — запись с ним отвечает ошибкой
 * кодировки, а не тихо теряет символ. На SQLite она проходит, поэтому
 * расхождение видно только в бою. Найдено прогоном по живому Postgres: поиск
 * в журнале писем по адресу с `%00` отдавал пятисотку.
 */
describe('управляющие знаки', () => {
  it('нулевой байт снимается', () => {
    expect(clean('до\u0000после')).toBe('допосле')
  })

  it('снимается и в тексте, который пишут в базу', () => {
    expect(bounded('  комментарий\u0000  ', TEXT_MAX.note)).toBe('комментарий')
  })

  /*
   * Переводы строк и табуляция остаются: их человек набирает намеренно, и
   * снять их значит склеить абзацы постановки задачи в одну строку.
   */
  it('перевод строки и табуляция остаются', () => {
    expect(clean('первая\nвторая\tтретья')).toBe('первая\nвторая\tтретья')
    expect(clean('строка\r\nследующая')).toBe('строка\r\nследующая')
  })

  it('обычный текст не трогается', () => {
    expect(clean('Villa in Tivat — 420 м², уклон')).toBe('Villa in Tivat — 420 м², уклон')
  })

  /*
   * Длина считается после снятия: строка из одних управляющих знаков — это
   * пустая строка, а не текст в потолок длиной.
   */
  it('потолок считается по тому, что останется', () => {
    const noise = '\u0000'.repeat(TEXT_MAX.title * 2)

    expect(bounded(`${noise}имя`, TEXT_MAX.title)).toBe('имя')
  })
})
