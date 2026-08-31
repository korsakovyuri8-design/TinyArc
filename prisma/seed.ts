/**
 * Сид стенда.
 *
 * Кладёт в базу тот же синтетический пул, что крутится в демонстрации
 * алгоритма, заводит несколько проектов и прогоняет сборку. Один из проектов
 * доводится до реальной истории тикетов — иначе метрики качества нечем
 * показать, а без метрик половина продукта невидима.
 *
 * Сид намеренно не выдумывает отдельный «красивый» пул: демо и стенд должны
 * показывать одну и ту же выборку.
 */

import { PrismaClient } from '../src/generated/prisma/client'
import { adapterFor } from '../src/lib/db-adapter'
import { databaseUrl } from '../src/lib/db-provider'
import { DEMO_POOL_SIZE, demoPool } from '../src/lib/demo-pool'
import { toList } from '../src/lib/rows'
import { chooseDirection, prepareDirections } from '../src/lib/services/direction'
import { runAssembly } from '../src/lib/services/matching'
import {
  accept,
  applyGates,
  attachArtifact,
  claim,
  comment,
  raiseConflict,
  requestFrom,
  submit,
} from '../src/lib/services/relay'
import { issueDueInvoices, markPaid } from '../src/lib/services/billing'
import type { DocStage } from '../src/engine/taxonomy'

const prisma = new PrismaClient({ adapter: adapterFor(databaseUrl()) })

const SEED_PROJECTS = [
  {
    clientKey: 'seed-brief-tivat',
    title: 'Villa in Tivat',
    clientName: 'Marina',
    clientEmail: 'marina@example.com',
    typology: 'villa',
    storeys: 2,
    areaSqm: 420,
    jurisdiction: 'ME',
    climateZone: 'mediterranean',
    materialSystem: 'concrete',
    terrain: 'slope',
    gridConnection: 'grid',
    targetStage: 'permit',
    software: ['archicad'],
    languages: ['en', 'ru'],
    requiredHoursPerWeek: 10,
    horizonDays: 45,
    utcOffset: 1,
    briefNotes:
      'The site slopes towards the sea. The view from the top floor matters, and a shaded courtyard. The slope is steep — grading is needed.',
  },
  {
    clientKey: 'seed-brief-novisad',
    title: 'Townhouse in Novi Sad',
    clientName: 'Dušan',
    clientEmail: 'dusan@example.com',
    typology: 'townhouse',
    storeys: 3,
    areaSqm: 780,
    jurisdiction: 'RS',
    climateZone: 'continental',
    materialSystem: 'masonry',
    terrain: 'flat',
    gridConnection: 'grid',
    targetStage: 'permit',
    software: ['revit'],
    languages: ['sr', 'en'],
    requiredHoursPerWeek: 12,
    horizonDays: 60,
    utcOffset: 1,
    briefNotes: 'Four sections, a shared courtyard. A clear daylight calculation is needed.',
  },
  {
    clientKey: 'seed-brief-athens',
    title: 'Mixed-use in Athens',
    clientName: 'Eleni',
    clientEmail: 'eleni@example.com',
    typology: 'mixed_use',
    storeys: 5,
    areaSqm: 2600,
    jurisdiction: 'GR',
    climateZone: 'mediterranean',
    materialSystem: 'hybrid',
    terrain: 'flood_prone',
    gridConnection: 'off_grid',
    targetStage: 'concept',
    software: [],
    languages: ['el', 'en'],
    requiredHoursPerWeek: 16,
    horizonDays: 90,
    utcOffset: 2,
    briefNotes: 'Commercial on the ground floor, housing above. A height limit applies across the block.',
  },
  {
    // Намеренно вне продуктовой границы: стенд должен показывать и отказ (п.5).
    clientKey: 'seed-brief-rejected',
    title: 'Nine-storey block in Bar',
    clientName: 'Vuk',
    clientEmail: 'vuk@example.com',
    typology: 'multi_family',
    storeys: 9,
    areaSqm: 5400,
    jurisdiction: 'ME',
    climateZone: 'mediterranean',
    materialSystem: 'concrete',
    terrain: 'flat',
    gridConnection: 'grid',
    targetStage: 'permit',
    software: ['revit'],
    languages: ['en'],
    requiredHoursPerWeek: 20,
    horizonDays: 120,
    utcOffset: 1,
    briefNotes: 'Nine storeys — a check that the engine declines rather than drags it along.',
  },
] as const

