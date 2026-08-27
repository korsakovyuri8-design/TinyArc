/**
 * Blind Relay Protocol (концепт, п.11). Публичное имя стадии — Relay.
 *
 * Три правила протокола:
 *
 *  1. Никаких прямых чатов между специалистами. В схеме нет модели личного
 *     сообщения — здесь нет функции, которая бы её создала.
 *  2. Вся коммуникация привязана к тикету.
 *  3. Тикет не открывается, пока не приняты тикеты, от которых он зависит.
 *
 * Этот модуль — чистая логика: план графа, гейты и переходы состояния. Записью
 * в базу занимается src/lib/services/relay.ts.
 */

import {
  DOC_STAGE_ORDER,
  stagesUpTo,
  unique,
  type Discipline,
  type DocStage,
  type Typology,
} from './taxonomy'

export type TicketStatus = 'blocked' | 'open' | 'submitted' | 'revision' | 'accepted'

export type TicketPlan = {
  /** Устойчивый ключ внутри плана: по нему связываются зависимости. */
  key: string
  discipline: Discipline
  stage: DocStage
  title: string
  spec: string
  slaDays: number
  dependsOn: string[]
}

/** Какие дисциплины работают на какой стадии. */
const STAGE_SCOPE: Record<DocStage, Discipline[]> = {
  concept: ['architecture', 'visualization'],
  permit: ['survey', 'architecture', 'structural', 'mep', 'landscape', 'permitting'],
  tender: ['architecture', 'structural', 'mep'],
  construction: ['architecture', 'structural', 'mep', 'interiors'],
}

/**
 * Порядок внутри стадии. Он же задаёт зависимости: геодезия даёт подоснову,
 * архитектура — объём, смежники считают по объёму, согласования собирают всё.
 */
const INTRA_STAGE_ORDER: Discipline[] = [
  'survey',
  'architecture',
  'structural',
  'mep',
  'landscape',
  'interiors',
  'visualization',
  'permitting',
]

const SLA_DAYS: Partial<Record<Discipline, number>> = {
  survey: 5,
  architecture: 14,
  structural: 10,
  mep: 10,
  landscape: 7,
  interiors: 10,
  visualization: 7,
  permitting: 21,
}

const DEFAULT_SLA_DAYS = 10

const TITLES: Record<DocStage, Partial<Record<Discipline, string>>> = {
  concept: {
    architecture: 'Концепция объёма и посадка на участок',
    visualization: 'Визуализация концепции',
  },
  permit: {
    survey: 'Геодезическая подоснова',
    architecture: 'Архитектурный раздел на разрешение',
    structural: 'Конструктивная схема',
    mep: 'Инженерные разделы',
    landscape: 'Благоустройство участка',
    permitting: 'Комплектование и подача на разрешение',
  },
  tender: {
    architecture: 'Тендерная спецификация, архитектура',
    structural: 'Тендерная спецификация, конструкции',
    mep: 'Тендерная спецификация, инженерия',
  },
  construction: {
    architecture: 'Рабочая документация, архитектура',
    structural: 'Рабочая документация, конструкции',
    mep: 'Рабочая документация, инженерия',
    interiors: 'Рабочая документация, интерьеры',
  },
}

function titleFor(stage: DocStage, discipline: Discipline): string {
  return TITLES[stage]?.[discipline] ?? `${discipline} — ${stage}`
}

/**
 * План графа тикетов под проект и собранную команду.
 *
 * Тикет заводится только на ту дисциплину, которая в команде есть: план не
 * выдумывает работу, которую некому делать.
 */
export function planTickets(
  typology: Typology,
  targetStage: DocStage,
  teamDisciplines: Discipline[],
): TicketPlan[] {
  const inTeam = new Set(teamDisciplines)
  const plans: TicketPlan[] = []
  /** Тикеты предыдущей стадии, которых никто внутри неё не ждёт. */
  let previousTerminals: string[] = []

  for (const stage of stagesUpTo(targetStage)) {
    const disciplines = INTRA_STAGE_ORDER.filter(
      (d) => STAGE_SCOPE[stage].includes(d) && inTeam.has(d),
    )
    if (disciplines.length === 0) continue

    const stageStart = plans.length
    const keyOf = (d: Discipline) => `${stage}:${d}`

    for (const discipline of disciplines) {
      plans.push({
        key: keyOf(discipline),
        discipline,
        stage,
        title: titleFor(stage, discipline),
        spec: '',
        slaDays: SLA_DAYS[discipline] ?? DEFAULT_SLA_DAYS,
        dependsOn: intraStageDependencies(discipline, disciplines).map(keyOf),
      })
    }

    const stagePlans = plans.slice(stageStart)

    // Стадия входит в предыдущую: то, что ничего не ждёт внутри стадии, ждёт
    // завершения предыдущей.
    for (const plan of stagePlans) {
      if (plan.dependsOn.length === 0) plan.dependsOn = [...previousTerminals]
    }

    const awaited = new Set(stagePlans.flatMap((p) => p.dependsOn))
    previousTerminals = stagePlans.filter((p) => !awaited.has(p.key)).map((p) => p.key)
  }

  return plans
}

