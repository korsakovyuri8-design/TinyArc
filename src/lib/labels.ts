/**
 * Русские подписи к словарям таксономии.
 *
 * Живут отдельно от src/engine/taxonomy.ts: движок считает, интерфейс называет.
 * Смешивать нельзя — иначе переименование кнопки правит логику отбора.
 */

import type { GateName } from '@/engine/types'
import type {
  ClimateZone,
  Discipline,
  DocStage,
  IfcLevel,
  MaterialSystem,
  GridConnection,
  RegulatoryTrack,
  ScaleBand,
  Software,
  Specialization,
  Subscription,
  Terrain,
  Typology,
  WorkMode,
} from '@/engine/taxonomy'

export const DISCIPLINE_LABELS: Record<Discipline, string> = {
  architecture: 'Architecture',
  structural: 'Structures',
  mep: 'MEP',
  landscape: 'Landscape',
  interiors: 'Interiors',
  permitting: 'Permitting',
  survey: 'Survey',
  visualization: 'Visualisation',
  cost_estimation: 'Cost and quantities',
  dfma: 'Design for manufacture and assembly',
  energy: 'Energy performance',
}

/**
 * Специализации. Названия деловые, а не academic: специалист должен узнать
 * свою строку с первого взгляда, иначе он отметит не то, и отбор поедет.
 */
export const SPECIALIZATION_LABELS: Record<Specialization, string> = {
  structural_concrete: 'Cast-in-place and reinforced concrete',
  structural_steel: 'Steel and light-gauge framing',
  structural_timber: 'Timber, framing, CLT',
  mep_hvac: 'Heating, ventilation, air conditioning',
  mep_electrical: 'Electrical and lighting',
  mep_plumbing: 'Water supply and drainage',
  mep_off_grid: 'Off-grid systems',
  mep_smart_home: 'Home automation',
  arch_small_scale: 'Small-scale and modular',
  arch_large_scale: 'Urban-scale development',
  landscape_garden: 'Garden and grounds',
  landscape_master_planning: 'Site master planning',
  landscape_grading: 'Grading and drainage',
  interiors_residential: 'Residential interiors',
  interiors_product: 'Built-in furniture and product design',
  interiors_horeca: 'Public and hospitality spaces',
  viz_photoreal: 'Photorealistic',
  viz_artistic: 'Atmospheric',
  permit_zoning: 'Zoning review',
  permit_flood: 'Flood-risk approvals',
}

export const TERRAIN_LABELS: Record<Terrain, string> = {
  flat: 'Flat site',
  slope: 'Slope',
  flood_prone: 'Flood risk',
}

export const GRID_LABELS: Record<GridConnection, string> = {
  grid: 'Utility connections',
  off_grid: 'Off-grid',
}

export const AVAILABILITY_LABELS: Record<string, string> = {
  available: 'Available',
  part_time: 'Part-time',
  busy: 'Booked',
}

export const ARTIFACT_KIND_LABELS: Record<string, string> = {
  model: 'Model / DWG',
  sheet: 'Drawing',
  render: 'Visualisation',
  report: 'Calculation or report',
}

export const PORTFOLIO_KIND_LABELS: Record<string, string> = {
  render: '3D render',
  drawing: 'Drawings and sections',
  bim: 'Model screenshots',
  site: 'Site photographs',
}

export const TYPOLOGY_LABELS: Record<Typology, string> = {
  villa: 'Villa',
  townhouse: 'Townhouse',
  multi_family: 'Multi-family',
  mixed_use: 'Mixed-use',
}

export const SCALE_BAND_LABELS: Record<ScaleBand, string> = {
  upto_250: 'up to 250 m²',
  '250_1000': '250–1000 m²',
  '1000_3000': '1000–3000 m²',
  '3000_plus': 'over 3000 m²',
}

export const MATERIAL_LABELS: Record<MaterialSystem, string> = {
  concrete: 'Concrete',
  masonry: 'Masonry',
  timber: 'Timber',
  steel: 'Steel',
  hybrid: 'Hybrid',
}

export const CLIMATE_LABELS: Record<ClimateZone, string> = {
  mediterranean: 'Mediterranean',
  continental: 'Continental',
  alpine: 'Alpine',
  arid: 'Arid',
}

export const SOFTWARE_LABELS: Record<Software, string> = {
  revit: 'Revit',
  archicad: 'ArchiCAD',
  autocad: 'AutoCAD',
  rhino: 'Rhino',
  tekla: 'Tekla',
}

export const IFC_LABELS: Record<IfcLevel, string> = {
  none: 'no exchange',
  import: 'import',
  exchange: 'exchange',
  coordination: 'coordination',
}

export const DOC_STAGE_LABELS: Record<DocStage, string> = {
  concept: 'Concept',
  permit: 'Permit',
  tender: 'Tender',
  construction: 'Construction documentation',
}

export const REGULATORY_LABELS: Record<RegulatoryTrack, string> = {
  light: 'Light regulation',
  standard: 'Standard regulation',
}

export const WORK_MODE_LABELS: Record<WorkMode, string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
}