/**
 * Уже засеяно?
 *
 * Команда запуска демонстрационного стенда зовёт сид при каждом старте
 * контейнера, а контейнер на бесплатном плане поднимается заново после каждого
 * сна. Без этой проверки пробуждение означало бы пересборку пула из сотни
 * человек с прогонами сборки — то есть минуту ожидания у того, кто просто
 * открыл страницу.
 *
 * Признак — сами выдуманные записи, а не флаг в отдельной таблице: флаг
 * рассинхронизируется с базой, а эти записи и есть то, ради чего сид звали.
 *
 * Вопрос именно «засевали ли когда-нибудь», а не «на месте ли всё до одной
 * записи». Полный счёт был бы неверным признаком: стенд живёт — заявку
 * отклонили, человека обезличили по его просьбе, — и счёт уходит вниз от
 * обычной работы. Сид, срабатывающий на это, пересобирал бы базу как раз
 * тогда, когда в ней появилось что-то настоящее.
 */
async function alreadySeeded(): Promise<boolean> {
  const [people, projects] = await Promise.all([
    prisma.specialist.count({ where: { accessKey: { startsWith: 'seed-key-' } } }),
    prisma.project.count({ where: { clientKey: { startsWith: 'seed-brief-' } } }),
  ])

  return people > 0 || projects > 0
}

