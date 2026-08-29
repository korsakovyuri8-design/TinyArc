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
  // Три роли, помеченные в исходной спецификации как «разберёмся позже».
  // Разобрались (п.8): они заведены, но требуются узко — см. requiredRoles.
  // Дисциплина, обязательная всегда, делает несобираемым каждый проект, под
  // который в пуле нет такого человека; дисциплина, не обязательная никогда, —
  // это строка в словаре, а не роль.
  'cost_estimation',
  'dfma',
  'energy',
] as const
export type Discipline = (typeof DISCIPLINES)[number]

/**
 * Второй уровень дисциплины — специализация.
 *
 * Дисциплины одной плоским списком мало: «позовём инженера» заканчивается тем,
 * что бетонщик проектирует деревянный дом и рисует бункер. Конструкторы делятся
 * по материалу, MEP — по системам, архитекторы — по масштабу, ландшафт — по
 * инженерной сложности, интерьеры — по типу пространства.
 *
 * Сметчик, DFMA-технолог и консультант по энергоэффективности заведены
 * дисциплинами, но без второго уровня: делить их пока не на что, а пустой
 * словарь честнее выдуманного (см. survey).
 */
export const SPECIALIZATIONS = [
  // Конструкции — по материалу. Главное деление: скелет здания.
  'structural_concrete',
  'structural_steel',
  'structural_timber',
  // MEP — по системам.
  'mep_hvac',
  'mep_electrical',
  'mep_plumbing',
  'mep_off_grid',
  'mep_smart_home',
  // Архитектура — по масштабу.
  'arch_small_scale',
  'arch_large_scale',
  // Ландшафт — по масштабу и инженерной сложности.
  'landscape_garden',
  'landscape_master_planning',
  'landscape_grading',
  // Интерьеры — по типу пространства.
  'interiors_residential',
  'interiors_product',
  'interiors_horeca',
  // Визуализация — по подаче.
  'viz_photoreal',
  'viz_artistic',
  // Согласования.
  'permit_zoning',
  'permit_flood',
] as const
export type Specialization = (typeof SPECIALIZATIONS)[number]

/** Какие специализации вообще осмысленны внутри дисциплины. */
export const DISCIPLINE_SPECIALIZATIONS: Record<Discipline, Specialization[]> = {
  architecture: ['arch_small_scale', 'arch_large_scale'],
  structural: ['structural_concrete', 'structural_steel', 'structural_timber'],
  mep: ['mep_hvac', 'mep_electrical', 'mep_plumbing', 'mep_off_grid', 'mep_smart_home'],
  landscape: ['landscape_garden', 'landscape_master_planning', 'landscape_grading'],
  interiors: ['interiors_residential', 'interiors_product', 'interiors_horeca'],
  permitting: ['permit_zoning', 'permit_flood'],
  // Геодезия не делится: подоснова есть подоснова.
  survey: [],
  // Три поздние роли пока не делятся: внутри каждой одна профессия, и
  // придумывать ей подвиды раньше первого проекта — это гадание, а не
  // таксономия.
  cost_estimation: [],
  dfma: [],
  energy: [],
  visualization: ['viz_photoreal', 'viz_artistic'],
}

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
 * Уровень обмена по IFC.
 *
 * Совпадения пакета он не отменяет — Tech Gate жёсткий (см. filter.ts). Уровень
 * важен на хендоффе: кто умеет координироваться, тот отдаёт модель дальше без
 * потерь, и это видно в профиле и в ранжировании.
 */
export const IFC_LEVELS = ['none', 'import', 'exchange', 'coordination'] as const
export type IfcLevel = (typeof IFC_LEVELS)[number]

export const IFC_RANK: Record<IfcLevel, number> = {
  none: 0,
  import: 1,
  exchange: 2,
  coordination: 3,
}


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

// --- Условия участка -------------------------------------------------------

/**
 * Рельеф и риск участка. Это не украшение брифа, а прямой вход матчинга:
 * склон требует вертикальной планировки, подтопление — согласований по риску.
 */
export const TERRAINS = ['flat', 'slope', 'flood_prone'] as const
export type Terrain = (typeof TERRAINS)[number]

/** Подключение к сетям. Автономка — это другая инженерия, а не та же со звёздочкой. */
export const GRID_CONNECTIONS = ['grid', 'off_grid'] as const
export type GridConnection = (typeof GRID_CONNECTIONS)[number]

// --- Состав команды --------------------------------------------------------

/**
 * Роль в команде: дисциплина плюс требование к специализации.
 *
 * `mode: 'any'` — достаточно одной специализации из списка (конструктор по
 * бетону ИЛИ по гибридным системам). `mode: 'all'` — нужны все: MEP-инженер
 * обязан вести и отопление, и электрику, и воду, иначе это не один слот, а три.
 */
export type RequiredRole = {
  discipline: Discipline
  specializations: Specialization[]
  mode: 'any' | 'all'
}

/** Форма проекта, из которой выводится состав команды. */
export type ProjectShape = {
  typology: Typology
  targetStage: DocStage
  materialSystem: MaterialSystem
  terrain: Terrain
  gridConnection: GridConnection
}

/**
 * Архитектор малых форм и архитектор городской застройки — разные профессии.
 * Вилла и townhouse идут к первому, multi-family и mixed-use ко второму.
 */
const ARCH_SCALE: Record<Typology, Specialization> = {
  villa: 'arch_small_scale',
  townhouse: 'arch_small_scale',
  multi_family: 'arch_large_scale',
  mixed_use: 'arch_large_scale',
}

