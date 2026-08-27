/**
 * Разбор строк базы в типы движка.
 *
 * Массивы лежат в базе строками JSON: одна и та же схема должна работать и на
 * SQLite, и на Postgres. Разбор собран здесь, чтобы `as` не расползался по
 * страницам.
 */

import type { Specialist, Project } from '@/generated/prisma/client'
import type { ProjectRequirements, SpecialistProfile } from '@/engine/types'
import type {
  ClimateZone,
  Discipline,
  DocStage,
  IfcLevel,
  Jurisdiction,
  Language,
  MaterialSystem,
  RegulatoryTrack,
  ScaleBand,
  Software,
  Typology,
  WorkMode,
} from '@/engine/taxonomy'

export function parseList<T extends string>(json: string, allowed: readonly T[]): T[] {
  let parsed: unknown

  try {
    parsed = JSON.parse(json)
  } catch {
    return []
  }

  if (!Array.isArray(parsed)) return []

  // Значение, которого нет в словаре, отбрасывается молча: словарь мог
  // сократиться, а старая строка остаться. Молчание тут безопаснее падения —
  // но только на чтении, на записи значения проверяет zod.
  return parsed.filter((v): v is T => typeof v === 'string' && allowed.includes(v as T))
}

export function toList(values: readonly string[]): string {
  return JSON.stringify(values)
}

import {
  CLIMATE_ZONES,
  DISCIPLINES,
  DOC_STAGES,
  IFC_LEVELS,
  JURISDICTIONS,
  LANGUAGES,
  MATERIAL_SYSTEMS,
  REGULATORY_TRACKS,
  SCALE_BANDS,
  SOFTWARE,
} from '@/engine/taxonomy'

export function toProfile(row: Specialist): SpecialistProfile {
  return {
    id: row.id,
    displayName: row.displayName,
    disciplines: parseList<Discipline>(row.disciplinesJson, DISCIPLINES),
    typologies: parseList<Typology>(row.typologiesJson, ['villa', 'townhouse', 'multi_family', 'mixed_use']),
    scaleBands: parseList<ScaleBand>(row.scaleBandsJson, SCALE_BANDS),
    maxStoreys: row.maxStoreys,
    materialSystems: parseList<MaterialSystem>(row.materialSystemsJson, MATERIAL_SYSTEMS),
    climateZones: parseList<ClimateZone>(row.climateZonesJson, CLIMATE_ZONES),
    jurisdictions: parseList<Jurisdiction>(row.jurisdictionsJson, JURISDICTIONS),
    signsIn: parseList<Jurisdiction>(row.signsInJson, JURISDICTIONS),
    software: parseList<Software>(row.softwareJson, SOFTWARE),
    ifcLevel: (IFC_LEVELS.includes(row.ifcLevel as IfcLevel) ? row.ifcLevel : 'none') as IfcLevel,
    docStages: parseList<DocStage>(row.docStagesJson, DOC_STAGES),
    regulatoryTracks: parseList<RegulatoryTrack>(row.regulatoryTracksJson, REGULATORY_TRACKS),
    languages: parseList<Language>(row.languagesJson, LANGUAGES),
    workMode: (row.workMode === 'hybrid' ? 'hybrid' : 'remote') as WorkMode,
    utcOffset: row.utcOffset,
    weeklyCapacityHours: row.weeklyCapacityHours,
    leadTimeDays: row.leadTimeDays,
    portfolioRating: row.portfolioRating,
    delivery: {
      deliveredTickets: row.deliveredTickets,
      onTimeTickets: row.onTimeTickets,
      firstTimeRightTickets: row.firstTimeRightTickets,
      responseMinutesTotal: row.responseMinutesTotal,
      revisionRoundsTotal: row.revisionRoundsTotal,
    },
  }
}

export function toRequirements(row: Project): ProjectRequirements {
  return {
    typology: row.typology as Typology,
    storeys: row.storeys,
    areaSqm: row.areaSqm,
    jurisdiction: row.jurisdiction as Jurisdiction,
    climateZone: row.climateZone as ClimateZone,
    materialSystem: row.materialSystem as MaterialSystem,
    regulatoryTrack: row.regulatoryTrack as RegulatoryTrack,
    targetStage: row.targetStage as DocStage,
    software: parseList<Software>(row.softwareJson, SOFTWARE),
    languages: parseList<Language>(row.languagesJson, LANGUAGES),
    requiredHoursPerWeek: row.requiredHoursPerWeek,
    horizonDays: row.horizonDays,
    utcOffset: row.utcOffset,
  }
}
