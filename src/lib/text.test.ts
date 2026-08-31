import { describe, expect, it } from 'vitest'
import { TEXT_MAX, TooMuchText, bounded } from './text'

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
