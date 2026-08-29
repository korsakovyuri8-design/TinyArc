/**
 * Blind Relay Protocol (концепт, п.11). Публичное имя стадии — Relay.
 *
 * Четыре правила протокола:
 *
 *  1. Никаких прямых чатов между специалистами. В схеме нет модели личного
 *     сообщения — здесь нет функции, которая бы её создала.
 *  2. Вся коммуникация привязана к тикету.
 *  3. Тикет не открывается, пока не приняты тикеты, от которых он зависит.
 *  4. Спор решает арбитр — бюро. Договариваться между собой участникам негде.
 *
 * Проект не выдаётся специалисту целиком: он разбирается на атомарные
 * микро-задачи. «Архитектурный раздел» — это не тикет, а папка; тикет — это
 * «фасады» или «разводка электрики». Мелкая единица нужна не для порядка, а
 * чтобы SLA и доля переделок вообще что-то значили: на задаче в три недели обе
 * метрики превращаются в шум.
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
} from './taxonomy'

export type TicketStatus = 'blocked' | 'open' | 'in_progress' | 'submitted' | 'revision' | 'accepted'

export type TicketPlan = {
  /** Устойчивый ключ внутри плана: по нему связываются зависимости. */
  key: string
  discipline: Discipline
  stage: DocStage
  title: string
  spec: string
  slaHours: number
  dependsOn: string[]
}

type Task = { title: string; slaHours: number }

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

/**
 * Атомарные задачи по стадиям и дисциплинам.
 *
 * Сроки в часах и разные: посадка на участок и подача в органы — работа разного
 * веса, и один общий срок врал бы про обе.
 */
const TASKS: Record<DocStage, Partial<Record<Discipline, Task[]>>> = {
  concept: {
    architecture: [
      { title: 'Посадка на участок и пятно застройки', slaHours: 24 },
      { title: 'Объёмно-планировочное решение', slaHours: 48 },
      { title: 'Черновые планировки этажей', slaHours: 48 },
    ],
    visualization: [
      { title: 'Визуализация экстерьера', slaHours: 48 },
      { title: 'Ключевой кадр интерьера', slaHours: 24 },
    ],
  },
  permit: {
    survey: [
      { title: 'Топографическая съёмка участка', slaHours: 48 },
      { title: 'Отчёт по грунтам', slaHours: 48 },
    ],
    architecture: [
      { title: 'Планы этажей', slaHours: 48 },
      { title: 'Фасады', slaHours: 24 },
      { title: 'Разрезы', slaHours: 24 },
      { title: 'Пояснительная записка', slaHours: 24 },
    ],
    structural: [
      { title: 'Конструктивная схема', slaHours: 48 },
      { title: 'Расчёт нагрузок', slaHours: 48 },
      { title: 'Фундамент', slaHours: 24 },
    ],
    mep: [
      { title: 'Отопление и вентиляция', slaHours: 48 },
      { title: 'Электрика и освещение', slaHours: 48 },
      { title: 'Водоснабжение и канализация', slaHours: 48 },
    ],
    landscape: [
      { title: 'Схема благоустройства', slaHours: 48 },
      { title: 'Вертикальная планировка и дренаж', slaHours: 48 },
    ],
    interiors: [{ title: 'Планировочное решение интерьеров', slaHours: 48 }],
    permitting: [
      { title: 'Проверка зонирования участка', slaHours: 24 },
      { title: 'Комплектование пакета', slaHours: 48 },
      { title: 'Подача и сопровождение', slaHours: 168 },
    ],
  },
  tender: {
    architecture: [
      { title: 'Спецификация отделки', slaHours: 48 },
      { title: 'Ведомость проёмов', slaHours: 24 },
    ],
    structural: [{ title: 'Ведомость материалов и объёмов', slaHours: 48 }],
    mep: [{ title: 'Спецификация оборудования', slaHours: 48 }],
  },
  construction: {
    architecture: [
      { title: 'Рабочие планы', slaHours: 48 },
      { title: 'Узлы и детали', slaHours: 72 },
    ],
    structural: [
      { title: 'Рабочие чертежи конструкций', slaHours: 72 },
      { title: 'Армирование', slaHours: 48 },
    ],
    mep: [{ title: 'Рабочие схемы сетей', slaHours: 72 }],
    interiors: [{ title: 'Рабочая документация интерьеров', slaHours: 72 }],
  },
}

const DEFAULT_SLA_HOURS = 48

/**
 * Срок на запрос смежника.
 *
 * Короткий намеренно: запрос — это не раздел, а вопрос, из-за которого у
 * другого человека стоит работа. Сутки — это «до завтрашнего утра».
 */
export const REQUEST_SLA_HOURS = 24

function tasksFor(stage: DocStage, discipline: Discipline): Task[] {
  return TASKS[stage]?.[discipline] ?? []
}

/**
 * План графа тикетов под проект и собранную команду.
 *
 * Тикет заводится только на ту дисциплину, которая в команде есть: план не
 * выдумывает работу, которую некому делать.
 */
