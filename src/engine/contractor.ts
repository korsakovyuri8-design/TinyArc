/**
 * Отбор подрядчика (п.14б).
 *
 * Считается той же конструкцией, что состав команды: жёсткие гейты, потом
 * балл, потом список. Разница одна и она в том, кто платит: заказчик платит за
 * доступ к отбору, подрядчик не платит за место в нём.
 *
 * **Поля «оплаченная позиция» здесь нет, и это не забывчивость.** Всё здание
 * стоит на том, что отбор считается и его арифметику видно. Проданное место в
 * выдаче убивает доверие не только к списку подрядчиков — по соседству оно
 * убивает доверие и к подбору специалистов, потому что человек не различает
 * два движка на одном экране. Как и в Blind Relay, защита структурная: тут
 * нечего вызвать и нечего проставить.
 *
 * Ответственность за стройку мы не берём. Мы отвечаем за комплект и за то, что
 * список посчитан честно; договор на работы заказчик заключает сам.
 */

import { SCALE_BANDS, scaleBandFor, type Jurisdiction, type ScaleBand, type Typology } from './taxonomy'
import { clamp01, deliveryMetrics, deliveryScore, historyWeight } from './metrics'
import type { DeliveryCounters } from './types'
import type { BuildShape, Trade } from './trades'

/** Порог по портфолио, тот же, что у специалиста: ниже входа нет. */
export const CONTRACTOR_THRESHOLD = 8

/** Нижняя граница соответствия: одно несовпадение не обнуляет сильного. */
export const CONTRACTOR_RELEVANCE_FLOOR = 0.4

export type ContractorProfile = {
  id: string
  displayName: string
  /** Какие работы ведёт. Одна бригада редко закрывает всю стройку. */
  trades: Trade[]
  /** Где имеет право работать: регистрация и допуски. */
  jurisdictions: Jurisdiction[]
  /** Муниципалитеты, где реально работал. Пусто — по всей стране. */
  municipalities: string[]
  typologies: Typology[]
  scaleBands: ScaleBand[]
  /** Оценка портфолио, 0–10. Ставит бюро, как и специалисту. */
  portfolioRating: number
  /**
   * Действует ли страховка ответственности.
   *
   * Гейт, а не признак. Подрядчик без страховки на объекте, за комплект
   * которого отвечаем мы, — это наш риск, оплаченный заказчиком.
   */
  insured: boolean
  /** Свободен ли брать работу. */
  available: boolean
  delivery: DeliveryCounters
}

/** Почему подрядчик не прошёл. Причина называется, а не скрывается. */
export type ContractorRejection =
  | 'jurisdiction'
  | 'insurance'
  | 'trade'
  | 'portfolio'
  | 'availability'

export type ContractorNeed = {
  trade: Trade
  jurisdiction: Jurisdiction
  municipality?: string
  shape: BuildShape
}

/**
 * Жёсткие гейты.
 *
 * Порядок причин выбран так же, как у специалиста: сначала то, что вообще не
 * про профессию. Право работать в стране и действующая страховка проверяются
 * раньше портфолио, чтобы никому не сказали «вы не прошли отбор», когда на
 * самом деле у него просрочен полис.
 */
export function contractorGate(
  contractor: ContractorProfile,
  need: ContractorNeed,
): ContractorRejection | null {
  if (!contractor.jurisdictions.includes(need.jurisdiction)) return 'jurisdiction'
  if (!contractor.insured) return 'insurance'
  if (!contractor.trades.includes(need.trade)) return 'trade'
  if (contractor.portfolioRating < CONTRACTOR_THRESHOLD) return 'portfolio'
  if (!contractor.available) return 'availability'
  return null
}

