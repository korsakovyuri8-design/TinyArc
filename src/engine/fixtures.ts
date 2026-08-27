/**
 * Фикстуры для тестов движка. В приложении не используются.
 *
 * Специалист по умолчанию проходит все гейты под проект по умолчанию — тест
 * ломает ровно одно измерение и проверяет ровно один эффект.
 */

import type { ProjectRequirements, SpecialistProfile } from './types'

export function specialist(patch: Partial<SpecialistProfile> = {}): SpecialistProfile {
  return {
    id: patch.id ?? 'spec-1',
    displayName: 'Специалист',
    disciplines: ['architecture'],
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
    software: ['archicad'],
    languages: ['en'],
    requiredHoursPerWeek: 10,
    horizonDays: 30,
    utcOffset: 1,
    ...patch,
  }
}

/** Пул, закрывающий все дисциплины виллы на стадии разрешения. */
export function fullPool(): SpecialistProfile[] {
  const disciplines = [
    'architecture',
    'structural',
    'mep',
    'landscape',
    'interiors',
    'permitting',
    'survey',
  ] as const

  return disciplines.map((d, i) =>
    specialist({
      id: `spec-${d}`,
      displayName: `Специалист ${d}`,
      disciplines: [d],
      portfolioRating: 9 - i * 0.1,
    }),
  )
}