async function main() {
  if (process.env.BUREAU_SEED_FORCE !== '1' && (await alreadySeeded())) {
    console.log('Сид: стенд уже засеян, пересборка пропущена (BUREAU_SEED_FORCE=1 — пересобрать).')
    return
  }

  console.log('Сид: чистим прошлый прогон…')

  /*
   * Адреса выдуманных собираются до удаления, а не после: записи об
   * отправленных письмах не привязаны внешним ключом ни к проекту, ни к
   * человеку, и после удаления искать их будет уже не по чему.
   *
   * Убираются только письма о выдуманных. Журнал целиком стирать нельзя: на
   * пилоте это список тех, кого бюро зовёт руками при выключенной почте, и он
   * не про сид.
   */
  const invented = [
    ...(
      await prisma.specialist.findMany({
        where: { accessKey: { startsWith: 'seed-key-' } },
        select: { email: true },
      })
    ).map((row) => row.email),
    ...(
      await prisma.project.findMany({
        where: { clientKey: { startsWith: 'seed-brief-' } },
        select: { clientEmail: true },
      })
    ).map((row) => row.clientEmail),
  ]

  if (invented.length > 0) {
    await prisma.notification.deleteMany({ where: { email: { in: invented } } })
  }

  // Убираются только выдуманные записи. Живые заявки и брифы не трогаются.
  await prisma.project.deleteMany({ where: { clientKey: { startsWith: 'seed-brief-' } } })
  await prisma.specialist.deleteMany({ where: { accessKey: { startsWith: 'seed-key-' } } })

  const pool = demoPool()
  console.log(`Сид: кладём ${pool.length} специалистов…`)

  for (const person of pool) {
    await prisma.specialist.create({
      data: {
        displayName: person.displayName,
        email: person.email,
        accessKey: person.accessKey,
        // Заявка на разборе ещё не имеет рейтинга: его ставит бюро (п.9).
        status: person.status,
        portfolioRating: person.status === 'pending' ? 0 : person.portfolioRating,
        portfolioUrl: person.portfolioUrl,

        disciplinesJson: toList(person.disciplines),
        specializationsJson: toList(person.specializations),
        typologiesJson: toList(person.typologies),
        scaleBandsJson: toList(person.scaleBands),
        maxStoreys: person.maxStoreys,
        materialSystemsJson: toList(person.materialSystems),
        climateZonesJson: toList(person.climateZones),
        jurisdictionsJson: toList(person.jurisdictions),
        signsInJson: toList(person.signsIn),
        softwareJson: toList(person.software),
        ifcLevel: person.ifcLevel,
        docStagesJson: toList(person.docStages),
        regulatoryTracksJson: toList(person.regulatoryTracks),
        languagesJson: toList(person.languages),
        workMode: person.workMode,
        utcOffset: person.utcOffset,
        weeklyCapacityHours: person.weeklyCapacityHours,
        leadTimeDays: person.leadTimeDays,
        subscription: person.subscription,
        availabilityStatus:
          person.weeklyCapacityHours === 0
            ? 'busy'
            : person.weeklyCapacityHours < 15
              ? 'part_time'
              : 'available',

        deliveredTickets: person.delivery.deliveredTickets,
        onTimeTickets: person.delivery.onTimeTickets,
        firstTimeRightTickets: person.delivery.firstTimeRightTickets,
        responseMinutesTotal: person.delivery.responseMinutesTotal,
        revisionRoundsTotal: person.delivery.revisionRoundsTotal,

        // Портфолио: у конструктора нет красивых картинок, у него узлы и
        // скриншоты модели. Поэтому важнее картинки — что человек делал.
        portfolio: {
          create: [
            {
              title: 'A work from the portfolio',
              kind: person.disciplines.includes('visualization') ? 'render' : 'drawing',
              url: person.portfolioUrl,
              roleDescription: 'Led the section end to end: from brief to delivery.',
              softwareJson: toList(person.software),
              areaSqm: 480,
              durationMonths: 4,
            },
          ],
        },
      },
    })
  }

  console.log('Сид: заводим проекты и прогоняем сборку…')

  const createdIds: string[] = []

  for (const seed of SEED_PROJECTS) {
    const project = await prisma.project.create({
      data: {
        clientKey: seed.clientKey,
        title: seed.title,
        clientName: seed.clientName,
        clientEmail: seed.clientEmail,
        typology: seed.typology,
        storeys: seed.storeys,
        areaSqm: seed.areaSqm,
        jurisdiction: seed.jurisdiction,
        climateZone: seed.climateZone,
        materialSystem: seed.materialSystem,
        regulatoryTrack: 'light',
        targetStage: seed.targetStage,
        terrain: seed.terrain,
        gridConnection: seed.gridConnection,
        softwareJson: toList(seed.software),
        languagesJson: toList(seed.languages),
        requiredHoursPerWeek: seed.requiredHoursPerWeek,
        horizonDays: seed.horizonDays,
        utcOffset: seed.utcOffset,
        briefNotes: seed.briefNotes,
      },
    })

    createdIds.push(project.id)

    const { assembly } = await runAssembly(project.id)
    await prepareDirections(project.id)

    const directions = await prisma.designDirection.findMany({ where: { projectId: project.id } })
    console.log(
      `  ${seed.title}: ${assembly.outcome}, направлений ${directions.length}${assembly.notes ? ` — ${assembly.notes}` : ''}`,
    )
  }

  // На первом проекте направление уже выбрано: команда должна его видеть, а
  // стенд — показывать не только форму выбора, но и её последствие.
  const first = await prisma.designDirection.findFirst({
    where: { projectId: createdIds[0] },
    orderBy: { position: 'asc' },
  })

  if (first) {
    await chooseDirection(createdIds[0], first.key)
    console.log(`  направление первого проекта: ${first.title}`)
  }

  await advanceFirstProject(createdIds[0])
  await raiseStandingConflict(createdIds[1])

  console.log('\nГотово.')
  console.log('  Клиент:     ключи seed-brief-tivat, seed-brief-novisad, seed-brief-athens, seed-brief-rejected')
  console.log(
    `  Специалист: ключи seed-key-01 … seed-key-${DEMO_POOL_SIZE} (входят только подтверждённые)`,
  )
  console.log('  Бюро:       /ops, пароль из BUREAU_OPS_PASSWORD (по умолчанию bureau-ops)')
  console.log('  Направления: BUREAU_IMAGES=stub — это схемы объёма, а не изображения')
  console.log('  Помощники:   BUREAU_ASSIST=stub — черновики по шаблону, без модели')

  const pairs = await prisma.collaboration.count()
  console.log(`  Сработанность: пар с историей — ${pairs}`)
}

/**
 * Доводит первый проект до живой истории: взятие в работу, файл, предъявление,
 * приёмка. После этого у части специалистов появляются настоящие метрики, гейт
 * успевает открыть следующие тикеты, а на стенде видно движение эстафеты.
 *
 * Концепция закрывается целиком, а не на сколько-то тикетов вперёд. Раньше
 * здесь стоял фиксированный счёт шагов, и он молча перестал закрывать стадию,
 * как только в концепции прибавились задачи: стенд остался без единственного
 * места, где видно ожидание подтверждения заказчиком (п.12б). Счёт задач —
 * не то, на что можно опираться, он меняется от матрицы ролей.
 *
 * Один тикет следующей стадии остаётся в конфликте: панель бюро должна
 * показывать не только счастливый путь.
 */
