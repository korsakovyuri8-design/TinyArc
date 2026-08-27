import { describe, expect, it } from 'vitest'
import { massingDataUri, massingSvg } from './massing'

describe('схема объёма', () => {
  it('на один ключ даёт одну и ту же схему', () => {
    expect(massingSvg('terraced', 'Террасирование')).toBe(
      massingSvg('terraced', 'Террасирование'),
    )
  })

  it('разным направлениям рисует разное', () => {
    expect(massingSvg('terraced', 'A')).not.toBe(massingSvg('courtyard', 'A'))
    expect(massingSvg('pavilions', 'A')).not.toBe(massingSvg('compact', 'A'))
  })

  it('всегда подписана как схема, а не как визуализация', () => {
    for (const key of ['terraced', 'embedded', 'stilts', 'courtyard', 'compact', 'нет-такого']) {
      expect(massingSvg(key, 'Проверка')).toContain('НЕ ВИЗУАЛИЗАЦИЯ')
    }
  })

  it('не падает на неизвестном ключе', () => {
    expect(massingSvg('нет-такого', 'Проверка')).toContain('<svg')
  })

  it('экранирует подпись, а не подставляет её в разметку', () => {
    const svg = massingSvg('compact', '<script>alert(1)</script>')

    expect(svg).not.toContain('<script>')
    expect(svg).toContain('&lt;SCRIPT&gt;')
  })

  it('отдаётся как data-URI, пригодный для src', () => {
    const uri = massingDataUri('compact', 'Компактный объём')

    expect(uri.startsWith('data:image/svg+xml;base64,')).toBe(true)
    expect(Buffer.from(uri.split(',')[1], 'base64').toString('utf8')).toContain('<svg')
  })
})