export function planTickets(targetStage: DocStage, teamDisciplines: Discipline[]): TicketPlan[] {
  const inTeam = new Set(teamDisciplines)
  const plans: TicketPlan[] = []
  /** Тикеты предыдущей стадии, которых никто внутри неё не ждёт. */
  let previousTerminals: string[] = []

  for (const stage of stagesUpTo(targetStage)) {
    const disciplines = INTRA_STAGE_ORDER.filter(
      (d) => inTeam.has(d) && tasksFor(stage, d).length > 0,
    )
    if (disciplines.length === 0) continue

    const chains = new Map<Discipline, string[]>()
    const stagePlans: TicketPlan[] = []

    for (const discipline of disciplines) {
      const keys: string[] = []

      tasksFor(stage, discipline).forEach((task, index) => {
        const key = `${stage}:${discipline}:${index}`

        stagePlans.push({
          key,
          discipline,
          stage,
          title: task.title,
          spec: '',
          slaHours: task.slaHours || DEFAULT_SLA_HOURS,
          // Внутри дисциплины задачи идут цепочкой: фасады рисуют по планам,
          // а не параллельно им.
          dependsOn: index === 0 ? [] : [keys[index - 1]],
        })

        keys.push(key)
      })

      chains.set(discipline, keys)
    }

    const byKey = new Map(stagePlans.map((p) => [p.key, p]))

    // Голова цепочки ждёт хвосты дисциплин, от которых зависит.
    for (const discipline of disciplines) {
      const keys = chains.get(discipline)!
      const upstream = intraStageDependencies(discipline, disciplines)
      const head = byKey.get(keys[0])!

      head.dependsOn =
        upstream.length > 0
          ? upstream.map((d) => last(chains.get(d)!))
          : // Вход стадии ждёт завершения предыдущей.
            [...previousTerminals]
    }

    plans.push(...stagePlans)

    const awaited = new Set(stagePlans.flatMap((p) => p.dependsOn))
    previousTerminals = stagePlans.filter((p) => !awaited.has(p.key)).map((p) => p.key)
  }

  return plans
}

function last<T>(items: T[]): T {
  return items[items.length - 1]
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
  stage: DocStage
  dependsOn: string[]
}

/**
 * Стадия, у которой все задачи приняты бюро.
 *
 * Это ещё не закрытая стадия — только готовая к подтверждению заказчиком
 * (п.12б). Разница принципиальная: принятая бюро работа означает «сделано как
 * заказано», подтверждение заказчика — «заказано было это».
 */
export function stageComplete(tickets: RelayTicket[], stage: DocStage): boolean {
  const inStage = tickets.filter((t) => t.stage === stage)

  return inStage.length > 0 && inStage.every((t) => t.status === 'accepted')
}

/** Стадии, законченные бюро и ждущие слова заказчика. */
export function awaitingClient(tickets: RelayTicket[], approved: DocStage[]): DocStage[] {
  return unique(tickets.map((t) => t.stage))
    .filter((stage) => !approved.includes(stage))
    .filter((stage) => stageComplete(tickets, stage))
    .sort((a, b) => DOC_STAGE_ORDER[a] - DOC_STAGE_ORDER[b])
}

/**
 * Тикеты, которые гейт должен открыть прямо сейчас.
 *
 * Два условия, а не одно. Первое прежнее: приняты все зависимости по графу.
 * Второе — заказчик подтвердил каждую предыдущую стадию.
 *
 * Второе добавлено не ради формальности. Разрабатывать документацию по
 * концепции, которую заказчик не подтверждал, — это и есть та переделка, ради
 * устранения которой продукт существует. Молчание заказчика при этом не
 * теряется: незакрытая стадия видна бюро отдельной очередью, и оно спрашивает.
 */
export function openable(tickets: RelayTicket[], approved: DocStage[] = []): string[] {
  const status = new Map(tickets.map((t) => [t.id, t.status]))

  const earlierStagesApproved = (stage: DocStage): boolean =>
    unique(tickets.map((t) => t.stage))
      .filter((s) => DOC_STAGE_ORDER[s] < DOC_STAGE_ORDER[stage])
      .every((s) => approved.includes(s))

  return tickets
    .filter((t) => t.status === 'blocked')
    .filter((t) => canOpen(t.dependsOn.map((id) => status.get(id) ?? 'blocked')))
    .filter((t) => earlierStagesApproved(t.stage))
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
  /** Когда специалист взял тикет в работу — это и есть время реакции (п.12). */
  claimedAt: Date | null
  acceptedAt: Date
  dueAt: Date | null
  revisionRounds: number
}): DeliveryDelta {
  const responseMinutes =
    ticket.openedAt && ticket.claimedAt
      ? Math.max(0, Math.round((ticket.claimedAt.getTime() - ticket.openedAt.getTime()) / 60_000))
      : 0

  return {
    deliveredTickets: 1,
    onTimeTickets: ticket.dueAt && ticket.acceptedAt <= ticket.dueAt ? 1 : 0,
    firstTimeRightTickets: ticket.revisionRounds === 0 ? 1 : 0,
    responseMinutes,
    revisionRounds: ticket.revisionRounds,
  }
}

export function dueDate(openedAt: Date, slaHours: number): Date {
  return new Date(openedAt.getTime() + slaHours * 60 * 60 * 1000)
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