export const TICKET_STATUS_LABELS: Record<string, string> = {
  blocked: 'Waiting on a dependency',
  open: 'Open, unclaimed',
  in_progress: 'In progress',
  submitted: 'Submitted',
  revision: 'Sent back for revision',
  accepted: 'Accepted',
}

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  draft: 'Brief accepted',
  rejected: 'Outside the product boundary',
  assembled: 'Team assembled',
  delivering: 'In production',
  delivered: 'Closed',
}

/**
 * Поводы для письма — словами, а не ключами.
 *
 * Ключ повода живёт в базе и в коде; в панели он читается человеком, который
 * по этому списку решает, кого сегодня позвать руками.
 */
export const NOTIFICATION_LABELS: Record<string, string> = {
  invoice_issued: 'Invoice issued',
  invoice_paid: 'Payment received',
  stage_awaiting: 'Stage awaits your confirmation',
  ticket_open: 'Task opened',
  ticket_accepted: 'Work accepted',
  ticket_revision: 'Work sent back for revision',
  ticket_comment: 'The bureau wrote in the ticket',
  client_answer: 'The bureau answered',
  conflict_resolved: 'The arbiter ruled',
  application_declined: 'Application declined',
}

export const SPECIALIST_STATUS_LABELS: Record<string, string> = {
  invited: 'Invited, profile incomplete',
  pending: 'Application under review',
  active: 'In the pool',
  paused: 'Paused at their request',
  rejected: 'Below the portfolio threshold',
  removed: 'Anonymised at their request',
}

export const OUTCOME_LABELS: Record<string, string> = {
  ok: 'Team assembled',
  incomplete: 'A discipline is uncovered',
  no_signatory: 'No signing rights in this jurisdiction',
  rejected: 'Project is outside the product boundary',
}

/** Три стадии продукта. Внутреннее имя и публичное (концепт, п.7). */
export const STAGES = [
  { internal: 'Validate', public: 'Filter', note: 'The brief becomes requirements; hard gates cut the pool down' },
  { internal: 'Assemble', public: 'Score', note: 'Survivors are ranked on Quality × Availability; the Tiny Team is assembled' },
  { internal: 'Deliver', public: 'Relay', note: 'The team runs the project on the Blind Relay Protocol through to the documentation set' },
] as const

/**
 * Подписка на доступ к проектам.
 *
 * Названа состоянием доступа, а не тарифом: «нет подписки» человеку в панели
 * читается как «нет доступа», и это ровно то, что происходит.
 */
export const SUBSCRIPTION_LABELS: Record<Subscription, string> = {
  none: 'No access',
  founding: 'Free during the pilot',
  active: 'Paid access',
}

/**
 * Почему специалист не прошёл гейт.
 *
 * Названия живут здесь, а не рядом с проверками: движок считает, интерфейс
 * называет. Порог подставляется на месте показа — вписанный в строку числом,
 * он разошёлся бы с движком в тот день, когда порог изменят.
 */
export const GATE_LABELS: Record<GateName, string> = {
  portfolio_threshold: 'Portfolio below {threshold}/10',
  discipline: 'Does not work in this discipline',
  specialization: 'Right discipline, wrong specialisation',
  jurisdiction: 'Has not taken approvals through in this country',
  storeys: 'No proven experience at this number of storeys',
  doc_stage: 'Does not carry documentation to the stage required',
  language: 'No language in common with the client or the authorities',
  timezone_overlap: 'Working-hours overlap below the working minimum',
  availability: 'No free capacity, or cannot start in time',
  subscription: 'No active subscription for access to projects',
}

/**
 * Как называется предмет нормы для человека.
 *
 * Заказчик читает «Site coverage», а не `coverage_ratio`: словарь движка — это
 * словарь движка, и показывать его наружу значит показывать внутренности.
 */
export const RULE_SUBJECT_LABELS: Record<string, string> = {
  storeys: 'Storeys',
  height_m: 'Building height',
  coverage_ratio: 'Site coverage',
  floor_area_ratio: 'Floor area ratio',
  setback_front_m: 'Front setback',
  setback_side_m: 'Side setback',
  setback_rear_m: 'Rear setback',
  parking_per_unit: 'Parking per unit',
  green_ratio: 'Green area share',
}

/** В чём измеряется предмет: доли показываются процентами, метры — метрами. */
export const RULE_SUBJECT_UNIT: Record<string, 'ratio' | 'metres' | 'count'> = {
  storeys: 'count',
  height_m: 'metres',
  coverage_ratio: 'ratio',
  floor_area_ratio: 'ratio',
  setback_front_m: 'metres',
  setback_side_m: 'metres',
  setback_rear_m: 'metres',
  parking_per_unit: 'count',
  green_ratio: 'ratio',
}

/**
 * Чего не хватило, названное словами заказчика.
 *
 * Имя поля базы человеку ничего не говорит, а принести он должен вполне
 * конкретную вещь. Без этого перевода «needs_input» превращается в «что-то не
 * так», то есть в ничто.
 */
export const SITE_INPUT_LABELS: Record<string, string> = {
  storeys: 'number of storeys',
  heightM: 'building height',
  coverageRatio: 'plot area and building footprint',
  floorAreaRatio: 'plot area',
  setbackFrontM: 'distance to the front boundary',
  setbackSideM: 'distance to the side boundary',
  setbackRearM: 'distance to the rear boundary',
  parkingPerUnit: 'number of units and parking spaces',
  greenRatio: 'plot area and green area',
}
