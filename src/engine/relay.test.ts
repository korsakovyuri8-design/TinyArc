import { describe, expect, it } from 'vitest'
import {
  HANDOVER_HOURS,
  WORKING_HOURS_PER_DAY,
  actualDays,
  awaitingClient,
  billable,
  canOpen,
  criticalPathHours,
  promisedDays,
  deliveryDeltaFor,
  dueDate,
  openable,
  planTickets,
  stageComplete,
  stagesOf,
  teammateRoles,
  topologicalOrder,
  type RelayTicket,
} from './relay'

/*
 * Стенд, на котором деньги не участвуют: все стадии оплачены. Тесты ниже про
 * граф зависимостей и подтверждение заказчика, и подмешивать в них третий гейт
 * значит проверять три вещи одним ожиданием.
 */
const PAID: DocStage[] = ['concept', 'permit', 'tender', 'construction']
import { allShapes } from './readiness'
import type { DocStage } from './taxonomy'
import { requiredRoles } from './taxonomy'

const TEAM = ['architecture', 'structural', 'mep', 'survey', 'permitting', 'visualization'] as const

describe('план графа тикетов', () => {
  it('дробит работу на атомарные задачи, а не на разделы', () => {
    const plan = planTickets('permit', [...TEAM])
    const architectureAtPermit = plan.filter(
      (t) => t.stage === 'permit' && t.discipline === 'architecture',
    )

    // Планы, фасады, разрезы, записка — четыре тикета, а не один «раздел».
    expect(architectureAtPermit.length).toBeGreaterThan(1)
    expect(architectureAtPermit.map((t) => t.title)).toContain('Elevations')
  })

  it('не заводит работу, которую некому делать', () => {
    const plan = planTickets('permit', ['architecture', 'structural'])
    const disciplines = new Set(plan.map((t) => t.discipline))

    expect(disciplines.has('permitting')).toBe(false)
    expect(disciplines.has('survey')).toBe(false)
    expect(disciplines.has('architecture')).toBe(true)
  })

  it('ведёт проект по стадиям до целевой', () => {
    expect(stagesOf(planTickets('permit', [...TEAM]))).toEqual(['concept', 'permit'])
    expect(stagesOf(planTickets('construction', [...TEAM]))).toEqual([
      'concept',
      'permit',
      'tender',
      'construction',
    ])
  })

  it('внутри дисциплины ведёт задачи цепочкой', () => {
    const plan = planTickets('permit', [...TEAM])
    const arch = plan.filter((t) => t.stage === 'permit' && t.discipline === 'architecture')

    // Фасады рисуют по планам, а не одновременно с ними.
    expect(arch[1].dependsOn).toEqual([arch[0].key])
    expect(arch[2].dependsOn).toEqual([arch[1].key])
  })

  it('ставит геодезию раньше архитектуры, а согласования — последними', () => {
    const plan = planTickets('permit', [...TEAM])
    const at = (d: string) => plan.filter((t) => t.stage === 'permit' && t.discipline === d)

    const survey = at('survey')
    const arch = at('architecture')
    const permitting = at('permitting')

    // Голова архитектуры ждёт хвост геодезии.
    expect(arch[0].dependsOn).toEqual([survey[survey.length - 1].key])
    // Согласования ждут хвосты всех остальных дисциплин стадии.
    expect(permitting[0].dependsOn).toContain(arch[arch.length - 1].key)
    expect(permitting[0].dependsOn).not.toContain(permitting[0].key)
  })

  it('связывает стадии: следующая входит в предыдущую', () => {
    const plan = planTickets('permit', [...TEAM])
    const survey = plan.filter((t) => t.stage === 'permit' && t.discipline === 'survey')
    const conceptKeys = plan.filter((t) => t.stage === 'concept').map((t) => t.key)

    expect(survey[0].dependsOn.length).toBeGreaterThan(0)
    for (const dependency of survey[0].dependsOn) expect(conceptKeys).toContain(dependency)
  })

  it('строит граф без циклов', () => {
    const plan = planTickets('construction', [
      'architecture',
      'structural',
      'mep',
      'landscape',
      'interiors',
      'survey',
      'permitting',
      'visualization',
    ])

    const tickets: RelayTicket[] = plan.map((t) => ({
      id: t.key,
      status: 'blocked',
      stage: t.stage,
      dependsOn: t.dependsOn,
    }))

    expect(topologicalOrder(tickets)).toHaveLength(plan.length)
  })

  it('замечает цикл, а не зацикливается', () => {
    expect(
      topologicalOrder([
        { id: 'a', status: 'blocked', stage: 'permit', dependsOn: ['b'] },
        { id: 'b', status: 'blocked', stage: 'permit', dependsOn: ['a'] },
      ]),
    ).toEqual([])
  })

  it('даёт разным задачам разные сроки', () => {
    const plan = planTickets('permit', [...TEAM])
    const slas = new Set(plan.map((t) => t.slaHours))

    // Посадка на участок и подача в органы — работа разного веса.
    expect(slas.size).toBeGreaterThan(1)
  })
})

