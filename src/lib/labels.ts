/**
 * Русские подписи к словарям таксономии.
 *
 * Живут отдельно от src/engine/taxonomy.ts: движок считает, интерфейс называет.
 * Смешивать нельзя — иначе переименование кнопки правит логику отбора.
 */

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
  Terrain,
  Typology,
  WorkMode,
} from '@/engine/taxonomy'

export const DISCIPLINE_LABELS: Record<Discipline, string> = {
  architecture: 'Архитектура',
  structural: 'Конструкции',
  mep: 'Инженерия (MEP)',
  landscape: 'Ландшафт',
  interiors: 'Интерьеры',
  permitting: 'Согласования',
  survey: 'Геодезия',
  visualization: 'Визуализация',
}

/**
 * Специализации. Названия деловые, а не academic: специалист должен узнать
 * свою строку с первого взгляда, иначе он отметит не то, и отбор поедет.
 */
export const SPECIALIZATION_LABELS: Record<Specialization, string> = {
  structural_concrete: 'Монолит и железобетон',
  structural_steel: 'Металл и ЛСТК',
  structural_timber: 'Дерево, каркас, CLT',
  mep_hvac: 'Отопление, вентиляция, кондиционирование',
  mep_electrical: 'Электрика и освещение',
  mep_plumbing: 'Водоснабжение и канализация',
  mep_off_grid: 'Автономные системы',
  mep_smart_home: 'Умный дом',
  arch_small_scale: 'Малые формы и модульное',
  arch_large_scale: 'Городская застройка',
  landscape_garden: 'Сад и благоустройство',
  landscape_master_planning: 'Генплан территории',
  landscape_grading: 'Вертикальная планировка и дренаж',
  interiors_residential: 'Жилые интерьеры',
  interiors_product: 'Встроенная мебель и предметный дизайн',
  interiors_horeca: 'Общественные пространства',
  viz_photoreal: 'Фотореализм',
  viz_artistic: 'Атмосферная подача',
  permit_zoning: 'Проверка зонирования',
  permit_flood: 'Согласования по риску подтопления',
}

export const TERRAIN_LABELS: Record<Terrain, string> = {
  flat: 'Ровный участок',
  slope: 'Склон',
  flood_prone: 'Риск подтопления',
}

export const GRID_LABELS: Record<GridConnection, string> = {
  grid: 'Городские сети',
  off_grid: 'Автономно',
}

export const AVAILABILITY_LABELS: Record<string, string> = {
  available: 'Свободен',
  part_time: 'Частично',
  busy: 'Занят',
}

export const ARTIFACT_KIND_LABELS: Record<string, string> = {
  model: 'Модель / DWG',
  sheet: 'Чертёж',
  render: 'Визуализация',
  report: 'Расчёт или записка',
}

export const PORTFOLIO_KIND_LABELS: Record<string, string> = {
  render: '3D-рендер',
  drawing: 'Чертежи и разрезы',
  bim: 'Скриншоты модели',
  site: 'Фото со стройки',
}

export const TYPOLOGY_LABELS: Record<Typology, string> = {
  villa: 'Вилла',
  townhouse: 'Townhouse',
  multi_family: 'Multi-family',
  mixed_use: 'Mixed-use',
}

export const SCALE_BAND_LABELS: Record<ScaleBand, string> = {
  upto_250: 'до 250 м²',
  '250_1000': '250–1000 м²',
  '1000_3000': '1000–3000 м²',
  '3000_plus': 'от 3000 м²',
}

export const MATERIAL_LABELS: Record<MaterialSystem, string> = {
  concrete: 'Монолит',
  masonry: 'Кладка',
  timber: 'Дерево',
  steel: 'Сталь',
  hybrid: 'Гибрид',
}

export const CLIMATE_LABELS: Record<ClimateZone, string> = {
  mediterranean: 'Средиземноморская',
  continental: 'Континентальная',
  alpine: 'Альпийская',
  arid: 'Засушливая',
}

export const SOFTWARE_LABELS: Record<Software, string> = {
  revit: 'Revit',
  archicad: 'ArchiCAD',
  autocad: 'AutoCAD',
  rhino: 'Rhino',
  tekla: 'Tekla',
}

export const IFC_LABELS: Record<IfcLevel, string> = {
  none: 'нет обмена',
  import: 'импорт',
  exchange: 'обмен',
  coordination: 'координация',
}

export const DOC_STAGE_LABELS: Record<DocStage, string> = {
  concept: 'Концепция',
  permit: 'Разрешение',
  tender: 'Тендер',
  construction: 'Рабочая документация',
}

export const REGULATORY_LABELS: Record<RegulatoryTrack, string> = {
  light: 'Лёгкое регулирование',
  standard: 'Стандартное регулирование',
}

export const WORK_MODE_LABELS: Record<WorkMode, string> = {
  remote: 'Удалённо',
  hybrid: 'Гибрид',
}

export const TICKET_STATUS_LABELS: Record<string, string> = {
  blocked: 'Ждёт зависимости',
  open: 'Открыт, не взят',
  in_progress: 'В работе',
  submitted: 'Предъявлен',
  revision: 'Возвращён на круг',
  accepted: 'Принят',
}

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  draft: 'Бриф принят',
  rejected: 'Вне продуктовой границы',
  assembled: 'Команда собрана',
  delivering: 'Идёт выпуск',
  delivered: 'Закрыт',
}

export const SPECIALIST_STATUS_LABELS: Record<string, string> = {
  pending: 'Заявка на разборе',
  active: 'В пуле',
  paused: 'Снят по своей просьбе',
  rejected: 'Не прошёл порог портфолио',
}

export const OUTCOME_LABELS: Record<string, string> = {
  ok: 'Команда собрана',
  incomplete: 'Дисциплина не закрыта',
  no_signatory: 'Нет права подписи в юрисдикции',
  rejected: 'Проект вне продуктовой границы',
}

/** Три стадии продукта. Внутреннее имя и публичное (концепт, п.7). */
export const STAGES = [
  { internal: 'Validate', public: 'Filter', note: 'Бриф становится требованиями, пул отсекается жёсткими гейтами' },
  { internal: 'Assemble', public: 'Score', note: 'Выжившие ранжируются по Quality × Availability, собирается Tiny Team' },
  { internal: 'Deliver', public: 'Relay', note: 'Команда ведёт проект по Blind Relay Protocol до пакета документации' },
] as const