function intraStageDependencies(discipline: Discipline, present: Discipline[]): Discipline[] {
  // Согласования собирают комплект: ждут всё остальное на стадии.
  if (discipline === 'permitting') return present.filter((d) => d !== 'permitting')

  // Архитектура ждёт подоснову.
  if (discipline === 'architecture') return present.filter((d) => d === 'survey')

  // Геодезия ничего не ждёт внутри стадии.
  if (discipline === 'survey') return []

  // Смежники считают по объёму: ждут архитектуру.
  return present.filter((d) => d === 'architecture')
}

/**
 * Стадийный гейт. Тикет открывается, только когда все его зависимости приняты —
 * не «предъявлены», а именно приняты.
 */
export function canOpen(prerequisiteStatuses: TicketStatus[]): boolean {
  return prerequisiteStatuses.every((s) => s === 'accepted')
}

export type RelayTicket = {
  id: string
  status: TicketStatus
  dependsOn: string[]
}

/** Тикеты, которые гейт должен открыть прямо сейчас. */
export function openable(tickets: RelayTicket[]): string[] {
  const status = new Map(tickets.map((t) => [t.id, t.status]))

  return tickets
    .filter((t) => t.status === 'blocked')
    .filter((t) => canOpen(t.dependsOn.map((id) => status.get(id) ?? 'blocked')))
    .map((t) => t.id)
}

/** Порядок обхода графа. Пустой массив, если в зависимостях цикл. */
export function topologicalOrder(tickets: RelayTicket[]): string[] {
  const remaining = new Map(tickets.map((t) => [t.id, [...t.dependsOn]]))
  const order: string[] = []

  while (remaining.size > 0) {
    const ready = [...remaining.entries()]
      .filter(([, deps]) => deps.every((d) => !remaining.has(d)))
      .map(([id]) => id)

    if (ready.length === 0) return []

    for (const id of ready) remaining.delete(id)
    order.push(...ready)
  }

  return order
}

// --- Переходы состояния ----------------------------------------------------

/**
 * Что тикет прибавляет к счётчикам специалиста при приёмке (п.12).
 *
 * Считается один раз, в момент приёмки, из времён самого тикета. Ни клиент, ни
 * оператор не могут повлиять на эти числа иначе, чем принимая работу вовремя
 * или возвращая её на круг.
 */
export type DeliveryDelta = {
  deliveredTickets: number
  onTimeTickets: number
  firstTimeRightTickets: number
  responseMinutes: number
  revisionRounds: number
}

export function deliveryDeltaFor(ticket: {
  openedAt: Date | null
  firstResponseAt: Date | null
  acceptedAt: Date
  dueAt: Date | null
  revisionRounds: number
}): DeliveryDelta {
  const responseMinutes =
    ticket.openedAt && ticket.firstResponseAt
      ? Math.max(0, Math.round((ticket.firstResponseAt.getTime() - ticket.openedAt.getTime()) / 60_000))
      : 0

  return {
    deliveredTickets: 1,
    onTimeTickets: ticket.dueAt && ticket.acceptedAt <= ticket.dueAt ? 1 : 0,
    firstTimeRightTickets: ticket.revisionRounds === 0 ? 1 : 0,
    responseMinutes,
    revisionRounds: ticket.revisionRounds,
  }
}

export function dueDate(openedAt: Date, slaDays: number): Date {
  return new Date(openedAt.getTime() + slaDays * 24 * 60 * 60 * 1000)
}

// --- Обезличивание ---------------------------------------------------------

/**
 * Что специалист видит о команде: роли, не люди (п.11).
 *
 * Функции, возвращающей имя или контакт соседа по команде, в этом модуле нет и
 * не должно появиться.
 */
export function teammateRoles(
  team: { specialist: { id: string }; discipline: Discipline }[],
  viewerSpecialistId: string,
): Discipline[] {
  return unique(
    team.filter((m) => m.specialist.id !== viewerSpecialistId).map((m) => m.discipline),
  )
}

/** Стадии, на которых у специалиста есть тикеты. Нужно для его доски работ. */
export function stagesOf(tickets: { stage: DocStage }[]): DocStage[] {
  return unique(tickets.map((t) => t.stage)).sort(
    (a, b) => DOC_STAGE_ORDER[a] - DOC_STAGE_ORDER[b],
  )
}
