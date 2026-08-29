/**
 * Фикстуры для тестов движка. В приложении не используются.
 *
 * Специалист по умолчанию проходит все гейты под проект по умолчанию — тест
 * ломает ровно одно измерение и проверяет ровно один эффект.
 */

import { DISCIPLINES } from './taxonomy'
import type { Discipline, RequiredRole, Specialization } from './taxonomy'
import type { ProjectRequirements, SpecialistProfile } from './types'

/** Роль в удобной для теста форме. */
export function role(
  discipline: Discipline,
  specializations: Specialization[] = [],
  mode: 'any' | 'all' = 'any',
): RequiredRole {
  return { discipline, specializations, mode }
}

/** Специализации, которыми закрывается дисциплина «по умолчанию». */
const DEFAULT_SPECIALIZATIONS: Record<Discipline, Specialization[]> = {
  architecture: ['arch_small_scale', 'arch_large_scale'],
  structural: ['structural_concrete'],
  mep: ['mep_hvac', 'mep_electrical', 'mep_plumbing'],
  landscape: ['landscape_garden', 'landscape_master_planning', 'landscape_grading'],
  interiors: ['interiors_residential', 'interiors_horeca'],
  permitting: ['permit_zoning', 'permit_flood'],
  survey: [],
  cost_estimation: [],
  dfma: [],
  energy: [],
  visualization: ['viz_photoreal'],
}

export function specialist(patch: Partial<SpecialistProfile> = {}): SpecialistProfile {
  const disciplines = patch.disciplines ?? ['architecture']

  return {
    id: patch.id ?? 'spec-1',
    displayName: 'Специалист',
    disciplines,
    specializations: disciplines.flatMap((d) => DEFAULT_SPECIALIZATIONS[d]),
    typologies: ['villa'],
    scaleBands: ['250_1000'],
    maxStoreys: 5,
    materialSystems: ['concrete'],
    climateZones: ['mediterranean'],
    jurisdictions: ['ME'],
    signsIn: ['ME'],
    software: ['archicad'],
    ifcLevel: 'coordination',
    docStages: ['concept', 'permit', 'tender', 'construction'],
    regulatoryTracks: ['light'],
    languages: ['en', 'cnr'],
    workMode: 'remote',
    utcOffset: 1,
    weeklyCapacityHours: 20,
    leadTimeDays: 0,
    portfolioRating: 9,
    delivery: {
      deliveredTickets: 0,
      onTimeTickets: 0,
      firstTimeRightTickets: 0,
      responseMinutesTotal: 0,
      revisionRoundsTotal: 0,
    },
    // Подписка по умолчанию есть: тесты ниже про профессию, а не про деньги.
    // Гейт подписки проверяется отдельно и явно, в filter.test.ts.
    subscription: 'founding',
    ...patch,
  }
}

export function requirements(patch: Partial<ProjectRequirements> = {}): ProjectRequirements {
  return {
    typology: 'villa',
    storeys: 2,
    areaSqm: 400,
    jurisdiction: 'ME',
    climateZone: 'mediterranean',
    materialSystem: 'concrete',
    regulatoryTrack: 'light',
    targetStage: 'permit',
    terrain: 'flat',
    gridConnection: 'grid',
    software: ['archicad'],
    languages: ['en'],
    requiredHoursPerWeek: 10,
    horizonDays: 30,
    utcOffset: 1,
    ...patch,
  }
}

/** Пул, закрывающий все роли виллы на стадии разрешения. */
export function fullPool(): SpecialistProfile[] {
  // Список берётся из таксономии, а не переписывается здесь: перечисленный
  // руками пул тихо устаревает на новой дисциплине, и тест начинает проверять
  // вчерашнюю продуктовую границу вместо сегодняшней.
  const disciplines: Discipline[] = [...DISCIPLINES]

  return disciplines.map((d, i) =>
    specialist({
      id: `spec-${d}`,
      displayName: `Специалист ${d}`,
      disciplines: [d],
      portfolioRating: 9 - i * 0.1,
    }),
  )
}
