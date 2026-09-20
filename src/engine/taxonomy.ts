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

/**
 * География бюро: Западные Балканы и весь ЕЭП.
 *
 * Страна в этом списке означает ровно одно — движок готов собрать под неё
 * команду и проверить право подписи. Она **не** означает, что для страны есть
 * корпус норм: проверка участка идёт по правилам из `ComplianceRule`, и там,
 * где правил нет, отчёт честно пишет, что это пробел корпуса, а не приговор
 * проекту. Корпус заводится по одной стране за раз и живёт своим темпом.
 *
 * Разделение сделано намеренно. Слить два списка в один значило бы держать
 * страну закрытой, пока юрист не свёл её нормы целиком, — то есть закрытой
 * годами. Бюро при этом умеет собрать команду уже сегодня, и скрывать это от
 * заказчика хуже, чем сказать ему, что нормы по его области ещё не сведены.
 */
export const JURISDICTIONS = [
  // Западные Балканы — стартовая география.
  'ME',
  'RS',
  // Европейский союз.
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  // Остальной ЕЭП: та же директива о признании квалификаций.
  'IS', 'LI', 'NO',
] as const
export type Jurisdiction = (typeof JURISDICTIONS)[number]

export const JURISDICTION_NAMES: Record<Jurisdiction, string> = {
  ME: 'Montenegro',
  RS: 'Serbia',
  AT: 'Austria',
  BE: 'Belgium',
  BG: 'Bulgaria',
  HR: 'Croatia',
  CY: 'Cyprus',
  CZ: 'Czechia',
  DK: 'Denmark',
  EE: 'Estonia',
  FI: 'Finland',
  FR: 'France',
  DE: 'Germany',
  GR: 'Greece',
  HU: 'Hungary',
  IE: 'Ireland',
  IT: 'Italy',
  LV: 'Latvia',
  LT: 'Lithuania',
  LU: 'Luxembourg',
  MT: 'Malta',
  NL: 'Netherlands',
  PL: 'Poland',
  PT: 'Portugal',
  RO: 'Romania',
  SK: 'Slovakia',
  SI: 'Slovenia',
  ES: 'Spain',
  SE: 'Sweden',
  IS: 'Iceland',
  LI: 'Liechtenstein',
  NO: 'Norway',
}

/**
 * Смещение от UTC, в котором живёт стройка. Часовой пояс клиента не спрашивают.
 *
 * Зимнее время: летний переход общий для всего ЕС и на разницу между странами
 * не влияет, а сроки считаются в рабочих часах, а не в метках времени.
 */
export const JURISDICTION_UTC_OFFSET: Record<Jurisdiction, number> = {
  ME: 1, RS: 1,
  AT: 1, BE: 1, BG: 2, HR: 1, CY: 2, CZ: 1, DK: 1, EE: 2, FI: 2, FR: 1,
  DE: 1, GR: 2, HU: 1, IE: 0, IT: 1, LV: 2, LT: 2, LU: 1, MT: 1, NL: 1,
  PL: 1, PT: 0, RO: 2, SK: 1, SI: 1, ES: 1, SE: 1,
  IS: 0, LI: 1, NO: 1,
}

/**
 * Дисциплины, для которых страна проекта — жёсткое требование.
 *
 * Их две, и обе по одной причине: работа делается не над моделью, а на месте
 * и в органе. Согласования идут в местном органе по местной процедуре;
 * геодезия — это выезд на участок и съёмка в местной системе координат.
 * Обе невыполнимы удалённо, сколько бы ни стоил специалист.
 *
 * Остальные дисциплины страной не ограничены, и это не послабление, а сам
 * продукт. Бюро существует затем, чтобы под проект собиралась команда со
 * всего мира: конструктор в Тбилиси и визуализатор в Буэнос-Айресе считают
 * тот же дом, что конструктор из Подгорицы, дешевле и часто лучше — и именно
 * на этой разнице держится обещание «быстрее и дешевле местного бюро».
 * Страновой гейт на всех ролях сводил пул к местному рынку и отменял это
 * обещание молча, не назвав ни одной причины ни заказчику, ни специалисту.
 *
 * Право подписи при этом никуда не делось: оно проверяется не здесь, а на
 * составе целиком (assemble.ts) — в команде обязан быть человек, который
 * подписывает в этой стране. Гейт на роли и подпись на составе — разные
 * требования, и смешивать их значит терять пул ради того, что уже проверено.
 */
