import { describe, expect, it } from 'vitest'
import { absolute, siteUrl } from './site'

describe('адрес продукта', () => {
  it('без переменной берёт канонический поддомен группы', () => {
    expect(siteUrl({})).toBe('https://tinyarc.korsakovgroup.com')
  })

  it('переопределяется превью-стендом', () => {
    expect(siteUrl({ BUREAU_PUBLIC_URL: 'https://bureau-preview.onrender.com' })).toBe(
      'https://bureau-preview.onrender.com',
    )
  })

  it('снимает хвостовой слэш: иначе одна страница получает два канонических адреса', () => {
    expect(siteUrl({ BUREAU_PUBLIC_URL: 'https://example.com/' })).toBe('https://example.com')
  })

  it('склеивает путь одним слэшем', () => {
    expect(absolute('/enter', {})).toBe('https://tinyarc.korsakovgroup.com/enter')
    expect(absolute('enter', {})).toBe('https://tinyarc.korsakovgroup.com/enter')
  })
})
