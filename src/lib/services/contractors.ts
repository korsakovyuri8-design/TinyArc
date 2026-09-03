/**
 * Сеть подрядчиков и короткий список под проект (п.14б).
 *
 * Служба знает про базу и ничего не решает сама: гейты, балл и длина списка —
 * в `src/engine/contractor.ts`. Здесь выборка, перевод строки в профиль и
 * сборка списков по работам, которые проекту понадобятся.
 */

import {
  CONTRACTOR_THRESHOLD,
  shortlist,
  type ContractorProfile,
  type Shortlist,
} from '@/engine/contractor'
import { TRADES, materialGroupsFor, tradesFor, type BuildShape, type MaterialGroup, type Trade } from '@/engine/trades'
import { networkReadiness, tradeDepth, type TradeDepth } from '@/engine/network'
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
  trades: { trade: string }[]
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
    trades: row.trades.map((row) => row.trade).filter((trade): trade is Trade => (TRADES as readonly string[]).includes(trade)),
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

/** Сколько подрядчиков читается на одну работу до расчёта балла. */
export const CANDIDATES_PER_TRADE = 60

export type TradeShortlist = Shortlist & {
  /** Сколько подрядчиков страны вообще ведут эту работу — счётом по базе. */
  inScope: number
  /**
   * Сколько из них проходят все жёсткие гейты — тоже счётом по базе, а не по
   * прочитанному. Иначе потолок выборки читался бы как размер сети.
   */
  eligible: number
  names: Record<string, string>
}

export type ProjectBuild = {
  /** Что понадобится строить. */
  trades: Trade[]
  /** Что понадобится закупать. Группами, без объёмов: их даёт рабочая документация. */
  groups: MaterialGroup[]
  /** По списку на каждую работу. */
  lists: TradeShortlist[]
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

  /*
   * Что уходит в запрос, а что остаётся движку, решается одним вопросом:
   * говорит ли отказ о дыре в сети.
   *
   * Работа, страна и снятие с отбора — не говорят. Кровельщик не дыра на
   * фундаментах, сербская фирма не дыра в Черногории, снятый по своей просьбе
   * — решение бюро, а не нехватка. Их отбирает запрос по индексу, и они до
   * движка не доходят вовсе.
   *
   * Страховка, занятость и портфолио — говорят, и ещё как. «У одного из трёх
   * просрочен полис» лечится звонком, а не наймом, и это самая полезная строка
   * сводки. Перенос этих гейтов в запрос делал выборку быстрой и слепой:
   * подрядчик исчезал молча, а бюро видело пустой список без причины. Поэтому
   * они считаются движком, по прочитанным кандидатам.
   *
   * Потолок нужен потому, что одну работу в большой стране ведут тысячи. Он
   * снимается по портфолио — осознанное упрощение: балл это качество ×
   * соответствие, и соответствие может перевесить рейтинг. Потолок щедрый, на
   * пилоте до него не доходит, а оба честных числа — сколько ведут работу и
   * сколько из них годны — берутся счётом по базе.
   */
  const lists = await Promise.all(
    trades.map(async (trade) => {
      const scope = {
        status: 'active',
        jurisdictionsJson: { contains: project.jurisdiction },
        trades: { some: { trade } },
      } as const

      const [inScope, eligible, rows] = await Promise.all([
        prisma.contractor.count({ where: scope }),
        prisma.contractor.count({
          where: {
            ...scope,
            available: true,
            insured: true,
            insuredUntil: { gte: now },
            portfolioRating: { gte: CONTRACTOR_THRESHOLD },
          },
        }),
        prisma.contractor.findMany({
          where: scope,
          orderBy: { portfolioRating: 'desc' },
          take: CANDIDATES_PER_TRADE,
          include: { trades: { select: { trade: true } } },
        }),
      ])

      const candidates = rows.map((row) => toContractor(row, now))

      const list = shortlist(
        candidates,
        {
          trade,
          jurisdiction: project.jurisdiction as Jurisdiction,
          municipality: project.municipality ?? undefined,
          shape,
        },
        trades,
      )

      return {
        ...list,
        inScope,
        eligible,
        names: Object.fromEntries(candidates.map((row) => [row.id, row.displayName])),
      }
    }),
  )

  return {
    trades,
    groups: materialGroupsFor(shape),
    lists,
    names: Object.assign({}, ...lists.map((list) => list.names)) as Record<string, string>,
  }
}

/** Готовность сети по стране: строка на работу плюс одно число. */
export type NetworkReadiness = {
  jurisdiction: Jurisdiction
  depth: TradeDepth[]
  /** Доля закрытых работ, 0…1. */
  score: number
  /** Сколько подрядчиков в сети этой страны. */
  size: number
}

/**
 * Готовность сети по каждой стране запуска.
 *
 * Читается вся сеть страны, и это тот случай, когда так и надо: вопрос «чего
 * нам не хватает вообще» по определению про всю сеть, а не про кандидатов под
 * один проект. Растёт это медленно — числом стран, а не числом проектов, — и
 * страница открывается одна, а не на каждый проект.
 *
 * Считается по заявленным работам, а не по строкам таблицы работ: подрядчик,
 * заявивший кровлю и фундаменты, — один человек в обеих строках, и глубину он
 * даёт обеим.
 */
export async function networkReadinessByCountry(now = new Date()): Promise<NetworkReadiness[]> {
  const rows = await prisma.contractor.findMany({
    where: { status: 'active' },
    include: { trades: { select: { trade: true } } },
  })

  const all = rows.map((row) => ({ row, profile: toContractor(row, now) }))

  return JURISDICTIONS.map((jurisdiction) => {
    const inCountry = all
      .filter(({ profile }) => profile.jurisdictions.includes(jurisdiction))
      .map(({ profile }) => profile)

    return {
      jurisdiction,
      depth: tradeDepth(inCountry),
      score: networkReadiness(inCountry),
      size: inCountry.length,
    }
  })
}
