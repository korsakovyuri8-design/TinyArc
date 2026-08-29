/**
 * Направления проекта.
 *
 * После брифа клиенту показывают несколько вариантов того, как здание может
 * относиться к участку, и он выбирает близкий. Выбор фиксирует намерение и
 * уходит команде до того, как кто-то начал рисовать.
 *
 * Что это НЕ:
 *
 *  · не проектное решение — направление ничего не определяет по конструкциям,
 *    площадям и нормам, и в комплект документации не входит;
 *  · не обязательство — команда может показать, что выбранное невозможно на
 *    этом участке, и это нормальный исход;
 *  · не вход отбора — состав команды от направления не зависит. Иначе
 *    эстетика начала бы двигать инженерию, а она этого делать не должна.
 *
 * Набор выводится из проекта, а не берётся списком: на ровном участке нет
 * террасирования, а у mixed-use нет павильонов. Показывать неприменимое —
 * значит предлагать выбрать то, что потом придётся отобрать.
 */

import type { ProjectShape, Typology } from './taxonomy'

export type Direction = {
  key: string
  title: string
  /** Что это означает для объёма. Языком архитектуры, не маркетинга. */
  summary: string
  /** Чем это оплачивается. Клиент выбирает с открытыми глазами или не выбирает. */
  tradeoff: string
}

type Entry = Direction & {
  applies: (shape: ProjectShape) => boolean
  /** Фрагмент описания для генератора изображения. */
  fragment: string
}

const LOW_RISE: Typology[] = ['villa', 'townhouse']

const CATALOGUE: Entry[] = [
  {
    key: 'terraced',
    title: 'Terracing',
    summary:
      'The volume is broken into levels, each following the line of the slope. The building reads as a continuation of the terrain rather than an object set down on it.',
    tradeoff:
      'More retaining structures and harder waterproofing. Every level needs its own datum and its own entrance.',
    applies: (s) => s.terrain === 'slope',
    fragment:
      'terraced volumes stepping down a hillside, each level following the natural slope, retaining walls integrated into the architecture',
  },
  {
    key: 'embedded',
    title: 'Cut into the slope',
    summary:
      'Part of the volume goes into the ground and the roof becomes usable terrace. From the approach the building is barely legible.',
    tradeoff:
      'Expensive waterproofing and ventilation for the buried part. Daylight to the below-grade rooms needs a solution of its own.',
    applies: (s) => s.terrain === 'slope',
    fragment:
      'building embedded into the hillside, green accessible roof, only the glazed facade facing the valley is visible',
  },
  {
    key: 'stilts',
    title: 'Raised level',
    summary:
      'The main volume is lifted on supports; the lower level stays open or serves as plant space.',
    tradeoff:
      'Harder thermal performance for the slab over open air and costlier vertical circulation. In exchange, the ground under the building stays permeable.',
    applies: (s) => s.terrain === 'flood_prone',
    fragment:
      'main volume raised on slender columns above ground level, open shaded undercroft beneath, flood-resilient base',
  },
  {
    key: 'courtyard',
    title: 'Courtyard',
    summary:
      'The volume wraps a closed courtyard. Privacy comes from the plan, not from a fence or from distance to the neighbour.',
    tradeoff:
      'More external wall for the same floor area, and heat loss to match. It needs a site the courtyard actually fits on.',
    applies: (s) => s.typology !== 'mixed_use',
    fragment:
      'courtyard house, volumes wrapped around a private enclosed patio, inward-facing glazing, solid outer walls',
  },
  {
    key: 'pavilions',
    title: 'Pavilions',
    summary:
      'The volume is broken into several connected parts instead of one body. Functions are separated, with open links between them.',
    tradeoff:
      'Perimeter and envelope cost rise noticeably. Services have to be run between the blocks.',
    applies: (s) => LOW_RISE.includes(s.typology),
    fragment:
      'several separate low pavilions connected by covered walkways, dispersed plan, landscape flowing between volumes',
  },
  {
    key: 'compact',
    title: 'Compact volume',
    summary:
      'A single dense body with minimal perimeter. The most economical geometry for envelope cost and for heat.',
    tradeoff:
      'Less façade frontage and fewer viewpoints. The plan is more rigid: there is barely anywhere to move a wall.',
    applies: () => true,
    fragment:
      'compact single volume, minimal envelope, restrained geometry, precise proportions',
  },
  {
    key: 'linear',
    title: 'Linear volume',
    summary:
      'The building runs along the site as a single band. Every principal room gets the same orientation and the same view.',
    tradeoff:
      'Long service runs and long corridors. It needs a site with a pronounced long side.',
    applies: () => true,
    fragment:
      'long linear volume stretched along the site, continuous glazed facade on one side, repetitive structural rhythm',
  },
  {
    key: 'stacked',
    title: 'Stepped storeys',
    summary:
      'The upper floors step back, freeing up terraces. The volume sheds mass towards the top.',
    tradeoff:
      'Every setback is a change in the structural scheme and a junction that has to be solved on its own.',
    applies: (s) => s.typology === 'multi_family' || s.typology === 'mixed_use',
    fragment:
      'stepped massing with setback upper floors forming large private terraces, tapering silhouette',
  },
  {
    key: 'podium',
    title: 'Объём на подиуме',
    summary:
      'The building sits on a pronounced plinth that levels the site and lifts the living floors off the ground.',
    tradeoff:
      'A podium is a volume you have to build and then fill with something, or it becomes expensive emptiness.',
    applies: (s) => s.typology !== 'villa' || s.terrain !== 'flat',
    fragment:
      'building resting on a pronounced stone podium that levels the site, clear separation between base and upper volume',
  },
]

