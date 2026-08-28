/**
 * Проверки заявки специалиста.
 *
 * Формой пользуются три разных входа: публичная заявка, дозаполнение по
 * приглашению и правка профиля в панели бюро. Проверки у них общие намеренно —
 * одинаковые данные обязаны проходить одинаковый контроль, — и потому цена
 * ошибки здесь тройная.
 */

import { describe, expect, it } from 'vitest'
import {
  applicationSchema,
  everyDisciplineCovered,
  signaturesWithinJurisdictions,
  specializationsWithinDisciplines,
} from './forms'

/** Заявка, которая проходит целиком. Тесты правят по одному полю. */
function application(patch: Record<string, unknown> = {}) {
  return {
    displayName: 'Иван Петров',
    email: 'ivan@example.com',
    portfolioUrl: 'https://example.com/ivan',
    disciplines: ['architecture'],
    specializations: ['arch_small_scale'],
    typologies: ['villa'],
    scaleBands: ['250_1000'],
    maxStoreys: 3,
    materialSystems: ['concrete'],
    climateZones: ['mediterranean'],
    jurisdictions: ['ME'],
    signsIn: ['ME'],
    software: ['revit'],
    ifcLevel: 'exchange',
    docStages: ['permit'],
    regulatoryTracks: ['light'],
    languages: ['ru'],
    workMode: 'remote',
    utcOffset: 1,
    weeklyCapacityHours: 20,
    leadTimeDays: 3,
    ...patch,
  }
}

describe('заявка специалиста', () => {
  it('полная проходит', () => {
    expect(applicationSchema.safeParse(application()).success).toBe(true)
  })

  /**
   * Найдено на правке профиля живого геодезиста из пула.
   *
   * У геодезии словаря специализаций нет по решению таксономии: подоснова есть
   * подоснова, делить её не на что. Схема при этом требовала минимум одну
   * специализацию — значит геодезист не мог ни подать заявку, ни дозаполнить
   * профиль по приглашению: отметить в форме было нечего, а ошибка требовала
   * отметить. В пуле такие были только потому, что их завёл сид напрямую.
   */
  it('геодезист проходит без специализации: у геодезии её и нет', () => {
    const surveyor = application({ disciplines: ['survey'], specializations: [] })

    expect(applicationSchema.safeParse(surveyor).success).toBe(true)
    expect(everyDisciplineCovered(applicationSchema.parse(surveyor))).toBe(true)
  })

  it('архитектор без специализации не проходит: у архитектуры она есть', () => {
    const parsed = applicationSchema.parse(
      application({ disciplines: ['architecture'], specializations: [] }),
    )

    expect(everyDisciplineCovered(parsed)).toBe(false)
  })

  it('дисциплина со словарём требует отметки, даже если рядом есть геодезия', () => {
    const parsed = applicationSchema.parse(
      application({ disciplines: ['survey', 'structural'], specializations: [] }),
    )

    // Геодезия закрыта пустым словарём, конструкции — нет.
    expect(everyDisciplineCovered(parsed)).toBe(false)
  })

  it('геодезист с конструкциями проходит, отметив только материал', () => {
    const parsed = applicationSchema.parse(
      application({
        disciplines: ['survey', 'structural'],
        specializations: ['structural_timber'],
      }),
    )

    expect(everyDisciplineCovered(parsed)).toBe(true)
    expect(specializationsWithinDisciplines(parsed)).toBe(true)
  })

  it('чужая специализация не проходит', () => {
    const parsed = applicationSchema.parse(
      application({ disciplines: ['structural'], specializations: ['landscape_garden'] }),
    )

    expect(specializationsWithinDisciplines(parsed)).toBe(false)
  })

  it('подпись только там, где работал', () => {
    const parsed = applicationSchema.parse(application({ jurisdictions: ['ME'], signsIn: ['GR'] }))

    expect(signaturesWithinJurisdictions(parsed)).toBe(false)
  })

  it('без юрисдикции заявки нет', () => {
    expect(applicationSchema.safeParse(application({ jurisdictions: [] })).success).toBe(false)
  })

  it('без дисциплины заявки нет', () => {
    expect(applicationSchema.safeParse(application({ disciplines: [] })).success).toBe(false)
  })
})