/**
 * Материал проекта решает, какого конструктора звать. Гибрид открывает всех
 * троих: это опыт стыковки систем, а не отдельный материал. Кладку ведёт
 * конструктор по монолиту — расчётный аппарат тот же.
 */
const STRUCTURAL_BY_MATERIAL: Record<MaterialSystem, Specialization[]> = {
  concrete: ['structural_concrete'],
  masonry: ['structural_concrete'],
  timber: ['structural_timber'],
  steel: ['structural_steel'],
  hybrid: ['structural_concrete', 'structural_steel', 'structural_timber'],
}

/**
 * Состав команды под конкретный проект (сценарная матрица).
 *
 * Это и есть правило «IF Project_Type → Required_Tags»: состав определяется
 * проектом, а не шаблоном бюро. Вилле на ровном участке не нужен тот же набор,
 * что mixed-use на склоне.
 */
export function requiredRoles(shape: ProjectShape): RequiredRole[] {
  const stages = stagesUpTo(shape.targetStage)
  const roles: RequiredRole[] = []

  roles.push({
    discipline: 'architecture',
    specializations: [ARCH_SCALE[shape.typology]],
    mode: 'any',
  })

  roles.push({
    discipline: 'structural',
    specializations: STRUCTURAL_BY_MATERIAL[shape.materialSystem],
    mode: 'any',
  })

  // Один MEP-инженер обязан закрывать все три системы: разводить их по разным
  // людям на объекте до пяти этажей — это накладные расходы, а не экспертиза.
  const mep: Specialization[] = ['mep_hvac', 'mep_electrical', 'mep_plumbing']
  if (shape.gridConnection === 'off_grid') mep.push('mep_off_grid')
  roles.push({ discipline: 'mep', specializations: mep, mode: 'all' })

  // Ландшафт нужен там, где есть общая территория, и там, где есть склон.
  const needsLandscape =
    shape.typology === 'multi_family' || shape.typology === 'mixed_use' || shape.terrain === 'slope'

  if (needsLandscape) {
    const landscape: Specialization[] =
      shape.typology === 'villa' || shape.typology === 'townhouse'
        ? ['landscape_garden']
        : ['landscape_master_planning']

    // Склон — жёсткое требование вертикальной планировки. Без неё проект
    // не «чуть хуже», а смывается дождём.
    if (shape.terrain === 'slope') {
      roles.push({
        discipline: 'landscape',
        specializations: [...landscape, 'landscape_grading'],
        mode: 'all',
      })
    } else {
      roles.push({ discipline: 'landscape', specializations: landscape, mode: 'any' })
    }
  }

  if (shape.typology === 'mixed_use') {
    roles.push({
      discipline: 'interiors',
      specializations: ['interiors_residential', 'interiors_horeca'],
      mode: 'any',
    })
  }

  // Концепция — стадия продажи: без подачи её нечем утверждать.
  if (stages.includes('concept')) {
    roles.push({
      discipline: 'visualization',
      specializations: ['viz_photoreal', 'viz_artistic'],
      mode: 'any',
    })
  }

  if (stages.includes('permit')) {
    roles.push({ discipline: 'survey', specializations: [], mode: 'any' })

    const permit: Specialization[] = ['permit_zoning']
    if (shape.terrain === 'flood_prone') permit.push('permit_flood')
    roles.push({ discipline: 'permitting', specializations: permit, mode: 'all' })
  }

  /*
   * Три поздние роли требуются узко, и каждое условие названо.
   *
   * Сделать их обязательными всегда — значит сделать несобираемым каждый
   * проект, под который в пуле нет такого человека. Не требовать никогда —
   * значит завести строку в словаре вместо роли. Поэтому условия узкие и
   * проверяемые: они описывают случаи, где без роли работа не делается, а не
   * случаи, где она была бы полезна.
   */

  // Тендерная документация — это основание для цены. Пакет без ведомости
  // объёмов и сметы тендерным не является: по нему нельзя торговаться.
  if (stages.includes('tender')) {
    roles.push({ discipline: 'cost_estimation', specializations: [], mode: 'any' })
  }

  // Энергетический раздел входит в подачу везде, где мы работаем, но автора
  // требует не везде. У виллы это расчёт, который ведёт инженер ОВиК внутри
  // своего раздела. У многоквартирного и смешанного дома это отдельный
  // документ с отдельным автором: общие системы, общие узлы, ответственность
  // за расход целого здания, а не квартиры. Разделение проходит по числу
  // владельцев, а не по площади.
  const sharedBuilding = shape.typology === 'multi_family' || shape.typology === 'mixed_use'
  if (stages.includes('permit') && sharedBuilding) {
    roles.push({ discipline: 'energy', specializations: [], mode: 'any' })
  }

  // Сборные системы — дерево и металл — доходят до стройки чертежами
  // изготовления и порядком монтажа. Без технолога это делает конструктор,
  // и делает плохо: расчёт сечения и раскрой на станке — разные профессии.
  // До рабочей документации вопрос не встаёт: собирать ещё нечего.
  const prefab = shape.materialSystem === 'timber' || shape.materialSystem === 'steel'
  if (stages.includes('construction') && prefab) {
    roles.push({ discipline: 'dfma', specializations: [], mode: 'any' })
  }

  return roles
}

/** Проходит ли специалист требование роли по специализации. */
export function coversRole(specializations: Specialization[], role: RequiredRole): boolean {
  if (role.specializations.length === 0) return true

  return role.mode === 'all'
    ? role.specializations.every((s) => specializations.includes(s))
    : role.specializations.some((s) => specializations.includes(s))
}

export function unique<T>(items: T[]): T[] {
  return [...new Set(items)]
}
