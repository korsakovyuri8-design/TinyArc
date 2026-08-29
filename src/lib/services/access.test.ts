import { describe, expect, it } from 'vitest'
import { keyLines } from './access'

const project = { title: 'Дом в Нови-Саде', clientKey: 'brief-abc' }

describe('что называет письмо с напоминанием', () => {
  it('перечисляет проекты заказчика по одному', () => {
    const lines = keyLines(
      { projects: [project, { title: 'Вилла в Тивате', clientKey: 'brief-xyz' }], specialist: null },
      'ru',
    )

    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('brief-abc')
    expect(lines[1]).toContain('brief-xyz')
  })

  it('называет доску работ, когда ключ специалиста работает', () => {
    const lines = keyLines(
      { projects: [], specialist: { accessKey: 'spec-1', status: 'active' } },
      'ru',
    )

    expect(lines).toEqual(['Доска работ — ключ spec-1'])
  })

  it('называет её и приглашённому: он входит дозаполнять профиль', () => {
    const lines = keyLines(
      { projects: [], specialist: { accessKey: 'spec-2', status: 'invited' } },
      'ru',
    )

    expect(lines).toHaveLength(1)
  })

  /*
   * Ключ заявки, ещё не прошедшей разбор, существует в базе и не работает.
   * Прислать его значит отправить человека к двери, которая не откроется, и
   * дать ему повод считать, что дело в нём.
   */
  it('молчит про ключ, который ещё или уже не работает', () => {
    for (const status of ['pending', 'rejected']) {
      expect(keyLines({ projects: [], specialist: { accessKey: 'spec-3', status } }, 'ru')).toEqual(
        [],
      )
    }
  })

  it('за адресом может не числиться ничего', () => {
    expect(keyLines({ projects: [], specialist: null }, 'ru')).toEqual([])
  })

  it('говорит на языке человека', () => {
    const [line] = keyLines({ projects: [project], specialist: null }, 'en')

    expect(line).toBe('Project “Дом в Нови-Саде” — key brief-abc')
  })
})
