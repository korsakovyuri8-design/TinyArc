import { describe, expect, it } from 'vitest'
import { packagesOf, pickReplacement } from './replacement'
import { requirements, specialist } from './fixtures'
import type { SpecialistProfile } from './types'
import type { RequiredRole } from './taxonomy'

const ROLE: RequiredRole = {
  discipline: 'architecture',
  specializations: ['arch_small_scale'],
  mode: 'any',
}

function profiles(...people: SpecialistProfile[]): Map<string, SpecialistProfile> {
  return new Map(people.map((p) => [p.id, p]))
}

function arch(id: string, patch: Partial<SpecialistProfile> = {}): SpecialistProfile {
  return specialist({
    id,
    disciplines: ['architecture'],
    specializations: ['arch_small_scale'],
    software: ['archicad'],
    ...patch,
  })
}

describe('замена выбывшего', () => {
  it('берёт следующего по рангу', () => {
    const result = pickReplacement({
      ranked: [
        { specialistId: 'ушёл', rank: 1 },
        { specialistId: 'второй', rank: 2 },
        { specialistId: 'третий', rank: 3 },
      ],
      taken: ['ушёл'],
      leaving: 'ушёл',
      profiles: profiles(arch('второй'), arch('третий')),
      requirements: requirements(),
      role: ROLE,
      teamPackages: ['archicad'],
    })

    expect(result).toEqual({ found: true, specialistId: 'второй', rank: 2 })
  })

  it('не предлагает того, кто уже в команде на другой роли', () => {
    const result = pickReplacement({
      ranked: [
        { specialistId: 'занят', rank: 1 },
        { specialistId: 'свободен', rank: 5 },
      ],
      taken: ['ушёл', 'занят'],
      leaving: 'ушёл',
      profiles: profiles(arch('занят'), arch('свободен')),
      requirements: requirements(),
      role: ROLE,
      teamPackages: ['archicad'],
    })

    expect(result).toMatchObject({ found: true, specialistId: 'свободен' })
  })

  /**
   * Ранг — память о прошлом решении, гейты — факт о сегодня. Прогон мог быть
   * месяц назад, и у первого по рангу с тех пор кончилась ёмкость.
   */
  it('пропускает того, кто перестал проходить гейты после прогона', () => {
    const result = pickReplacement({
      ranked: [
        { specialistId: 'занятой', rank: 2 },
        { specialistId: 'свободный', rank: 4 },
      ],
      taken: [],
      leaving: 'ушёл',
      profiles: profiles(
        arch('занятой', { weeklyCapacityHours: 0 }),
        arch('свободный'),
      ),
      requirements: requirements(),
      role: ROLE,
      teamPackages: ['archicad'],
    })

    expect(result).toMatchObject({ found: true, specialistId: 'свободный' })
  })

  it('не берёт того, кто работает в другом пакете, чем остальная команда', () => {
    const result = pickReplacement({
      ranked: [{ specialistId: 'ревит', rank: 2 }],
      taken: [],
      leaving: 'ушёл',
      profiles: profiles(arch('ревит', { software: ['revit'] })),
      requirements: requirements(),
      role: ROLE,
      teamPackages: ['archicad'],
    })

    expect(result).toEqual({ found: false, reason: 'none_passes' })
  })

  it('различает «никого не было» и «никто не проходит»', () => {
    const empty = pickReplacement({
      ranked: [{ specialistId: 'ушёл', rank: 1 }],
      taken: [],
      leaving: 'ушёл',
      profiles: profiles(),
      requirements: requirements(),
      role: ROLE,
      teamPackages: [],
    })

    expect(empty).toEqual({ found: false, reason: 'no_candidates' })

    const blocked = pickReplacement({
      ranked: [{ specialistId: 'занятой', rank: 2 }],
      taken: [],
      leaving: 'ушёл',
      profiles: profiles(arch('занятой', { weeklyCapacityHours: 0 })),
      requirements: requirements(),
      role: ROLE,
      teamPackages: [],
    })

    expect(blocked).toEqual({ found: false, reason: 'none_passes' })
  })
})

describe('общий пакет остающейся команды', () => {
  it('пересекает наборы оставшихся', () => {
    const common = packagesOf([
      arch('a', { software: ['archicad', 'autocad'] }),
      arch('b', { software: ['archicad', 'revit'] }),
    ])

    expect(common).toEqual(['archicad'])
  })

  it('на пустой команде не ограничивает никого', () => {
    expect(packagesOf([])).toEqual([])
  })

  /**
   * Считается по остающимся, а не по прежнему составу: набор, суженный
   * ушедшим, мог быть уже нужного, и замену искали бы под ограничение,
   * которого больше нет.
   */
  it('не помнит ограничения выбывшего', () => {
    const remaining = [arch('a', { software: ['archicad', 'revit'] })]

    expect(packagesOf(remaining)).toEqual(['archicad', 'revit'])
  })
})
