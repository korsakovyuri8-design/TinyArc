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
  MIN_TIMEZONE_OVERLAP_HOURS,
  OFFICIAL_LANGUAGE,
  PORTFOLIO_THRESHOLD,
  DOC_STAGE_ORDER,
  coversRole,
  type RequiredRole,
} from './taxonomy'
import { availability, timezoneOverlapHours } from './score'
import type { GateName, ProjectRequirements, SpecialistProfile } from './types'

export const GATE_LABELS: Record<GateName, string> = {
  portfolio_threshold: `Портфолио ниже ${PORTFOLIO_THRESHOLD}/10`,
  discipline: 'Не работает в этой дисциплине',
  specialization: 'Дисциплина та, специализация не та',
  jurisdiction: 'Не проходил согласования в этой стране',
  storeys: 'Нет подтверждённого опыта на такой этажности',
  doc_stage: 'Не ведёт документацию до нужной стадии',
  software_exchange: 'Не работает в пакете проекта',
  language: 'Нет общего языка с клиентом или с органами',
  timezone_overlap: 'Пересечение по времени меньше рабочего минимума',
  availability: 'Нет свободной ёмкости или не успевает выйти к сроку',
}

/**
 * Технологический шлюз (Tech Gate).
 *
 * Если клиент указал пакет, специалист обязан в нём работать. Обмена по IFC как
 * обхода здесь нет намеренно: команда, говорящая на разных цифровых языках,
 * теряет данные модели на каждой передаче, а отвечаем за комплект мы. Гений на
 * ArchiCAD в проекте на Revit не проходит — это правило, а не недоразумение.
 *
 * Уровень IFC остаётся в профиле и виден в интерфейсе: он важен на хендоффе,
 * просто не отменяет совпадения пакета.
 */
export function worksInStack(
  specialist: Pick<SpecialistProfile, 'software'>,
  software: readonly string[],
): boolean {
  // Пакет не задан — клиенту всё равно, в чём считают. Тогда шлюза нет.
  if (software.length === 0) return true

  return specialist.software.some((s) => software.includes(s))
}

/** Первый непройденный гейт, либо null. Null означает «в выборке». */
export function failedGate(
  specialist: SpecialistProfile,
  requirements: ProjectRequirements,
  role: RequiredRole,
): GateName | null {
  if (specialist.portfolioRating < PORTFOLIO_THRESHOLD) return 'portfolio_threshold'

  if (!specialist.disciplines.includes(role.discipline)) return 'discipline'

  // Дисциплина совпала, но конструктор по бетону не считает деревянный дом.
  if (!coversRole(specialist.specializations, role)) return 'specialization'

  if (!specialist.jurisdictions.includes(requirements.jurisdiction)) return 'jurisdiction'

  if (specialist.maxStoreys < requirements.storeys) return 'storeys'

  const covers = specialist.docStages.some(
    (s) => DOC_STAGE_ORDER[s] >= DOC_STAGE_ORDER[requirements.targetStage],
  )
  if (!covers) return 'doc_stage'

  if (!worksInStack(specialist, requirements.software)) return 'software_exchange'

  const sharesClientLanguage = specialist.languages.some((l) => requirements.languages.includes(l))
  if (!sharesClientLanguage) return 'language'

  // Согласования идут в органах, а органы говорят на своём языке. Для этой
  // дисциплины язык юрисдикции — жёсткое требование, а не удобство.
  if (role.discipline === 'permitting') {
    if (!specialist.languages.includes(OFFICIAL_LANGUAGE[requirements.jurisdiction])) {
      return 'language'
    }
  }

  const overlap = timezoneOverlapHours(specialist.utcOffset, requirements.utcOffset)
  if (overlap < MIN_TIMEZONE_OVERLAP_HOURS) return 'timezone_overlap'

  // Ноль часов в неделю или выход позже горизонта — специалиста в выборке нет.
  // Это гейт, а не низкий балл: «свободен через полгода» не ранжируется, он
  // просто не подходит проекту с датой.
  if (availability(specialist, requirements) <= 0) return 'availability'

  return null
}

export function passes(
  specialist: SpecialistProfile,
  requirements: ProjectRequirements,
  role: RequiredRole,
): boolean {
  return failedGate(specialist, requirements, role) === null
}
