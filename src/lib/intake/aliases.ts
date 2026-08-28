/**
 * Как узнать значение таксономии в том, что написал человек.
 *
 * База специалистов приходит из таблицы, а не из формы. В ней «Архитектор»,
 * «архитектор», «Architect» и «АРХИТЕКТУРА» — одно и то же, а страна называется
 * то «Черногория», то «ME», то «Montenegro».
 *
 * Правило распознавания одно и оно намеренно строгое: совпадение по началу
 * нормализованной строки. Подстрока в середине даёт ложные срабатывания —
 * «ландшафтный архитектор» ушёл бы и в архитектуру, и в ландшафт, — а точное
 * равенство не переживает ни одного окончания. Не распознанное не угадывается:
 * оно попадает в отчёт импорта, и человек решает сам.
 */

import type {
  ClimateZone,
  Discipline,
  DocStage,
  Jurisdiction,
  Language,
  MaterialSystem,
  Software,
  Specialization,
  Typology,
} from '@/engine/taxonomy'

/** Нижний регистр, ё→е, без пунктуации и лишних пробелов. */
export function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/**
 * Словари синонимов.
 *
 * Ключ — значение таксономии, значения — начала строк, по которым оно
 * узнаётся. Порядок внутри словаря не важен; важно, чтобы синоним одной записи
 * не был началом синонима другой — такие пары ловит тест.
 */
export const DISCIPLINE_ALIASES: Record<Discipline, string[]> = {
  architecture: ['архитект', 'architect', 'arch', 'гап', 'гип'],
  structural: ['конструктор', 'конструкц', 'кж', 'км', 'structur', 'инженер конструктор'],
  mep: ['мер', 'mep', 'овик', 'овив', 'инженерн', 'вк ', 'эом', 'hvac', 'сантехник', 'электрик'],
  landscape: ['ландшафт', 'landscape', 'благоустройств'],
  interiors: ['интерьер', 'interior', 'дизайнер интерьер'],
  permitting: ['согласован', 'permit', 'разрешительн', 'экспертиз'],
  survey: ['геодез', 'survey', 'топограф', 'изыскан'],
  visualization: ['визуализ', 'visual', 'render', 'рендер', '3d'],
}

export const SPECIALIZATION_ALIASES: Record<Specialization, string[]> = {
  structural_concrete: ['монолит', 'железобетон', 'жб', 'бетон', 'concrete'],
  structural_steel: ['металл', 'лстк', 'сталь', 'steel'],
  structural_timber: ['дерев', 'клт', 'clt', 'каркасн', 'timber', 'брус'],
  mep_hvac: ['отоплен', 'вентиляц', 'кондицион', 'hvac', 'овик'],
  mep_electrical: ['электр', 'освещен', 'electric', 'lighting'],
  mep_plumbing: ['водоснабж', 'канализ', 'сантехн', 'plumbing'],
  mep_off_grid: ['автономн', 'off grid', 'offgrid', 'солнечн', 'септик'],
  mep_smart_home: ['умный дом', 'smart home', 'автоматизац'],
  arch_small_scale: ['малые формы', 'модульн', 'частн', 'small scale'],
  arch_large_scale: ['городск', 'многоквартирн', 'large scale', 'застройк'],
  landscape_garden: ['сад', 'озеленен', 'garden'],
  landscape_master_planning: ['генплан', 'мастер план', 'master plan'],
  landscape_grading: ['вертикальн планировк', 'дренаж', 'grading'],
  interiors_residential: ['жил интерьер', 'квартир', 'residential interior'],
  interiors_product: ['мебель', 'предметн', 'product design'],
  interiors_horeca: ['хорека', 'horeca', 'обществен', 'ресторан', 'отел'],
  viz_photoreal: ['фотореал', 'photoreal'],
  viz_artistic: ['атмосферн', 'artistic', 'коллаж'],
  permit_zoning: ['зонирован', 'zoning', 'урбанистическ услов'],
  permit_flood: ['подтоплен', 'затоплен', 'паводок', 'flood'],
}

