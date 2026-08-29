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
  // Технолог считает по конструкции, энергетик — по конструкции и инженерии.
  // Обоим нужно то, что сдано выше, поэтому они стоят здесь, а не раньше.
  'dfma',
  'energy',
  'landscape',
  'interiors',
  'visualization',
  'permitting',
  // Смета считается последней по определению: она про то, что уже решено.
  'cost_estimation',
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
      { title: 'Siting and building footprint', slaHours: 24 },
      { title: 'Massing and spatial layout', slaHours: 48 },
      { title: 'Draft floor plans', slaHours: 48 },
    ],
    /*
     * Концепция — это то, что заказчик утверждает, и после утверждения она
     * становится заданием на разрешение (п.12б). Поэтому смотрят её все, кто
     * потом будет по ней работать: неосуществимый объём, утверждённый
     * клиентом, — это и есть переделка, ради устранения которой всё
     * остальное затевалось. Задачи короткие: на этой стадии от смежника
     * нужен ответ «так строится», а не раздел.
     */
    structural: [{ title: 'Structural feasibility check of the massing', slaHours: 24 }],
    mep: [{ title: 'Space for plant, risers and service entries', slaHours: 24 }],
    landscape: [{ title: 'Site organisation plan', slaHours: 24 }],
    interiors: [{ title: 'Functional plan of the public areas', slaHours: 24 }],
    visualization: [
      { title: 'Exterior visualisation', slaHours: 48 },
      { title: 'Key interior view', slaHours: 24 },
    ],
  },
  permit: {
    survey: [
      { title: 'Topographic survey', slaHours: 48 },
      { title: 'Geotechnical report', slaHours: 48 },
    ],
    architecture: [
      { title: 'Floor plans', slaHours: 48 },
      { title: 'Elevations', slaHours: 24 },
      { title: 'Sections', slaHours: 24 },
      { title: 'Design and access statement', slaHours: 24 },
    ],
    structural: [
      { title: 'Structural scheme', slaHours: 48 },
      { title: 'Load calculations', slaHours: 48 },
      { title: 'Foundations', slaHours: 24 },
    ],
    mep: [
      { title: 'Heating and ventilation', slaHours: 48 },
      { title: 'Electrical and lighting', slaHours: 48 },
      { title: 'Water supply and drainage', slaHours: 48 },
    ],
    landscape: [
      { title: 'Landscape layout', slaHours: 48 },
      { title: 'Grading and drainage', slaHours: 48 },
    ],
    interiors: [{ title: 'Interior layout', slaHours: 48 }],
    permitting: [
      { title: 'Site zoning review', slaHours: 24 },
      { title: 'Assembling the submission set', slaHours: 48 },
      { title: 'Submission and follow-through', slaHours: 168 },
    ],
    energy: [
      { title: 'Thermal calculation of the building envelope', slaHours: 48 },
      { title: 'Energy performance report', slaHours: 72 },
    ],
  },
  tender: {
    architecture: [
      { title: 'Finishes schedule', slaHours: 48 },
      { title: 'Door and window schedule', slaHours: 24 },
    ],
    structural: [{ title: 'Materials and quantities schedule', slaHours: 48 }],
    mep: [{ title: 'Equipment schedule', slaHours: 48 }],
    cost_estimation: [
      { title: 'Consolidated bill of quantities', slaHours: 72 },
      { title: 'Cost estimate by section', slaHours: 72 },
    ],
  },
  construction: {
    architecture: [
      { title: 'Working plans', slaHours: 48 },
      { title: 'Junctions and details', slaHours: 72 },
    ],
    structural: [
      { title: 'Structural working drawings', slaHours: 72 },
      { title: 'Reinforcement', slaHours: 48 },
    ],
    mep: [{ title: 'Services working drawings', slaHours: 72 }],
    dfma: [
      { title: 'Fabrication drawings', slaHours: 72 },
      { title: 'Erection sequence and connection details', slaHours: 48 },
    ],
    interiors: [{ title: 'Interior working drawings', slaHours: 72 }],
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
 * Три условия, а не одно. Первое прежнее: приняты все зависимости по графу.
 * Второе — заказчик подтвердил каждую предыдущую стадию. Третье — стадия
 * оплачена.
 *
 * Второе добавлено не ради формальности. Разрабатывать документацию по
 * концепции, которую заказчик не подтверждал, — это и есть та переделка, ради
 * устранения которой продукт существует. Молчание заказчика при этом не
 * теряется: незакрытая стадия видна бюро отдельной очередью, и оно спрашивает.
 *
 * Третье — не жадность, а условие, при котором бюро может отвечать за
 * результат. Команда собрана из живых людей, и их работа начинается в тот
 * момент, когда открывается тикет. Стадия, начатая до оплаты, — это работа,
 * которую бюро уже должно специалистам, не получив за неё ничего; один такой
 * заказчик закрывает пилот. Цена при этом названа заранее и целиком (п.14),
 * так что платят за известный объём, а не за обещание посчитать потом.
 *
 * Ни у `approved`, ни у `paid` нет значения по умолчанию, и это намеренно.
 * Пустой список здесь означает «ничего не открывать», а забытый аргумент —
 * замерший проект, который выглядит не как ошибка вызова, а как отсутствие
 * работы. Пусть о забытом аргументе скажет компилятор.
 */
export function openable(
  tickets: RelayTicket[],
  approved: DocStage[],
  paid: DocStage[],
): string[] {
  const status = new Map(tickets.map((t) => [t.id, t.status]))

  const earlierStagesApproved = (stage: DocStage): boolean =>
    unique(tickets.map((t) => t.stage))
      .filter((s) => DOC_STAGE_ORDER[s] < DOC_STAGE_ORDER[stage])
      .every((s) => approved.includes(s))

  return tickets
    .filter((t) => t.status === 'blocked')
    .filter((t) => canOpen(t.dependsOn.map((id) => status.get(id) ?? 'blocked')))
    .filter((t) => earlierStagesApproved(t.stage))
    .filter((t) => paid.includes(t.stage))
    .map((t) => t.id)
}

/**
 * Стадии, которые пора выставить к оплате.
 *
 * Стадия попадает сюда, когда мешает только счёт: предыдущие подтверждены, а
 * эта не оплачена. Раньше выставлять нечего — заказчик ещё не подтвердил, что
 * предыдущая сделана как заказано, и счёт на следующую выглядел бы попыткой
 * получить деньги вперёд подтверждения.
 */
export function billable(
  tickets: RelayTicket[],
  approved: DocStage[],
  paid: DocStage[],
): DocStage[] {
  const stages = unique(tickets.map((t) => t.stage))

  return stages
    .filter((stage) => !paid.includes(stage))
    .filter((stage) =>
      stages
        .filter((s) => DOC_STAGE_ORDER[s] < DOC_STAGE_ORDER[stage])
        .every((s) => approved.includes(s)),
    )
    .sort((a, b) => DOC_STAGE_ORDER[a] - DOC_STAGE_ORDER[b])
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
