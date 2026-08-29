import { describe, expect, it } from 'vitest'
import {
  DISCIPLINE_SPECIALIZATIONS,
  MAX_STOREYS,
  PORTFOLIO_THRESHOLD,
  SPECIALIZATIONS,
  coversRole,
  requiredRoles,
  scaleBandFor,
  stagesUpTo,
  type ProjectShape,
} from './taxonomy'

const shape = (patch: Partial<ProjectShape> = {}): ProjectShape => ({
  typology: 'villa',
  targetStage: 'permit',
  materialSystem: 'concrete',
  terrain: 'flat',
  gridConnection: 'grid',
  ...patch,
})

describe('таксономия', () => {
  it('относит площадь к диапазону по верхней границе', () => {
    expect(scaleBandFor(120)).toBe('upto_250')
    expect(scaleBandFor(250)).toBe('250_1000')
    expect(scaleBandFor(999)).toBe('250_1000')
    expect(scaleBandFor(3000)).toBe('3000_plus')
  })

  it('идёт по стадиям, а не прыгает в целевую', () => {
    expect(stagesUpTo('concept')).toEqual(['concept'])
    expect(stagesUpTo('permit')).toEqual(['concept', 'permit'])
    expect(stagesUpTo('construction')).toEqual(['concept', 'permit', 'tender', 'construction'])
  })

  it('держит зафиксированные концептом пороги', () => {
    expect(PORTFOLIO_THRESHOLD).toBe(8)
    expect(MAX_STOREYS).toBe(5)
  })

  it('не заводит специализаций вне словаря дисциплины', () => {
    for (const list of Object.values(DISCIPLINE_SPECIALIZATIONS)) {
      for (const specialization of list) {
        expect(SPECIALIZATIONS).toContain(specialization)
      }
    }
  })
})

describe('сценарная матрица ролей', () => {
  it('зовёт конструктора под материал проекта, а не любого', () => {
    const timber = requiredRoles(shape({ materialSystem: 'timber' }))
      .find((r) => r.discipline === 'structural')!
    const concrete = requiredRoles(shape({ materialSystem: 'concrete' }))
      .find((r) => r.discipline === 'structural')!

    expect(timber.specializations).toEqual(['structural_timber'])
    expect(concrete.specializations).toEqual(['structural_concrete'])
  })

  it('на гибридной системе открывает всех троих конструкторов', () => {
    const role = requiredRoles(shape({ materialSystem: 'hybrid' }))
      .find((r) => r.discipline === 'structural')!

    expect(role.mode).toBe('any')
    expect(role.specializations).toHaveLength(3)
  })

  it('различает архитектора малых форм и городской застройки', () => {
    const villa = requiredRoles(shape({ typology: 'villa' })).find((r) => r.discipline === 'architecture')!
    const mixed = requiredRoles(shape({ typology: 'mixed_use' })).find((r) => r.discipline === 'architecture')!

    expect(villa.specializations).toEqual(['arch_small_scale'])
    expect(mixed.specializations).toEqual(['arch_large_scale'])
  })

  it('требует от MEP все три системы разом, а не одну на выбор', () => {
    const role = requiredRoles(shape()).find((r) => r.discipline === 'mep')!

    expect(role.mode).toBe('all')
    expect(role.specializations).toEqual(['mep_hvac', 'mep_electrical', 'mep_plumbing'])
  })

  it('добавляет автономку, когда сетей нет', () => {
    const role = requiredRoles(shape({ gridConnection: 'off_grid' })).find((r) => r.discipline === 'mep')!
    expect(role.specializations).toContain('mep_off_grid')
  })

  it('на склоне требует вертикальную планировку, и это не пожелание', () => {
    const flat = requiredRoles(shape({ terrain: 'flat' }))
    const slope = requiredRoles(shape({ terrain: 'slope' }))

    // На ровном участке вилле ландшафт не нужен вовсе.
    expect(flat.some((r) => r.discipline === 'landscape')).toBe(false)

    const landscape = slope.find((r) => r.discipline === 'landscape')!
    expect(landscape.mode).toBe('all')
    expect(landscape.specializations).toContain('landscape_grading')
  })

  it('на подтопляемом участке требует согласования по риску', () => {
    const role = requiredRoles(shape({ terrain: 'flood_prone' })).find((r) => r.discipline === 'permitting')!

    expect(role.mode).toBe('all')
    expect(role.specializations).toEqual(['permit_zoning', 'permit_flood'])
  })

  it('даёт mixed-use генплан и интерьеры, вилле — нет', () => {
    const mixed = requiredRoles(shape({ typology: 'mixed_use' }))
    const villa = requiredRoles(shape({ typology: 'villa' }))

    expect(mixed.find((r) => r.discipline === 'landscape')?.specializations).toContain(
      'landscape_master_planning',
    )
    expect(mixed.some((r) => r.discipline === 'interiors')).toBe(true)
    expect(villa.some((r) => r.discipline === 'interiors')).toBe(false)
  })

  it('добавляет геодезию и согласования только со стадии разрешения', () => {
    const concept = requiredRoles(shape({ targetStage: 'concept' })).map((r) => r.discipline)
    const permit = requiredRoles(shape({ targetStage: 'permit' })).map((r) => r.discipline)

    expect(concept).not.toContain('permitting')
    expect(concept).not.toContain('survey')
    expect(permit).toContain('permitting')
    expect(permit).toContain('survey')
    // Концепция — стадия продажи, без подачи её нечем утверждать.
    expect(concept).toContain('visualization')
  })
})