export const JURISDICTION_ALIASES: Record<Jurisdiction, string[]> = {
  ME: ['черногор', 'montenegro', 'crna gora', 'me', 'mne', 'тиват', 'будв', 'котор', 'подгориц'],
  RS: ['серб', 'serbia', 'srbija', 'rs', 'srb', 'белград', 'beograd', 'нови сад'],
  GR: ['грец', 'greece', 'ellada', 'gr', 'grc', 'афин', 'салоник', 'крит'],
}

export const SOFTWARE_ALIASES: Record<Software, string[]> = {
  revit: ['revit', 'ревит'],
  archicad: ['archicad', 'архикад', 'archi cad'],
  autocad: ['autocad', 'автокад', 'acad', 'dwg'],
  rhino: ['rhino', 'райно', 'grasshopper'],
  tekla: ['tekla', 'текла'],
}

export const LANGUAGE_ALIASES: Record<Language, string[]> = {
  en: ['англ', 'english', 'en'],
  sr: ['серб', 'srpski', 'serbian', 'sr'],
  cnr: ['черногорск', 'crnogorski', 'cnr'],
  el: ['греч', 'greek', 'ellinika', 'el'],
  ru: ['рус', 'russian', 'ru'],
}

export const TYPOLOGY_ALIASES: Record<Typology, string[]> = {
  villa: ['вилл', 'частн дом', 'коттедж', 'особняк', 'villa', 'house'],
  townhouse: ['таунхаус', 'townhouse', 'блокирован'],
  multi_family: ['многоквартирн', 'апартамент', 'multi family', 'жил комплекс'],
  mixed_use: ['смешанн', 'mixed use', 'коммерч'],
}

export const MATERIAL_ALIASES: Record<MaterialSystem, string[]> = {
  concrete: ['монолит', 'бетон', 'железобетон', 'concrete'],
  masonry: ['кладк', 'кирпич', 'блок', 'masonry'],
  timber: ['дерев', 'брус', 'clt', 'каркасн', 'timber'],
  steel: ['металл', 'сталь', 'лстк', 'steel'],
  hybrid: ['комбинирован', 'смешанн', 'hybrid'],
}

export const CLIMATE_ALIASES: Record<ClimateZone, string[]> = {
  mediterranean: ['средиземн', 'mediterran', 'приморск'],
  continental: ['континент', 'continental', 'умеренн'],
  alpine: ['альп', 'alpine', 'горн'],
  arid: ['засушл', 'arid', 'сух'],
}

export const DOC_STAGE_ALIASES: Record<DocStage, string[]> = {
  concept: ['концеп', 'эскиз', 'concept', 'idejno'],
  permit: ['разрешен', 'permit', 'согласован', 'главн проект'],
  tender: ['тендер', 'tender', 'рабоч документац', 'смет'],
  construction: ['авторск надзор', 'construction', 'стройк', 'исполнительн'],
}

/**
 * Первое значение словаря, чей синоним начинает строку.
 *
 * Возвращает null, а не догадку: не узнанное значение уходит в отчёт импорта.
 * Тихая подстановка «наверное, архитектор» здесь стоила бы дороже пустого
 * поля — пустое видно, а неверное нет.
 */
export function matchOne<T extends string>(
  value: string,
  aliases: Record<T, string[]>,
): T | null {
  const text = normalise(value)
  if (!text) return null

  let best: { key: T; length: number } | null = null

  for (const [key, synonyms] of Object.entries(aliases) as [T, string[]][]) {
    for (const synonym of synonyms) {
      const needle = normalise(synonym)
      if (!text.startsWith(needle)) continue

      // Длинный синоним точнее короткого: «ландшафтный» должен победить «ланд».
      if (!best || needle.length > best.length) best = { key, length: needle.length }
    }
  }

  return best?.key ?? null
}

/** Ячейка со списком: «Архитектор, Ландшафт» или «Revit; ArchiCAD». */
export function matchMany<T extends string>(
  cell: string,
  aliases: Record<T, string[]>,
): { values: T[]; unknown: string[] } {
  const parts = cell
    .split(/[,;/|]+/)
    .map((p) => p.trim())
    .filter(Boolean)

  const values: T[] = []
  const unknown: string[] = []

  for (const part of parts) {
    const match = matchOne(part, aliases)

    if (match === null) {
      unknown.push(part)
      continue
    }

    if (!values.includes(match)) values.push(match)
  }

  return { values, unknown }
}