describe('стадийные гейты', () => {
  it('открывает только по принятым зависимостям, а не по предъявленным', () => {
    expect(canOpen([])).toBe(true)
    expect(canOpen(['accepted', 'accepted'])).toBe(true)
    expect(canOpen(['accepted', 'submitted'])).toBe(false)
    expect(canOpen(['in_progress'])).toBe(false)
    expect(canOpen(['revision'])).toBe(false)
  })

  it('открывает следующий тикет ровно тогда, когда предыдущий принят', () => {
    const tickets: RelayTicket[] = [
      { id: 'survey', status: 'submitted', stage: 'permit', dependsOn: [] },
      { id: 'arch', status: 'blocked', stage: 'permit', dependsOn: ['survey'] },
    ]

    expect(openable(tickets, [], PAID)).toEqual([])

    tickets[0].status = 'accepted'
    expect(openable(tickets, [], PAID)).toEqual(['arch'])
  })

  it('не открывает тикет, у которого принята только часть зависимостей', () => {
    expect(
      openable([
        { id: 'arch', status: 'accepted', stage: 'permit', dependsOn: [] },
        { id: 'struct', status: 'in_progress', stage: 'permit', dependsOn: ['arch'] },
        { id: 'permitting', status: 'blocked', stage: 'permit', dependsOn: ['arch', 'struct'] },
      ], [], PAID),
    ).toEqual([])
  })
})

describe('счётчики поставки', () => {
  const opened = new Date('2026-03-01T09:00:00Z')

  it('считает срок от открытия по SLA в часах', () => {
    expect(dueDate(opened, 24).toISOString()).toBe('2026-03-02T09:00:00.000Z')
    expect(dueDate(opened, 48).toISOString()).toBe('2026-03-03T09:00:00.000Z')
  })

  it('меряет время реакции до принятия задачи, а не до первой реплики', () => {
    const delta = deliveryDeltaFor({
      openedAt: opened,
      claimedAt: new Date('2026-03-01T11:00:00Z'),
      acceptedAt: new Date('2026-03-02T08:00:00Z'),
      dueAt: dueDate(opened, 24),
      revisionRounds: 0,
    })

    expect(delta).toEqual({
      deliveredTickets: 1,
      onTimeTickets: 1,
      firstTimeRightTickets: 1,
      responseMinutes: 120,
      revisionRounds: 0,
    })
  })

  it('не засчитывает просрочку и круги правок', () => {
    const delta = deliveryDeltaFor({
      openedAt: opened,
      claimedAt: new Date('2026-03-03T09:00:00Z'),
      acceptedAt: new Date('2026-03-20T09:00:00Z'),
      dueAt: dueDate(opened, 24),
      revisionRounds: 2,
    })

    expect(delta.onTimeTickets).toBe(0)
    expect(delta.firstTimeRightTickets).toBe(0)
    expect(delta.revisionRounds).toBe(2)
    expect(delta.deliveredTickets).toBe(1)
  })

  it('не выдумывает время реакции, если тикет не брали в работу', () => {
    expect(
      deliveryDeltaFor({
        openedAt: opened,
        claimedAt: null,
        acceptedAt: new Date('2026-03-02T08:00:00Z'),
        dueAt: dueDate(opened, 24),
        revisionRounds: 0,
      }).responseMinutes,
    ).toBe(0)
  })
})

describe('обезличивание', () => {
  it('отдаёт роли соседей, а не людей', () => {
    const roles = teammateRoles(
      [
        { specialist: { id: 'me' }, discipline: 'architecture' },
        { specialist: { id: 'other' }, discipline: 'structural' },
        { specialist: { id: 'third' }, discipline: 'mep' },
      ],
      'me',
    )

    expect(roles).toEqual(['structural', 'mep'])
    expect(JSON.stringify(roles)).not.toContain('other')
  })
})