/**
 * Отмечает стадию оплаченной, как это сделало бы бюро, увидев поступление.
 *
 * Без этого стенд стоит целиком: неоплаченная стадия не открывает ни одного
 * тикета (п.14а), и «пустая доска» выглядит как поломка сборки, а не как
 * работающий гейт.
 */
async function payStage(projectId: string, stage: DocStage): Promise<boolean> {
  await issueDueInvoices(projectId)

  const invoice = await prisma.invoice.findUnique({
    where: { projectId_liveStage: { projectId, liveStage: stage } },
  })

  if (!invoice || invoice.status === 'paid') return false

  await markPaid(invoice.id, 'Seeded payment: transfer from the client.')
  await applyGates(projectId)

  console.log(`  оплачена стадия «${stage}»: ${invoice.amount} ${invoice.currency}`)
  return true
}

async function advanceFirstProject(projectId: string): Promise<void> {
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project || project.status === 'rejected') return

  console.log('Сид: прогоняем тикеты через гейты…')

  await payStage(projectId, 'concept')

  // Потолок — страховка от бесконечного цикла, а не план: выход обычный,
  // по отсутствию открытых тикетов концепции.
  for (let step = 0; step < 40; step += 1) {
    await applyGates(projectId)

    const open = await prisma.ticket.findFirst({
      where: { projectId, status: 'open', stage: 'concept' },
      orderBy: { createdAt: 'asc' },
    })

    if (!open?.specialistId) break

    await prisma.ticket.update({
      where: { id: open.id },
      data: { spec: 'Seeded brief: deliverables, bounds and what passes on down the graph.' },
    })

    await claim(open.id, open.specialistId)
    await comment(open.id, { role: 'specialist', specialistId: open.specialistId }, 'Taken on.')
    await attachArtifact(open.id, open.specialistId, {
      name: `${open.title}.ifc`,
      url: 'https://example.com/files/handoff.ifc',
      kind: 'model',
    })
    await submit(open.id, open.specialistId)
    await accept(open.id)

    console.log(`  принят тикет: ${open.title}`)
  }

  // Живой запрос смежнику: рабочий ход между «сделал молча» и арбитражем.
  // Пример взят из переписки: вентканал упирается в дверной проём.
  const asking = await prisma.ticket.findFirst({
    where: { projectId, status: 'accepted', discipline: 'architecture', specialistId: { not: null } },
    orderBy: { createdAt: 'desc' },
  })

  if (asking?.specialistId) {
    const requestId = await requestFrom(
      asking.id,
      asking.specialistId,
      'structural',
      'Check the opening on gridlines 3–4',
      'A 200×400 duct along the wall on gridlines 3–4 runs into the door opening. We need confirmation that the opening can move 200 mm towards gridline 4 without strengthening the lintel.',
    )

    const request = await prisma.ticket.findUniqueOrThrow({ where: { id: requestId } })

    if (request.specialistId) {
      await claim(requestId, request.specialistId)
      await comment(
        requestId,
        { role: 'specialist', specialistId: request.specialistId },
        'A 200 mm shift works, the lintel stays as is.',
      )
      await submit(requestId, request.specialistId)
      await accept(requestId)
      console.log('  запрос смежнику закрыт: сработанность засчитана')
    }
  }

}

/**
 * Один живой конфликт на стенде: арбитраж должно быть на чём показать.
 *
 * Ставится на другом проекте, и это не про удобство. Стадию закрывают двое, и
 * следующая не открывается, пока заказчик не подтвердил (п.12б) — значит на
 * проекте с закрытой концепцией открытых тикетов нет вовсе, и конфликтовать
 * не на чем. Два состояния стенда — «ждём подтверждения» и «идёт спор» — на
 * одном проекте одновременно не живут.
 */
async function raiseStandingConflict(projectId: string): Promise<void> {
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project || project.status === 'rejected') return

  await payStage(projectId, 'concept')
  await applyGates(projectId)

  const next = await prisma.ticket.findFirst({
    where: { projectId, status: 'open', specialistId: { not: null } },
    orderBy: { createdAt: 'asc' },
  })

  if (!next?.specialistId) return

  await claim(next.id, next.specialistId)
  await raiseConflict(
    next.id,
    { role: 'specialist', specialistId: next.specialistId },
    'The duct in the MEP set runs where the architectural set has a door. A decision is needed on which one moves.',
  )
  console.log(`  поднят конфликт на соседнем проекте: ${next.title}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
