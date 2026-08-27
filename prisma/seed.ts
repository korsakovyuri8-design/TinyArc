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
import { runAssembly } from '../src/lib/services/matching'
import {
  accept,
  applyGates,
  attachArtifact,
  claim,
  comment,
  raiseConflict,
  submit,
} from '../src/lib/services/relay'

const prisma = new PrismaClient({ adapter: adapterFor(databaseUrl()) })

const SEED_PROJECTS = [
  {
    clientKey: 'seed-brief-tivat',
    title: 'Вилла в Тивате',
    clientName: 'Марина',
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
      'Участок с уклоном к морю. Важен вид с верхнего этажа и теневой двор. Склон крутой — нужна вертикальная планировка.',
  },
  {
    clientKey: 'seed-brief-novisad',
    title: 'Townhouse в Нови-Саде',
    clientName: 'Душан',
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
    briefNotes: 'Четыре секции, общий двор. Нужен внятный расчёт по инсоляции.',
  },
  {
    clientKey: 'seed-brief-athens',
    title: 'Mixed-use в Афинах',
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
    briefNotes: 'Первый этаж — коммерция, выше жильё. Ограничение по высоте по кварталу.',
  },
  {
    // Намеренно вне продуктовой границы: стенд должен показывать и отказ (п.5).
    clientKey: 'seed-brief-rejected',
    title: 'Девятиэтажка в Баре',
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
    briefNotes: 'Девять этажей — проверка того, что движок отказывает, а не тянет.',
  },
] as const

async function main() {
  console.log('Сид: чистим прошлый прогон…')

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
              title: 'Работа из портфолио',
              kind: person.disciplines.includes('visualization') ? 'render' : 'drawing',
              url: person.portfolioUrl,
              roleDescription: 'Вёл раздел целиком: от постановки до выпуска.',
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
    console.log(`  ${seed.title}: ${assembly.outcome}${assembly.notes ? ` — ${assembly.notes}` : ''}`)
  }

  await advanceFirstProject(createdIds[0])

  console.log('\nГотово.')
  console.log('  Клиент:     ключи seed-brief-tivat, seed-brief-novisad, seed-brief-athens, seed-brief-rejected')
  console.log(
    `  Специалист: ключи seed-key-01 … seed-key-${DEMO_POOL_SIZE} (входят только подтверждённые)`,
  )
  console.log('  Бюро:       /ops, пароль из BUREAU_OPS_PASSWORD (по умолчанию bureau-ops)')
}

/**
 * Доводит первый проект до живой истории: взятие в работу, файл, предъявление,
 * приёмка. После этого у части специалистов появляются настоящие метрики, гейт
 * успевает открыть следующие тикеты, а на стенде видно движение эстафеты.
 *
 * Последний тикет намеренно оставляется в конфликте: панель бюро должна
 * показывать не только счастливый путь.
 */
async function advanceFirstProject(projectId: string): Promise<void> {
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project || project.status === 'rejected') return

  console.log('Сид: прогоняем тикеты через гейты…')

  for (let step = 0; step < 5; step += 1) {
    await applyGates(projectId)

    const open = await prisma.ticket.findFirst({
      where: { projectId, status: 'open' },
      orderBy: { createdAt: 'asc' },
    })

    if (!open?.specialistId) break

    await prisma.ticket.update({
      where: { id: open.id },
      data: { spec: 'Постановка из сида: состав, границы и что передаётся дальше по графу.' },
    })

    await claim(open.id, open.specialistId)
    await comment(open.id, { role: 'specialist', specialistId: open.specialistId }, 'Взял в работу.')
    await attachArtifact(open.id, open.specialistId, {
      name: `${open.title}.ifc`,
      url: 'https://example.com/files/handoff.ifc',
      kind: 'model',
    })
    await submit(open.id, open.specialistId)
    await accept(open.id)

    console.log(`  принят тикет: ${open.title}`)
  }

  // Один живой конфликт на стенде: арбитраж должно быть на чём показать.
  await applyGates(projectId)
  const next = await prisma.ticket.findFirst({
    where: { projectId, status: 'open', specialistId: { not: null } },
    orderBy: { createdAt: 'asc' },
  })

  if (next?.specialistId) {
    await claim(next.id, next.specialistId)
    await raiseConflict(
      next.id,
      { role: 'specialist', specialistId: next.specialistId },
      'Вентканал по инженерному разделу проходит там, где по архитектуре стоит дверь. Нужно решение, что двигать.',
    )
    console.log(`  поднят конфликт: ${next.title}`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