describe('подтверждение стадии заказчиком', () => {
  const project = (): RelayTicket[] => [
    { id: 'c1', status: 'accepted', stage: 'concept', dependsOn: [] },
    { id: 'c2', status: 'accepted', stage: 'concept', dependsOn: ['c1'] },
    { id: 'p1', status: 'blocked', stage: 'permit', dependsOn: ['c2'] },
  ]

  it('видит стадию, законченную бюро', () => {
    expect(stageComplete(project(), 'concept')).toBe(true)
    expect(stageComplete(project(), 'permit')).toBe(false)
  })

  it('стадия без задач законченной не считается', () => {
    expect(stageComplete(project(), 'tender')).toBe(false)
  })

  /**
   * Главное здесь. Зависимости приняты, но заказчик молчит — и следующая
   * стадия не открывается. Разрабатывать документацию по неподтверждённой
   * концепции значит готовить переделку.
   */
  it('не открывает следующую стадию, пока заказчик не подтвердил предыдущую', () => {
    expect(openable(project(), [], PAID)).toEqual([])
    expect(openable(project(), ['concept'], PAID)).toEqual(['p1'])
  })

  it('называет стадии, ждущие слова заказчика', () => {
    expect(awaitingClient(project(), [])).toEqual(['concept'])
    expect(awaitingClient(project(), ['concept'])).toEqual([])
  })

  it('внутри стадии подтверждение ничего не меняет', () => {
    // Первая стадия не ждёт ничьего подтверждения: до неё стадий нет.
    const fresh: RelayTicket[] = [
      { id: 'c1', status: 'accepted', stage: 'concept', dependsOn: [] },
      { id: 'c2', status: 'blocked', stage: 'concept', dependsOn: ['c1'] },
    ]

    expect(openable(fresh, [], PAID)).toEqual(['c2'])
  })

  it('порядок стадий соблюдается: подтверждение поздней не открывает раннюю', () => {
    const three: RelayTicket[] = [
      { id: 'c1', status: 'accepted', stage: 'concept', dependsOn: [] },
      { id: 'p1', status: 'blocked', stage: 'permit', dependsOn: ['c1'] },
      { id: 't1', status: 'blocked', stage: 'tender', dependsOn: ['p1'] },
    ]

    // Подтверждение стадии разрешений при неподтверждённой концепции ничего не
    // открывает: пропускать стадию нельзя ни с какой стороны.
    expect(openable(three, ['permit'], PAID)).toEqual([])
    expect(openable(three, ['concept'], PAID)).toEqual(['p1'])
  })
})

/*
 * Требуемая роль без задач — это человек в команде, которому нечего делать.
 * Заметить это на глаз нельзя: сборка пройдёт, тикеты просто не появятся, и
 * дыра всплывёт на проекте. Поэтому связь «роль есть в матрице → работа для
 * неё описана» проверяется на всех формах внутри границы, а не на примере.
 */
describe('у каждой требуемой роли есть работа', () => {
  it('план заводит тикеты на каждую дисциплину, которую позвала матрица', () => {
    for (const shape of allShapes()) {
      const disciplines = [...new Set(requiredRoles(shape).map((r) => r.discipline))]
      const plans = planTickets(shape.targetStage, disciplines)
      const withTickets = new Set(plans.map((p) => p.discipline))

      for (const discipline of disciplines) {
        expect(
          withTickets.has(discipline),
          `${discipline} требуется для ${shape.typology}/${shape.targetStage}/${shape.materialSystem}, но задач под неё нет`,
        ).toBe(true)
      }
    }
  })
})

/*
 * Оплата как гейт (п.14а). Проверяется не «счёт выставлен», а то, что до
 * оплаты никто из команды не начинает работу: тикет, открытый в долг, — это
 * обязательство бюро перед специалистом, за которое ему никто не заплатил.
 */
