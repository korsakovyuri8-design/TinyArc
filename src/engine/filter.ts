/**
 * Жёсткие гейты (концепт, п.8 и п.9).
 *
 * Каждый гейт здесь сжимает пул, поэтому их ровно столько, сколько нельзя не
 * иметь. Мягкие измерения таксономии сюда не попадают: они ранжируют
 * (см. relevance в score.ts), а не отсеивают.
 *
 * Порядок проверок — это порядок объяснения. Первым идёт порог по портфолио:
 * это заглавный гейт продукта, и клиенту важно видеть именно его.
 */

import {
  IFC_EXCHANGE_MINIMUM,
  IFC_RANK,
  MIN_TIMEZONE_OVERLAP_HOURS,
  OFFICIAL_LANGUAGE,
  PORTFOLIO_THRESHOLD,
  DOC_STAGE_ORDER,
  type Discipline,
} from './taxonomy'
import { timezoneOverlapHours } from './score'
import type { GateName, ProjectRequirements, SpecialistProfile } from './types'

export const GATE_LABELS: Record<GateName, string> = {
  portfolio_threshold: `Портфолио ниже ${PORTFOLIO_THRESHOLD}/10`,
  discipline: 'Не работает в этой дисциплине',
  jurisdiction: 'Не проходил согласования в этой стране',
  storeys: 'Нет подтверждённого опыта на такой этажности',
  doc_stage: 'Не ведёт документацию до нужной стадии',
  software_exchange: 'Не обменивается моделями с командой',
  language: 'Нет общего языка с клиентом или с органами',
  timezone_overlap: 'Пересечение по времени меньше рабочего минимума',
}

/**
 * Совместим ли специалист по обмену моделями с требованием проекта.
 *
 * Общий формат заменяет общий пакет: специалист на ArchiCAD совместим с
 * командой на Revit, если умеет координироваться по IFC (п.8).
 */
export function exchangesWith(
  specialist: Pick<SpecialistProfile, 'software' | 'ifcLevel'>,
  software: readonly string[],
): boolean {
  if (software.length === 0) return true
  if (specialist.software.some((s) => software.includes(s))) return true

  return IFC_RANK[specialist.ifcLevel] >= IFC_RANK[IFC_EXCHANGE_MINIMUM]
}

/** Первый непройденный гейт, либо null. Null означает «в выборке». */
export function failedGate(
  specialist: SpecialistProfile,
  requirements: ProjectRequirements,
  discipline: Discipline,
): GateName | null {
  if (specialist.portfolioRating < PORTFOLIO_THRESHOLD) return 'portfolio_threshold'

  if (!specialist.disciplines.includes(discipline)) return 'discipline'

  if (!specialist.jurisdictions.includes(requirements.jurisdiction)) return 'jurisdiction'

  if (specialist.maxStoreys < requirements.storeys) return 'storeys'

  const covers = specialist.docStages.some(
    (s) => DOC_STAGE_ORDER[s] >= DOC_STAGE_ORDER[requirements.targetStage],
  )
  if (!covers) return 'doc_stage'

  if (!exchangesWith(specialist, requirements.software)) return 'software_exchange'

  const sharesClientLanguage = specialist.languages.some((l) => requirements.languages.includes(l))
  if (!sharesClientLanguage) return 'language'

  // Согласования идут в органах, а органы говорят на своём языке. Для этой
  // дисциплины язык юрисдикции — жёсткое требование, а не удобство.
  if (discipline === 'permitting') {
    if (!specialist.languages.includes(OFFICIAL_LANGUAGE[requirements.jurisdiction])) {
      return 'language'
    }
  }

  const overlap = timezoneOverlapHours(specialist.utcOffset, requirements.utcOffset)
  if (overlap < MIN_TIMEZONE_OVERLAP_HOURS) return 'timezone_overlap'

  return null
}

export function passes(
  specialist: SpecialistProfile,
  requirements: ProjectRequirements,
  discipline: Discipline,
): boolean {
  return failedGate(specialist, requirements, discipline) === null
}