describe('покрытие роли специализацией', () => {
  it('режим any требует одну из списка', () => {
    const role = { discipline: 'structural' as const, specializations: ['structural_concrete' as const], mode: 'any' as const }

    expect(coversRole(['structural_concrete'], role)).toBe(true)
    expect(coversRole(['structural_timber'], role)).toBe(false)
  })

  it('режим all требует все', () => {
    const role = {
      discipline: 'mep' as const,
      specializations: ['mep_hvac' as const, 'mep_electrical' as const, 'mep_plumbing' as const],
      mode: 'all' as const,
    }

    expect(coversRole(['mep_hvac', 'mep_electrical', 'mep_plumbing'], role)).toBe(true)
    expect(coversRole(['mep_hvac', 'mep_electrical'], role)).toBe(false)
  })

  it('роль без требований закрывается любой специализацией', () => {
    const role = { discipline: 'survey' as const, specializations: [], mode: 'any' as const }
    expect(coversRole([], role)).toBe(true)
  })
})

/*
 * Три поздние роли. Тест сторожит не наличие условия, а его узость: роль,
 * которая требуется всегда, делает несобираемым каждый проект без такого
 * человека в пуле, и это происходит тихо.
 */
describe('поздние роли', () => {
  const has = (s: ProjectShape, d: string) => requiredRoles(s).some((r) => r.discipline === d)

  it('сметчик приходит с тендерной стадией и не раньше', () => {
    expect(has(shape({ targetStage: 'concept' }), 'cost_estimation')).toBe(false)
    expect(has(shape({ targetStage: 'permit' }), 'cost_estimation')).toBe(false)
    expect(has(shape({ targetStage: 'tender' }), 'cost_estimation')).toBe(true)
    expect(has(shape({ targetStage: 'construction' }), 'cost_estimation')).toBe(true)
  })

  it('энергетик требуется дому с общими системами, а не вилле', () => {
    expect(has(shape({ typology: 'villa' }), 'energy')).toBe(false)
    expect(has(shape({ typology: 'townhouse' }), 'energy')).toBe(false)
    expect(has(shape({ typology: 'multi_family' }), 'energy')).toBe(true)
    expect(has(shape({ typology: 'mixed_use' }), 'energy')).toBe(true)
  })

  it('энергетик не приходит на концепцию: подавать ещё нечего', () => {
    expect(has(shape({ typology: 'multi_family', targetStage: 'concept' }), 'energy')).toBe(false)
  })

  it('технолог приходит на сборные системы и только к стройке', () => {
    const timber = { materialSystem: 'timber' } as const
    expect(has(shape({ ...timber, targetStage: 'tender' }), 'dfma')).toBe(false)
    expect(has(shape({ ...timber, targetStage: 'construction' }), 'dfma')).toBe(true)
    expect(has(shape({ materialSystem: 'steel', targetStage: 'construction' }), 'dfma')).toBe(true)
    expect(has(shape({ materialSystem: 'concrete', targetStage: 'construction' }), 'dfma')).toBe(false)
    expect(has(shape({ materialSystem: 'masonry', targetStage: 'construction' }), 'dfma')).toBe(false)
  })

  it('вилла на монолите до разрешения не зовёт ни одну из трёх', () => {
    const roles = requiredRoles(shape()).map((r) => r.discipline)
    expect(roles).not.toContain('cost_estimation')
    expect(roles).not.toContain('energy')
    expect(roles).not.toContain('dfma')
  })
})
