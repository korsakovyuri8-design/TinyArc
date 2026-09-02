/**
 * Что проекту понадобится построить: работы и группы материалов (п.14б).
 *
 * Выводится из самого проекта, а не спрашивается заново. К моменту выдачи
 * комплекта мы знаем о стройке больше, чем кто-либо: типологию, площади,
 * материальную систему, инженерию и стадию, — и из этого следует состав
 * подрядчиков. У обычного порядка этого нет вовсе, потому что проектировщик и
 * снабженец в нём не связаны.
 *
 * Объёмов здесь нет, и это решение, а не пробел. Приблизительная ведомость,
 * названная точной, — это спор на приёмке и потерянный заказчик; настоящие
 * объёмы даёт рабочая документация, и приходят они оттуда, а не из
 * коэффициента, вписанного по памяти. Пока комплект их не несёт, ведомость
 * говорит, что покупать, и молчит про сколько.
 */

import type { GridConnection, MaterialSystem, Terrain, Typology } from './taxonomy'

/** Работы на стройке. Словарь закрыт: свободный текст непроверяем и несравним. */
export const TRADES = [
  'earthworks',
  'foundations',
  'structure',
  'masonry',
  'roofing',
  'waterproofing',
  'facade',
  'joinery',
  'electrical',
  'plumbing',
  'hvac',
  'finishes',
  'landscaping',
  'utility_connection',
] as const
export type Trade = (typeof TRADES)[number]

/** Работы, которые есть на любой стройке в нашей продуктовой границе. */
const ALWAYS: Trade[] = [
  'earthworks',
  'foundations',
  'structure',
  'roofing',
  'waterproofing',
  'facade',
  'joinery',
  'electrical',
  'plumbing',
  'finishes',
]

/**
 * Работы от материальной системы.
 *
 * Кладка есть не всегда: у каркасного дома стены собираются, а не кладутся, и
 * ставить каменщика в состав значит звать человека, которому нечего делать.
 */
const BY_MATERIAL: Record<MaterialSystem, Trade[]> = {
  concrete: ['masonry'],
  masonry: ['masonry'],
  timber: [],
  steel: [],
  hybrid: ['masonry'],
}

/** Группа материалов: то, что закупается, а не то, что делается. */
export const MATERIAL_GROUPS = [
  'concrete_rebar',
  'blocks_mortar',
  'timber',
  'steel',
  'insulation',
  'waterproofing',
  'roofing',
  'windows_doors',
  'cladding',
  'electrical',
  'plumbing',
  'hvac',
  'finishes',
  'landscape',
] as const
export type MaterialGroup = (typeof MATERIAL_GROUPS)[number]

const GROUPS_ALWAYS: MaterialGroup[] = [
  'insulation',
  'waterproofing',
  'roofing',
  'windows_doors',
  'electrical',
  'plumbing',
  'finishes',
]

const GROUPS_BY_MATERIAL: Record<MaterialSystem, MaterialGroup[]> = {
  concrete: ['concrete_rebar', 'blocks_mortar'],
  masonry: ['blocks_mortar'],
  timber: ['timber'],
  steel: ['steel'],
  hybrid: ['concrete_rebar', 'timber', 'steel'],
}

/** Проект в объёме, из которого следует состав стройки. */
export type BuildShape = {
  typology: Typology
  storeys: number
  areaSqm: number
  materialSystem: MaterialSystem
  terrain: Terrain
  gridConnection: GridConnection
}

function sorted<T extends string>(values: Iterable<T>, order: readonly T[]): T[] {
  return [...new Set(values)].sort((a, b) => order.indexOf(a) - order.indexOf(b))
}

/**
 * Какие работы понадобятся.
 *
 * Отдельно названы два случая, которые обычно всплывают на площадке, когда
 * подрядчик уже выбран: автономка требует своего подключения — скважина,
 * септик, генерация, — а не врезки в городские сети, и это другой подрядчик;
 * склон добавляет вертикальную планировку с подпорными стенками, а вместе с
 * ней и работы, которых на ровном участке нет.
 */
export function tradesFor(shape: BuildShape): Trade[] {
  const trades: Trade[] = [...ALWAYS, ...BY_MATERIAL[shape.materialSystem]]

  // Отопление и вентиляция как отдельная работа появляются там, где есть что
  // разводить: на многоквартирном и смешанном это всегда, на вилле — по
  // системе, но отдельным подрядчиком, а не «электрикой заодно».
  trades.push('hvac')

  if (shape.typology !== 'villa' || shape.areaSqm > 250) trades.push('landscaping')
  if (shape.terrain === 'slope') trades.push('landscaping')

  trades.push('utility_connection')

  return sorted(trades, TRADES)
}

/** Что придётся закупать. Группами, без объёмов. */
export function materialGroupsFor(shape: BuildShape): MaterialGroup[] {
  const groups: MaterialGroup[] = [
    ...GROUPS_ALWAYS,
    ...GROUPS_BY_MATERIAL[shape.materialSystem],
    'hvac',
    'cladding',
  ]

  if (tradesFor(shape).includes('landscaping')) groups.push('landscape')

  return sorted(groups, MATERIAL_GROUPS)
}
