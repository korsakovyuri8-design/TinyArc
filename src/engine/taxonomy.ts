/**
 * Таксономия специалистов: двенадцать измерений (концепт, п.8).
 *
 * Это фиксированные словари, а не свободные теги. Свободный тег нельзя
 * пересечь: «средиземноморский климат» и «Средиземноморье» — два разных тега и
 * ноль совпадений. Всё, по чему движок считает, живёт здесь.
 *
 * Разделение на жёсткие гейты и мягкие сигналы — тоже здесь, и оно не
 * косметическое: каждый жёсткий критерий сжимает пул (концепт, п.8).
 */

// --- 1. Дисциплина ---------------------------------------------------------

export const DISCIPLINES = [
  'architecture',
  'structural',
  'mep',
  'landscape',
  'interiors',
  'permitting',
  'survey',
  'visualization',
] as const
export type Discipline = (typeof DISCIPLINES)[number]

// --- 2. Типология ----------------------------------------------------------

export const TYPOLOGIES = ['villa', 'townhouse', 'multi_family', 'mixed_use'] as const
export type Typology = (typeof TYPOLOGIES)[number]

// --- 3. Масштаб ------------------------------------------------------------

/** Диапазон общей площади (м²), с которым специалист реально работал. */
export const SCALE_BANDS = ['upto_250', '250_1000', '1000_3000', '3000_plus'] as const
export type ScaleBand = (typeof SCALE_BANDS)[number]

export const SCALE_BAND_BOUNDS: Record<ScaleBand, { min: number; max: number }> = {
  upto_250: { min: 0, max: 250 },
  '250_1000': { min: 250, max: 1000 },
  '1000_3000': { min: 1000, max: 3000 },
  '3000_plus': { min: 3000, max: Number.POSITIVE_INFINITY },
}

export function scaleBandFor(areaSqm: number): ScaleBand {
  const band = SCALE_BANDS.find((b) => areaSqm < SCALE_BAND_BOUNDS[b].max)
  return band ?? '3000_plus'
}

// --- 4. Этажность ----------------------------------------------------------

/**
 * Продуктовая граница — пять этажей (концепт, п.5). Выше не проект Bureau, и
 * движок обязан это сказать, а не молча собрать команду.
 */
export const MAX_STOREYS = 5

// --- 5. Материальная система ----------------------------------------------

export const MATERIAL_SYSTEMS = ['concrete', 'masonry', 'timber', 'steel', 'hybrid'] as const
export type MaterialSystem = (typeof MATERIAL_SYSTEMS)[number]

// --- 6. Климатическая зона -------------------------------------------------

export const CLIMATE_ZONES = ['mediterranean', 'continental', 'alpine', 'arid'] as const
export type ClimateZone = (typeof CLIMATE_ZONES)[number]

// --- 7. Юрисдикция ---------------------------------------------------------

/** Стартовая география (концепт, п.5). Страна открывается только с подписью. */
export const JURISDICTIONS = ['ME', 'RS', 'GR'] as const
export type Jurisdiction = (typeof JURISDICTIONS)[number]

export const JURISDICTION_NAMES: Record<Jurisdiction, string> = {
  ME: 'Черногория',
  RS: 'Сербия',
  GR: 'Греция',
}

/** Смещение от UTC, в котором живёт стройка. Часовой пояс клиента не спрашивают. */
export const JURISDICTION_UTC_OFFSET: Record<Jurisdiction, number> = {
  ME: 1,
  RS: 1,
  GR: 2,
}

/** Язык, на котором в этой стране разговаривают органы. Для согласований — гейт. */
export const OFFICIAL_LANGUAGE: Record<Jurisdiction, Language> = {
  ME: 'cnr',
  RS: 'sr',
  GR: 'el',
}

// --- 8. Софт ---------------------------------------------------------------

export const SOFTWARE = ['revit', 'archicad', 'autocad', 'rhino', 'tekla'] as const
export type Software = (typeof SOFTWARE)[number]