export const LOCAL_ONLY_DISCIPLINES: readonly Discipline[] = ['permitting', 'survey']

/** Язык, на котором в этой стране разговаривают органы. Для согласований — гейт. */
export const OFFICIAL_LANGUAGE: Record<Jurisdiction, Language> = {
  ME: 'cnr',
  RS: 'sr',
  AT: 'de',
  // У Бельгии три государственных языка, у Финляндии два, у Мальты два, у
  // Кипра два. Здесь стоит тот, на котором орган ведёт разрешительное дело в
  // большинстве общин. Это упрощение, и оно сработает не везде: во Фландрии
  // подают по-нидерландски, в Валлонии по-французски. Второй язык страны
  // заводится тогда, когда появится первый проект, который об это споткнётся.
  BE: 'nl',
  BG: 'bg',
  HR: 'hr',
  CY: 'el',
  CZ: 'cs',
  DK: 'da',
  EE: 'et',
  FI: 'fi',
  FR: 'fr',
  DE: 'de',
  GR: 'el',
  HU: 'hu',
  IE: 'en',
  IT: 'it',
  LV: 'lv',
  LT: 'lt',
  LU: 'lb',
  MT: 'mt',
  NL: 'nl',
  PL: 'pl',
  PT: 'pt',
  RO: 'ro',
  SK: 'sk',
  SI: 'sl',
  ES: 'es',
  SE: 'sv',
  IS: 'is',
  LI: 'de',
  NO: 'no',
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
/**
 * Подписка специалиста на доступ к проектам (п.14).
 *
 * none — доступа к отбору нет; founding — бесплатно на пилоте; active —
 * платит. Плату вносит сторона предложения за доступ к спросу, а с гонорара
 * специалиста комиссия не берётся: иначе мы зарабатывали бы тем больше, чем
 * дороже обходится проект заказчику.
 */
export const SUBSCRIPTIONS = ['none', 'founding', 'active'] as const
export type Subscription = (typeof SUBSCRIPTIONS)[number]

export const REGULATORY_TRACKS = ['light', 'standard'] as const
export type RegulatoryTrack = (typeof REGULATORY_TRACKS)[number]

// --- 11. Язык --------------------------------------------------------------

/**
 * Языки, на которых бюро работает.
 *
 * Список идёт от двух разных нужд, и смешивать их нельзя. Английский и русский
 * стоят здесь как языки общения внутри команды. Остальные — государственные
 * языки юрисдикций: на них разговаривают органы, и для согласований это гейт,
 * а не удобство.
 */
export const LANGUAGES = [
  // Языки команды.
  'en', 'ru',
  // Государственные языки юрисдикций.
  'sr', 'cnr', 'el', 'bg', 'hr', 'cs', 'da', 'nl', 'et', 'fi', 'fr',
  'de', 'hu', 'ga', 'it', 'lv', 'lt', 'lb', 'mt', 'pl', 'pt', 'ro',
  'sk', 'sl', 'es', 'sv', 'is', 'no',
] as const
export type Language = (typeof LANGUAGES)[number]

export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  ru: 'Russian',
  sr: 'Serbian',
  cnr: 'Montenegrin',
  el: 'Greek',
  bg: 'Bulgarian',
  hr: 'Croatian',
  cs: 'Czech',
  da: 'Danish',
  nl: 'Dutch',
  et: 'Estonian',
  fi: 'Finnish',
  fr: 'French',
  de: 'German',
  hu: 'Hungarian',
  ga: 'Irish',
  it: 'Italian',
  lv: 'Latvian',
  lt: 'Lithuanian',
  lb: 'Luxembourgish',
  mt: 'Maltese',
  pl: 'Polish',
  pt: 'Portuguese',
  ro: 'Romanian',
  sk: 'Slovak',
  sl: 'Slovenian',
  es: 'Spanish',
  sv: 'Swedish',
  is: 'Icelandic',
  no: 'Norwegian',
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

/**
 * Сегмент проекта.
 *
 * Выводится из фактов брифа, а не выбирается заказчиком. Галочка «премиум»
 * означала бы торг: её не поставит никто, потому что за неё платят, и она
 * превратилась бы в наценку, о которой договариваются, а не в описание
 * объекта.
 *
 * Факты спорить не умеют. Вилла на склоне в шестьсот метров сложнее виллы в
 * двести пятьдесят на ровном, сколько бы заказчик ни хотел обратного.
 */
export const PROJECT_TIERS = ['standard', 'premium'] as const
export type ProjectTier = (typeof PROJECT_TIERS)[number]

/**
 * Площадь, начиная с которой объект уходит в премиальный сегмент.
 *
 * Шестьсот, а не четыреста. Четыреста — это обычная вилла, и на ней премиум
 * потерял бы смысл: в сегмент попало бы большинство проектов, а раз большинство,
 * то это не сегмент, а новая норма.
 */
export const PREMIUM_AREA_SQM = 600

/**
 * Доля цены, уходящая команде.
 *
 * В премиуме выше, и это не щедрость. Координации на метр там меньше: девять
 * ролей ведут один объект и на четырёхстах метрах, и на девятистах, а собрать
 * их стоит одинаково. Сэкономленное уходит людям, потому что именно там нужны
 * те, кто дороже.
 */
export const TEAM_SHARE: Record<ProjectTier, number> = {
  standard: 0.7,
  premium: 0.75,
}

/**
 * Порог качества для премиального проекта.
 *
 * Отдельно от `PORTFOLIO_THRESHOLD`, и это не дубль. Тот решает, пускать ли
 * человека в пул вообще. Этот решает, пускать ли его на сложный объект, и
 * считается уже не по портфолио, а по качеству целиком: портфолио плюс
 * история закрытых разделов.
 *
 * Отсюда и рост. Человек приходит со средним портфолио, ведёт обычные
 * проекты, метрики поставок накапливаются и вытесняют портфолио, качество
 * растёт, порог берётся сам. Никто никого не переводит вручную.
 */
export const PREMIUM_QUALITY_THRESHOLD = 8.5

/**
 * Дисциплины, к которым премиальный порог применяется.
 *
 * Не ко всем девяти, и это не послабление. Требовать премиального уровня от
 * каждой роли значило бы, что состав не собирается из-за визуализатора, —
 * притом что заказчик премиального объекта платит за проектное решение, а не
 * за картинку.
 *
 * Здесь те, чья работа определяет объект: архитектура, конструкции и
 * инженерные системы. Геодезист меряет участок одинаково на любом объекте;
 * согласователь либо имеет право подписи в этой стране, либо нет, и градаций
 * между этими состояниями не бывает.
 */
export const PREMIUM_GATED_DISCIPLINES: readonly Discipline[] = [
  'architecture',
  'structural',
  'mep',
]

/**
 * Сегмент по фактам проекта: площадь и глубина документации.
 *
 * Рельеф в признаки не входит, хотя напрашивался первым. На побережье
 * Черногории ровных участков почти нет, и склон как признак отправил бы в
 * премиум едва ли не всё, — сегмент исчез бы, не появившись. Сложность склона
 * уже оплачена иначе: движок требует на нём и сад, и вертикальную планировку,
 * то есть в команде на одного человека больше.
 *
 * Остаются два признака, и они про разное. Площадь говорит о размере объекта,
 * стадия — о том, как далеко его ведут: тендер и рабочая документация тяжелее
 * разрешения независимо от метров.
 */
export function tierFor(shape: { areaSqm: number; targetStage: DocStage }): ProjectTier {
  if (shape.areaSqm >= PREMIUM_AREA_SQM) return 'premium'
  if (shape.targetStage === 'tender' || shape.targetStage === 'construction') return 'premium'
  return 'standard'
}

/**
 * Подходит ли специалист премиальному проекту.
 *
 * Два условия вместе, и оба обязательны. Качество говорит, насколько человек
 * хорош; заявленный диапазон площади — работал ли он с таким объёмом вообще.
 * Сильный проектировщик малых форм и на девятистах метрах остаётся
 * проектировщиком малых форм: это другая работа, а не та же самая побольше.
 */
export function fitsPremium(
  specialist: { scaleBands: readonly ScaleBand[] },
  qualityScore: number,
  areaSqm: number,
): boolean {
  if (qualityScore < PREMIUM_QUALITY_THRESHOLD) return false
  return specialist.scaleBands.includes(scaleBandFor(areaSqm))
}

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