/** Соседний диапазон площади — половина совпадения: масштаб непрерывен. */
function scaleMatch(bands: ScaleBand[], areaSqm: number): number {
  const needed = scaleBandFor(areaSqm)
  if (bands.includes(needed)) return 1

  const index = SCALE_BANDS.indexOf(needed)
  const neighbour = bands.some(
    (band) => Math.abs(SCALE_BANDS.indexOf(band) - index) === 1,
  )

  return neighbour ? 0.5 : 0
}

export type ContractorScore = {
  contractorId: string
  /** Портфолио и метрики поставки, сведённые весом истории. */
  quality: number
  /** Насколько подходит проекту: типология, масштаб, местность. */
  relevance: number
  /** Итог, 0–100. */
  score: number
  /** Сколько работ из нужных он закрывает: чем больше, тем меньше стыков. */
  coveredTrades: number
}

/**
 * Балл подрядчика.
 *
 * Качество считается из событий, как у специалиста: пока сданных объектов нет,
 * вес истории нулевой и качество — это портфолио. Врать про «рейтинг 4,9» на
 * пустой истории мы не будем ни здесь, ни там.
 *
 * Местный опыт входит в соответствие отдельным слагаемым: подрядчик, который
 * уже работал в этом муниципалитете, знает и инспекцию, и поставщиков, и это
 * ровно та разница, за которой к нему идут.
 */
export function scoreContractor(
  contractor: ContractorProfile,
  need: ContractorNeed,
  needed: Trade[],
): ContractorScore {
  const weight = historyWeight(contractor.delivery)
  const quality =
    weight === 0
      ? contractor.portfolioRating
      : (1 - weight) * contractor.portfolioRating +
        weight * deliveryScore(deliveryMetrics(contractor.delivery))

  const typology = contractor.typologies.includes(need.shape.typology) ? 1 : 0
  const scale = scaleMatch(contractor.scaleBands, need.shape.areaSqm)
  const local =
    need.municipality && contractor.municipalities.includes(need.municipality) ? 1 : 0

  const relevance = clamp01(
    CONTRACTOR_RELEVANCE_FLOOR +
      (1 - CONTRACTOR_RELEVANCE_FLOOR) * (0.45 * typology + 0.35 * scale + 0.2 * local),
  )

  return {
    contractorId: contractor.id,
    quality,
    relevance,
    score: Math.round(quality * 10 * relevance * 10) / 10,
    coveredTrades: needed.filter((trade) => contractor.trades.includes(trade)).length,
  }
}

export type Shortlist = {
  trade: Trade
  /** Прошедшие гейт, по убыванию балла. */
  ranked: ContractorScore[]
  /** Сколько было в выборке до гейтов: число, а не ощущение. */
  pooled: number
  /** Почему остальные не прошли. Для бюро, не для заказчика. */
  rejected: Record<ContractorRejection, number>
}

/** Сколько подрядчиков показывается заказчику на одну работу. */
export const SHORTLIST_SIZE = 3

/**
 * Список под одну работу.
 *
 * Трое, а не двадцать. Двадцать — это не выбор, а перекладывание отбора обратно
 * на заказчика: ровно то, чем занимается биржа и за что ему не за что нам
 * платить.
 */
export function shortlist(
  contractors: ContractorProfile[],
  need: ContractorNeed,
  needed: Trade[],
  size = SHORTLIST_SIZE,
): Shortlist {
  const rejected: Record<ContractorRejection, number> = {
    jurisdiction: 0,
    insurance: 0,
    trade: 0,
    portfolio: 0,
    availability: 0,
  }

  const passed: ContractorProfile[] = []

  for (const contractor of contractors) {
    const reason = contractorGate(contractor, need)
    if (reason) {
      rejected[reason] += 1
      continue
    }
    passed.push(contractor)
  }

  const ranked = passed
    .map((contractor) => scoreContractor(contractor, need, needed))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.coveredTrades - a.coveredTrades ||
        a.contractorId.localeCompare(b.contractorId),
    )
    .slice(0, size)

  return { trade: need.trade, ranked, pooled: contractors.length, rejected }
}