/**
 * Уровень обмена по IFC. Общий формат заменяет общий пакет: специалист на
 * ArchiCAD совместим с командой на Revit, если умеет координироваться по IFC.
 */
export const IFC_LEVELS = ['none', 'import', 'exchange', 'coordination'] as const
export type IfcLevel = (typeof IFC_LEVELS)[number]

export const IFC_RANK: Record<IfcLevel, number> = {
  none: 0,
  import: 1,
  exchange: 2,
  coordination: 3,
}

/** Минимум, при котором несовпадение пакетов перестаёт быть блокирующим. */
export const IFC_EXCHANGE_MINIMUM: IfcLevel = 'exchange'

// --- 9. Стадия документации ------------------------------------------------

export const DOC_STAGES = ['concept', 'permit', 'tender', 'construction'] as const
export type DocStage = (typeof DOC_STAGES)[number]

export const DOC_STAGE_ORDER: Record<DocStage, number> = {
  concept: 0,
  permit: 1,
  tender: 2,
  construction: 3,
}

/** Все стадии до целевой включительно: проект идёт по ним, а не прыгает в конец. */
export function stagesUpTo(target: DocStage): DocStage[] {
  return DOC_STAGES.filter((s) => DOC_STAGE_ORDER[s] <= DOC_STAGE_ORDER[target])
}

// --- 10. Регуляторный трек -------------------------------------------------

/**
 * Лёгкое регулирование — это и есть продуктовая граница (концепт, п.5).
 * Специалист со «стандартным» треком не отсеивается, но и не заменяет опыт в
 * лёгком: это мягкий сигнал.
 */
export const REGULATORY_TRACKS = ['light', 'standard'] as const
export type RegulatoryTrack = (typeof REGULATORY_TRACKS)[number]

// --- 11. Язык --------------------------------------------------------------

export const LANGUAGES = ['en', 'sr', 'cnr', 'el', 'ru'] as const
export type Language = (typeof LANGUAGES)[number]

export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'английский',
  sr: 'сербский',
  cnr: 'черногорский',
  el: 'греческий',
  ru: 'русский',
}

// --- 12. Режим работы ------------------------------------------------------

export const WORK_MODES = ['remote', 'hybrid'] as const
export type WorkMode = (typeof WORK_MODES)[number]

/** Меньше этого пересечения по часам команда не работает, а переписывается. */
export const MIN_TIMEZONE_OVERLAP_HOURS = 2

/** Пересечение, начиная с которого часовой пояс перестаёт мешать вовсе. */
export const FULL_TIMEZONE_OVERLAP_HOURS = 4

// --- Пороги ----------------------------------------------------------------

/** Порог по портфолио (концепт, п.9). Стоит до скоринга, а не внутри него. */
export const PORTFOLIO_THRESHOLD = 8

// --- Состав команды --------------------------------------------------------

/**
 * Какие дисциплины обязательны под типологию (концепт, п.10). Вилле не нужен
 * тот же набор, что mixed-use, — состав определяется проектом, а не шаблоном.
 */
export const REQUIRED_DISCIPLINES: Record<Typology, Discipline[]> = {
  villa: ['architecture', 'structural', 'mep'],
  townhouse: ['architecture', 'structural', 'mep'],
  multi_family: ['architecture', 'structural', 'mep', 'landscape'],
  mixed_use: ['architecture', 'structural', 'mep', 'landscape', 'interiors'],
}

/**
 * Дисциплины, которые добавляет стадия, а не типология. Согласования и
 * геодезия не нужны концепции и обязательны с разрешения.
 */
export const STAGE_DISCIPLINES: Partial<Record<DocStage, Discipline[]>> = {
  permit: ['permitting', 'survey'],
}

export function requiredDisciplines(typology: Typology, targetStage: DocStage): Discipline[] {
  const fromStage = stagesUpTo(targetStage).flatMap((s) => STAGE_DISCIPLINES[s] ?? [])
  return unique([...REQUIRED_DISCIPLINES[typology], ...fromStage])
}

export function unique<T>(items: T[]): T[] {
  return [...new Set(items)]
}
