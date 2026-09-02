/**
 * Сеть подрядчиков и короткий список под проект (п.14б).
 *
 * Служба знает про базу и ничего не решает сама: гейты, балл и длина списка —
 * в `src/engine/contractor.ts`. Здесь выборка, перевод строки в профиль и
 * сборка списков по работам, которые проекту понадобятся.
 */

import {
  shortlist,
  type ContractorProfile,
  type Shortlist,
} from '@/engine/contractor'
import { TRADES, materialGroupsFor, tradesFor, type BuildShape, type MaterialGroup, type Trade } from '@/engine/trades'
import {
  SCALE_BANDS,
  TYPOLOGIES,
  JURISDICTIONS,
  type Jurisdiction,
  type ScaleBand,
  type Typology,
} from '@/engine/taxonomy'
import { prisma } from '../db'
import { parseList } from '../rows'

type ContractorRow = {
  id: string
  displayName: string
  tradesJson: string
  jurisdictionsJson: string
  municipalitiesJson: string
  typologiesJson: string
  scaleBandsJson: string
  portfolioRating: number
  insured: boolean
  insuredUntil: Date | null
  available: boolean
  deliveredTickets: number
  onTimeTickets: number
  firstTimeRightTickets: number
  responseMinutesTotal: number
  revisionRoundsTotal: number
}

/**
 * Свободные строки — муниципалитеты — разбираются иначе, чем словарные.
 *
 * Словарь городов закрыть нельзя: их тысячи, и в каждой стране свои. Поэтому
 * список читается как есть, с обрезкой пустых, — а сравнение идёт точным
 * совпадением, потому что «Бар» и «Бар, Черногория» это две записи и ноль
 * совпадений, ровно как с тегами в п.8.
 */
function parseFree(json: string): string[] {
  try {
    const value: unknown = JSON.parse(json)
    if (!Array.isArray(value)) return []
    return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
  } catch {
    return []
  }
}

/**
 * Действует ли полис на дату.
 *
 * Галочка «застрахован», поставленная однажды, вечна; полис — нет. Просроченный
 * гасит страховку сам, и подрядчик уходит из выборки без чьего-либо участия.
 * Пустая дата означает «срок неизвестен» и доверия не добавляет.
 */
export function insuredOn(row: { insured: boolean; insuredUntil: Date | null }, now: Date): boolean {
  if (!row.insured) return false
  if (!row.insuredUntil) return false
  return row.insuredUntil.getTime() >= now.getTime()
}

export function toContractor(row: ContractorRow, now: Date): ContractorProfile {
  return {
    id: row.id,
    displayName: row.displayName,
    trades: parseList<Trade>(row.tradesJson, TRADES),
    jurisdictions: parseList<Jurisdiction>(row.jurisdictionsJson, JURISDICTIONS),
    municipalities: parseFree(row.municipalitiesJson),
    typologies: parseList<Typology>(row.typologiesJson, TYPOLOGIES),
    scaleBands: parseList<ScaleBand>(row.scaleBandsJson, SCALE_BANDS),
    portfolioRating: row.portfolioRating,
    insured: insuredOn(row, now),
    available: row.available,
    delivery: {
      deliveredTickets: row.deliveredTickets,
      onTimeTickets: row.onTimeTickets,
      firstTimeRightTickets: row.firstTimeRightTickets,
      responseMinutesTotal: row.responseMinutesTotal,
      revisionRoundsTotal: row.revisionRoundsTotal,
    },
  }
}

export type ProjectBuild = {
  /** Что понадобится строить. */
  trades: Trade[]
  /** Что понадобится закупать. Группами, без объёмов: их даёт рабочая документация. */
  groups: MaterialGroup[]
  /** По списку на каждую работу. */
  lists: Shortlist[]
  /** Сколько подрядчиков в сети всего: пустой список и пустая сеть — разное. */
  networkSize: number
  /**
   * Имена по идентификатору.
   *
   * Отдаются вместе со списком, а не добираются страницей вторым запросом:
   * балл без имени — это строка, которую невозможно прочитать, а движок имён
   * не знает и знать не должен.
   */
  names: Record<string, string>
}

/**
 * Короткие списки под проект.
 *
 * Выборка сужается страной запросом: подрядчик из другой юрисдикции не пройдёт
 * гейт всё равно, а читать всю сеть ради этого незачем.
 */
export async function buildFor(
  project: {
    id: string
    typology: string
    storeys: number
    areaSqm: number
    materialSystem: string
    terrain: string
    gridConnection: string
    jurisdiction: string
    municipality: string | null
  },
  now = new Date(),
): Promise<ProjectBuild> {
  const shape: BuildShape = {
    typology: project.typology as Typology,
    storeys: project.storeys,
    areaSqm: project.areaSqm,
    materialSystem: project.materialSystem as BuildShape['materialSystem'],
    terrain: project.terrain as BuildShape['terrain'],
    gridConnection: project.gridConnection as BuildShape['gridConnection'],
  }

  const trades = tradesFor(shape)

  const rows = await prisma.contractor.findMany({
    where: { status: 'active', jurisdictionsJson: { contains: project.jurisdiction } },
  })

  const network = rows.map((row) => toContractor(row, now))

  const lists = trades.map((trade) =>
    shortlist(
      network,
      {
        trade,
        jurisdiction: project.jurisdiction as Jurisdiction,
        municipality: project.municipality ?? undefined,
        shape,
      },
      trades,
    ),
  )

  return {
    trades,
    groups: materialGroupsFor(shape),
    lists,
    networkSize: network.length,
    names: Object.fromEntries(network.map((row) => [row.id, row.displayName])),
  }
}
