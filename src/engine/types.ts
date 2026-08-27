import type {
  ClimateZone,
  Discipline,
  DocStage,
  GridConnection,
  IfcLevel,
  Jurisdiction,
  Language,
  MaterialSystem,
  RegulatoryTrack,
  RequiredRole,
  ScaleBand,
  Software,
  Specialization,
  Terrain,
  Typology,
  WorkMode,
} from './taxonomy'

/** Счётчики поставки. Инкрементируются событиями тикетов, руками не правятся. */
export type DeliveryCounters = {
  deliveredTickets: number
  onTimeTickets: number
  firstTimeRightTickets: number
  responseMinutesTotal: number
  revisionRoundsTotal: number
}

/** Специалист в том виде, в котором его читает движок: двенадцать измерений. */
export type SpecialistProfile = {
  id: string
  displayName: string
  // 1–12, в порядке концепта (п.8)
  disciplines: Discipline[]
  /** Второй уровень первого измерения: чем именно человек занимается внутри дисциплины. */
  specializations: Specialization[]
  typologies: Typology[]
  scaleBands: ScaleBand[]
  maxStoreys: number
  materialSystems: MaterialSystem[]
  climateZones: ClimateZone[]
  jurisdictions: Jurisdiction[]
  signsIn: Jurisdiction[]
  software: Software[]
  ifcLevel: IfcLevel
  docStages: DocStage[]
  regulatoryTracks: RegulatoryTrack[]
  languages: Language[]
  workMode: WorkMode
  utcOffset: number
  weeklyCapacityHours: number
  leadTimeDays: number

  portfolioRating: number
  delivery: DeliveryCounters
}

/** Бриф клиента, разобранный в требования (стадия Validate). */
export type ProjectRequirements = {
  typology: Typology
  storeys: number
  areaSqm: number
  jurisdiction: Jurisdiction
  climateZone: ClimateZone
  materialSystem: MaterialSystem
  regulatoryTrack: RegulatoryTrack
  targetStage: DocStage
  terrain: Terrain
  gridConnection: GridConnection
  software: Software[]
  languages: Language[]
  requiredHoursPerWeek: number
  horizonDays: number
  utcOffset: number
}

/**
 * Разбор балла. Показывается клиенту целиком (п.9): клиент, который видит,
 * почему ему собрали эту команду, не требует права выбрать самому.
 */
export type ScoreBreakdown = {
  portfolioRating: number
  deliveryScore: number
  /** Вес истории поставок в Quality. Ноль у специалиста без закрытых тикетов. */
  historyWeight: number
  /** Соответствие мягким измерениям таксономии, 0.4–1.0. */
  relevance: number
  quality: number
  availability: number
  score: number
}

export type GateName =
  | 'portfolio_threshold'
  | 'discipline'
  | 'specialization'
  | 'jurisdiction'
  | 'storeys'
  | 'doc_stage'
  | 'software_exchange'
  | 'language'
  | 'timezone_overlap'
  | 'availability'

export type ScoredCandidate = {
  specialist: SpecialistProfile
  role: RequiredRole
  discipline: Discipline
  passed: boolean
  failedGate: GateName | null
  breakdown: ScoreBreakdown
  rank: number
}

export type TeamMember = {
  specialist: SpecialistProfile
  role: RequiredRole
  discipline: Discipline
  isSignatory: boolean
  score: number
}

export type AssemblyOutcome = 'ok' | 'incomplete' | 'no_signatory' | 'rejected'

export type Assembly = {
  outcome: AssemblyOutcome
  notes: string
  pooledCount: number
  survivedCount: number
  requiredRoles: RequiredRole[]
  candidates: ScoredCandidate[]
  team: TeamMember[]
}
