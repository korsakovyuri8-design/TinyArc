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
  type Software,
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
  language: 'Нет общего языка с клиентом или с органами',
  timezone_overlap: 'Пересечение по времени меньше рабочего минимума',
  availability: 'Нет свободной ёмкости или не успевает выйти к сроку',
  subscription: 'Нет действующей подписки на доступ к проектам',
}

/**
 * Технологический шлюз: единый пакет внутри команды.
 *
 * Требование одно — вся собранная команда работает в одном пакете. Какой это
 * пакет, решает не клиент и не бюро: он выпадает сам, когда сходится состав.
 *
 * Отдельного отсева по пакету, заявленному клиентом, здесь нет намеренно.
 * Клиент покупает комплект документации, а не право выбирать, в чём его
 * начертят; сильный конструктор, работающий в другом пакете, — это потеря для
 * проекта, а не соблюдение требования. Заявленный клиентом пакет остаётся в
 * брифе как справка для бюро.
 *
 * Уровень обмена по IFC остаётся в профиле: он важен на передаче между
 * разделами и виден в интерфейсе.
 */
export function sharesPackage(
  specialist: Pick<SpecialistProfile, 'software'>,
  packages: readonly Software[],
): boolean {
  // Пустой набор — команда ещё не начата: ограничивать нечем.
  if (packages.length === 0) return true

  return specialist.software.some((s) => packages.includes(s))
}

/** Пакеты, которые останутся общими после добавления специалиста в команду. */
export function narrowPackages(
  specialist: Pick<SpecialistProfile, 'software'>,
  packages: readonly Software[] | null,
): Software[] {
  if (!packages) return [...specialist.software]

  return packages.filter((p) => specialist.software.includes(p))
}

/** Первый непройденный гейт, либо null. Null означает «в выборке». */
export function failedGate(
  specialist: SpecialistProfile,
  requirements: ProjectRequirements,
  role: RequiredRole,
): GateName | null {
  /*
   * Подписка проверяется первой, раньше портфолио, и не из-за важности.
   * Остальные гейты говорят о профессии — «портфолио ниже порога», «не та
   * специализация»; их бюро показывает человеку, и они помогают. Подписка не
   * про профессию вовсе, и мешать её с ними в одном списке причин значит
   * однажды сказать сильному специалисту, что он не прошёл отбор, когда он
   * просто не заплатил.
   */
  if (specialist.subscription === 'none') return 'subscription'

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