describe('оплата открывает стадию', () => {
  const tickets: RelayTicket[] = [
    { id: 'c1', status: 'blocked', stage: 'concept', dependsOn: [] },
    { id: 'p1', status: 'blocked', stage: 'permit', dependsOn: ['c1'] },
  ]

  it('без оплаты не открывает даже то, у чего нет зависимостей', () => {
    expect(openable(tickets, [], [])).toEqual([])
  })

  it('открывает оплаченную стадию', () => {
    expect(openable(tickets, [], ['concept'])).toEqual(['c1'])
  })

  it('оплата следующей стадии не отменяет подтверждения предыдущей', () => {
    const done: RelayTicket[] = [
      { id: 'c1', status: 'accepted', stage: 'concept', dependsOn: [] },
      { id: 'p1', status: 'blocked', stage: 'permit', dependsOn: ['c1'] },
    ]

    // Заплачено, но концепция не подтверждена: гейт держит.
    expect(openable(done, [], ['concept', 'permit'])).toEqual([])
    expect(openable(done, ['concept'], ['concept', 'permit'])).toEqual(['p1'])
  })

  it('к оплате зовёт только то, чему мешает счёт', () => {
    // Ничего не подтверждено: платить можно за концепцию, но не за разрешение.
    expect(billable(tickets, [], [])).toEqual(['concept'])

    // Концепция подтверждена и оплачена — очередь дошла до разрешения.
    expect(billable(tickets, ['concept'], ['concept'])).toEqual(['permit'])

    // Всё оплачено — выставлять нечего.
    expect(billable(tickets, ['concept'], ['concept', 'permit'])).toEqual([])
  })
})

describe('срок стадии', () => {
  const plan = (key: string, slaHours: number, dependsOn: string[] = []) => ({
    key,
    discipline: 'architecture' as const,
    stage: 'concept' as const,
    title: key,
    spec: '',
    slaHours,
    dependsOn,
  })

  it('стадия длится по самой длинной ветке, а не по сумме работы', () => {
    // Две ветки по 10 часов, идущие одновременно: это десять часов, а не
    // двадцать. Ровно отсюда и берётся выигрыш во времени.
    const plans = [plan('a', 10), plan('b', 10)]

    expect(criticalPathHours(plans, 'concept')).toBe(10)
  })

  it('последовательная цепочка складывается вместе с передачами', () => {
    const plans = [plan('a', 10), plan('b', 10, ['a'])]

    expect(criticalPathHours(plans, 'concept')).toBe(20 + HANDOVER_HOURS)
  })

  /*
   * Приёмка между тикетами занимает время всегда, и в SLA ни одного из двух
   * тикетов её не видно. Без неё названный срок систематически короче факта.
   */
  it('передача между тикетами стоит времени', () => {
    expect(HANDOVER_HOURS).toBeGreaterThan(0)
  })

  it('чужая стадия срока этой не удлиняет', () => {
    const plans = [
      { ...plan('early', 40), stage: 'concept' as const },
      { ...plan('late', 10, ['early']), stage: 'permit' as const },
    ]

    expect(criticalPathHours(plans, 'permit')).toBe(10)
  })

  it('цикл в зависимостях не превращается в срок', () => {
    const plans = [plan('a', 10, ['b']), plan('b', 10, ['a'])]

    expect(criticalPathHours(plans, 'concept')).toBe(0)
    expect(promisedDays(plans, 'concept')).toBe(0)
  })

  it('стадия без тикетов не обещает ни одного дня', () => {
    expect(promisedDays([], 'concept')).toBe(0)
  })

  it('часы переводятся в календарные дни, а не в рабочие', () => {
    // Тридцать часов — пять рабочих дней по шесть, то есть календарная неделя.
    const plans = [plan('a', 30)]

    expect(WORKING_HOURS_PER_DAY).toBe(6)
    expect(promisedDays(plans, 'concept')).toBe(7)
  })

  it('настоящий план стадии даёт срок, который можно назвать', () => {
    const plans = planTickets('concept', ['architecture', 'structural', 'mep', 'visualization'])
    const days = promisedDays(plans, 'concept')

    expect(days).toBeGreaterThan(0)
    expect(days).toBeLessThan(120)
  })
})

describe('фактический срок стадии', () => {
  it('считается от открытия первого тикета до приёмки последнего', () => {
    const opened = new Date('2026-09-01T09:00:00Z')
    const accepted = new Date('2026-09-11T09:00:00Z')

    expect(actualDays(opened, accepted)).toBe(10)
  })

  it('незакрытая стадия срока не имеет', () => {
    expect(actualDays(new Date('2026-09-01T09:00:00Z'), null)).toBeNull()
    expect(actualDays(null, null)).toBeNull()
  })

  /* Стадия, закрытая в тот же день, длилась день, а не ноль дней. */
  it('стадия в один день считается днём', () => {
    const opened = new Date('2026-09-01T09:00:00Z')
    const accepted = new Date('2026-09-01T17:00:00Z')

    expect(actualDays(opened, accepted)).toBe(1)
  })
})