/** Сколько направлений показывать. Больше четырёх — это уже не выбор, а каталог. */
export const DIRECTIONS_SHOWN = 4

export function directionsFor(shape: ProjectShape): Direction[] {
  return CATALOGUE.filter((entry) => entry.applies(shape))
    .slice(0, DIRECTIONS_SHOWN)
    .map(({ key, title, summary, tradeoff }) => ({ key, title, summary, tradeoff }))
}

const TYPOLOGY_EN: Record<Typology, string> = {
  villa: 'single-family villa',
  townhouse: 'townhouse row',
  multi_family: 'small multi-family residential building',
  mixed_use: 'mixed-use building with commercial ground floor',
}

const CLIMATE_EN: Record<string, string> = {
  mediterranean: 'Mediterranean coastal setting',
  continental: 'continental European setting',
  alpine: 'alpine setting',
  arid: 'arid setting',
}

const MATERIAL_EN: Record<string, string> = {
  concrete: 'exposed concrete and stone',
  masonry: 'load-bearing masonry and render',
  timber: 'timber structure and cladding',
  steel: 'steel frame with light infill',
  hybrid: 'concrete base with timber upper structure',
}

/**
 * Описание для генератора изображения.
 *
 * Собирается из фактов проекта и языка направления. Слов «luxury», «award
 * winning» и имён живых архитекторов здесь нет намеренно: первое даёт
 * глянец вместо архитектуры, второе — чужую работу под нашей подписью.
 */
export function promptFor(shape: ProjectShape, areaSqm: number, storeys: number, climateZone: string, key: string): string {
  const entry = CATALOGUE.find((e) => e.key === key)
  if (!entry) throw new Error(`Направления «${key}» нет в каталоге.`)

  return [
    `Architectural massing study, ${TYPOLOGY_EN[shape.typology]}`,
    `${storeys} storeys, approximately ${areaSqm} square metres`,
    CLIMATE_EN[climateZone] ?? 'temperate setting',
    MATERIAL_EN[shape.materialSystem] ?? 'mixed construction',
    entry.fragment,
    'daylight, neutral sky, no people, no text, restrained architectural photography',
  ].join(', ')
}

/** Направление по ключу — для подписи выбранного варианта в интерфейсе. */
export function directionByKey(key: string): Direction | null {
  const entry = CATALOGUE.find((e) => e.key === key)
  if (!entry) return null

  const { title, summary, tradeoff } = entry
  return { key, title, summary, tradeoff }
}
