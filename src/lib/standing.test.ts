import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { STANDING_TONES, standingClass, standingOf } from './standing'

describe('положение проекта', () => {
  it('без прогона черновик — это принятый бриф, и это спокойная новость', () => {
    expect(standingOf('draft', null)).toEqual({ label: 'Brief accepted', tone: 'accent' })
  })

  /*
   * Ради этого случая функция и написана. Заказчик, чей проект укомплектовать
   * не удалось, читал вверху «бриф принят», а тремя строками ниже — что
   * команды нет. Два сообщения и ни одного ответа.
   */
  it('черновик после несобравшегося прогона называется своим именем', () => {
    expect(standingOf('draft', 'incomplete')).toEqual({
      label: 'Team not assembled yet',
      tone: 'wait',
    })
  })

  it('некому подписать — отдельная новость, а не «состав не собрался»', () => {
    expect(standingOf('draft', 'no_signatory').label).toBe('No one to sign yet')
  })

  it('успокаивающий тон снят там, где успокаивать нечем', () => {
    expect(standingOf('draft', 'incomplete').tone).toBe('wait')
    expect(standingOf('draft', 'no_signatory').tone).toBe('wait')
    expect(standingOf('draft', null).tone).toBe('accent')
  })

  it('отказ читается отказом при любом статусе', () => {
    expect(standingOf('rejected', null).tone).toBe('fail')
    expect(standingOf('draft', 'rejected').tone).toBe('fail')
  })

  it('остальные состояния берутся из статуса', () => {
    expect(standingOf('assembled', 'ok').label).toBe('Team assembled')
    expect(standingOf('delivering', 'ok').label).toBe('In production')
    expect(standingOf('delivered', 'ok').label).toBe('Closed')
  })

  it('незнакомый статус показывается как есть, а не пустотой', () => {
    expect(standingOf('something_new', null).label).toBe('something_new')
  })

  /*
   * Тон превращается в класс здесь и больше нигде. Если имя тона разъедется с
   * именем класса, метка потеряет цвет и останется серой на экране, где цвет и
   * есть сообщение, — а это ничего не ломает и потому не замечается.
   */
  it('каждый тон даёт класс, который и правда объявлен в оформлении', () => {
    const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')

    for (const tone of STANDING_TONES) {
      expect(standingClass({ label: 'x', tone })).toBe(`tag tag-${tone}`)
      expect(css).toContain(`.tag-${tone}`)
    }
  })

  it('положение всегда получает тон из закрытого списка', () => {
    const cases = [
      ['draft', null],
      ['draft', 'ok'],
      ['draft', 'incomplete'],
      ['draft', 'no_signatory'],
      ['draft', 'rejected'],
      ['assembled', 'ok'],
      ['delivering', 'ok'],
      ['delivered', 'ok'],
      ['rejected', null],
      ['something_new', null],
    ] as const

    for (const [status, outcome] of cases) {
      expect(STANDING_TONES).toContain(standingOf(status, outcome).tone)
    }
  })
})
