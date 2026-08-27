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
    title: 'Террасирование',
    summary:
      'Объём разбит на уровни, каждый следует линии склона. Здание читается как продолжение рельефа, а не как поставленный на него предмет.',
    tradeoff:
      'Больше подпорных конструкций и сложнее гидроизоляция. Каждый уровень требует своей отметки и своего входа.',
    applies: (s) => s.terrain === 'slope',
    fragment:
      'terraced volumes stepping down a hillside, each level following the natural slope, retaining walls integrated into the architecture',
  },
  {
    key: 'embedded',
    title: 'Врезка в склон',
    summary:
      'Часть объёма уходит в землю, кровля становится эксплуатируемой площадкой. Со стороны подъезда здание почти не читается.',
    tradeoff:
      'Дорогая гидроизоляция и вентиляция заглублённой части. Инсоляция помещений в грунте требует отдельного решения.',
    applies: (s) => s.terrain === 'slope',
    fragment:
      'building embedded into the hillside, green accessible roof, only the glazed facade facing the valley is visible',
  },
  {
    key: 'stilts',
    title: 'Поднятый уровень',
    summary:
      'Основной объём поднят над землёй на опорах, нижний уровень остаётся открытым или техническим.',
    tradeoff:
      'Сложнее теплотехника перекрытия над улицей, дороже вертикальные связи. Зато участок под зданием остаётся проницаемым.',
    applies: (s) => s.terrain === 'flood_prone',
    fragment:
      'main volume raised on slender columns above ground level, open shaded undercroft beneath, flood-resilient base',
  },
  {
    key: 'courtyard',
    title: 'Внутренний двор',
    summary:
      'Объём обёрнут вокруг закрытого двора. Приватность обеспечивается планировкой, а не забором и не расстоянием до соседа.',
    tradeoff:
      'Больше наружных стен на ту же площадь и, соответственно, теплопотерь. Требует участка, где двор помещается.',
    applies: (s) => s.typology !== 'mixed_use',
    fragment:
      'courtyard house, volumes wrapped around a private enclosed patio, inward-facing glazing, solid outer walls',
  },
  {
    key: 'pavilions',
    title: 'Павильоны',
    summary:
      'Объём разобран на несколько связанных частей вместо одного тела. Функции разведены, между ними — открытые переходы.',
    tradeoff:
      'Периметр и стоимость наружных ограждений растут заметно. Инженерные сети приходится вести между корпусами.',
    applies: (s) => LOW_RISE.includes(s.typology),
    fragment:
      'several separate low pavilions connected by covered walkways, dispersed plan, landscape flowing between volumes',
  },
  {
    key: 'compact',
    title: 'Компактный объём',
    summary:
      'Одно плотное тело с минимальным периметром. Самая экономная геометрия по стоимости оболочки и по теплу.',
    tradeoff:
      'Меньше фасадного фронта и видовых точек. Планировка жёстче: перемещать стены почти негде.',
    applies: () => true,
    fragment:
      'compact single volume, minimal envelope, restrained geometry, precise proportions',
  },
  {
    key: 'linear',
    title: 'Линейный объём',
    summary:
      'Здание вытянуто вдоль участка одной полосой. Все основные помещения получают одну ориентацию и один вид.',
    tradeoff:
      'Длинные коммуникации и коридоры. Требует участка с выраженной длинной стороной.',
    applies: () => true,
    fragment:
      'long linear volume stretched along the site, continuous glazed facade on one side, repetitive structural rhythm',
  },
  {
    key: 'stacked',
    title: 'Ступенчатая этажность',
    summary:
      'Верхние этажи отступают внутрь, освобождая террасы. Объём теряет массивность к верху.',
    tradeoff:
      'Каждый отступ — это переход конструктивной схемы и узел, который надо решать отдельно.',
    applies: (s) => s.typology === 'multi_family' || s.typology === 'mixed_use',
    fragment:
      'stepped massing with setback upper floors forming large private terraces, tapering silhouette',
  },
  {
    key: 'podium',
    title: 'Объём на подиуме',
    summary:
      'Здание стоит на выраженном цоколе, который выравнивает участок и отделяет жилые уровни от земли.',
    tradeoff:
      'Подиум — это объём, который надо построить и в котором надо что-то разместить, иначе он становится дорогой пустотой.',
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
