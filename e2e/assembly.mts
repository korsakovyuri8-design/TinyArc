/**
 * Пересборка команды не стирает начатую работу.
 *
 * Пересборка снимает прежний состав целиком — половина старой команды и
 * половина новой это не команда, — и вместе с составом удаляет все задачи
 * проекта. Пока проект стоит нетронутым, терять нечего. Как только работа
 * пошла, то же самое удаление уносит принятые задачи, приложенные файлы и
 * переписку по ним.
 *
 * Разрешение на пересборку читалось из поля статуса проекта. Поле — это вывод,
 * сделанный когда-то: его пересчитывают приёмка, подтверждение и оплата, а
 * гейт открывает задачи и сам по себе. Путь, забывший пересчёт, оставляет на
 * проекте «собран», хотя люди уже работают.
 *
 * Проверяется здесь именно это: пересборка на нетронутом проекте проходит, на
 * проекте с начатой задачей — отказывает, и задачи остаются на месте.
 *
 * Проект сценарий заводит свой. Пересборка чужого проекта на стенде снесла бы
 * состояние, которое собирали сценарии до него.
 */

import { prisma } from '../src/lib/db'
import { AssemblyLocked, runAssembly } from '../src/lib/services/matching'

function check(condition, message) {
  if (!condition) {
    console.error(`  ✗ ${message}`)
    process.exitCode = 1
    return false
  }
  console.log(`  ✓ ${message}`)
  return true
}

console.log('Пересборка')

const key = `e2e-assembly-${Date.now()}`

/*
 * Параметры берутся у собранного проекта стенда, а не выдумываются.
 *
 * Выдуманные однажды не совпали с пулом, и сборка вернула «состав не полон»:
 * проверка защиты превратилась бы в проверку того, что на стенде есть нужные
 * люди. Взятые у соседа параметры собираются заведомо — тем же пулом, тем же
 * движком.
 */
const donor = await prisma.project.findFirst({
  where: { status: { in: ['assembled', 'delivering'] } },
  orderBy: { createdAt: 'asc' },
})

if (!donor) {
  check(false, 'на стенде нет собранного проекта, у которого взять параметры')
  await prisma.$disconnect()
  process.exit(1)
}

const project = await prisma.project.create({
  data: {
    clientKey: key,
    title: 'Проверка пересборки',
    clientName: 'e2e',
    clientEmail: `${key}@example.invalid`,
    typology: donor.typology,
    storeys: donor.storeys,
    areaSqm: donor.areaSqm,
    jurisdiction: donor.jurisdiction,
    climateZone: donor.climateZone,
    materialSystem: donor.materialSystem,
    regulatoryTrack: donor.regulatoryTrack,
    targetStage: donor.targetStage,
    terrain: donor.terrain,
    gridConnection: donor.gridConnection,
    softwareJson: donor.softwareJson,
    languagesJson: donor.languagesJson,
    requiredHoursPerWeek: donor.requiredHoursPerWeek,
    horizonDays: donor.horizonDays,
    utcOffset: donor.utcOffset,
  },
})

/* --- Нетронутый проект собирается и пересобирается ------------------------- */

const first = await runAssembly(project.id)
check(first.assembly.outcome === 'ok', `команда собралась: ${first.assembly.outcome}`)

const planned = await prisma.ticket.count({ where: { projectId: project.id } })
check(planned > 0, `задачи заведены: ${planned}`)

/*
 * Вторая сборка подряд обязана пройти: работа ещё не начиналась, и терять
 * нечего. Без этой проверки защита ниже могла бы запрещать вообще всё и
 * выглядеть работающей.
 */
const second = await runAssembly(project.id)
check(second.assembly.outcome === 'ok', 'нетронутый проект пересобирается')
check(second.runId !== first.runId, 'это новый прогон, а не старый')

/* --- Начатая работа пересборку останавливает ------------------------------- */

const ticket = await prisma.ticket.findFirstOrThrow({
  where: { projectId: project.id },
  select: { id: true },
})

// Задача взята в работу. Поле статуса проекта при этом намеренно не трогаем:
// проверяется, что защита смотрит на задачи, а не на него.
await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'in_progress' } })

const before = await prisma.ticket.count({ where: { projectId: project.id } })

let refused = false
try {
  await runAssembly(project.id)
} catch (error) {
  refused = error instanceof AssemblyLocked
}

check(refused, 'пересборка проекта с начатой задачей отклонена')

const after = await prisma.ticket.count({ where: { projectId: project.id } })
check(after === before, `задачи на месте: ${before} → ${after}`)

const still = await prisma.ticket.count({
  where: { projectId: project.id, status: 'in_progress' },
})
check(still === 1, 'взятая в работу задача не потерялась')

/*
 * И то же самое с устаревшим полем статуса. Это тот самый случай, ради
 * которого проверка переехала внутрь транзакции: поле говорит «собран»,
 * задачи говорят «идёт работа», и верить надо задачам.
 */
await prisma.project.update({ where: { id: project.id }, data: { status: 'assembled' } })

let refusedAgain = false
try {
  await runAssembly(project.id)
} catch (error) {
  refusedAgain = error instanceof AssemblyLocked
}

check(refusedAgain, 'устаревшее поле статуса пересборку не разрешает')

/*
 * Убираем за собой целиком.
 *
 * Проект уносит каскадом свои задачи и счета, а журнал писем каскада не знает:
 * повод пережил бы проект и остался строкой с адресом, за которым ничего нет.
 * Проверка адресатов у писем читает базу и честно объявила бы такую строку
 * ушедшей не туда.
 */
await prisma.notification.deleteMany({ where: { email: `${key}@example.invalid` } })
await prisma.project.delete({ where: { id: project.id } })

await prisma.$disconnect()

console.log(process.exitCode ? '\nЕсть расхождения.' : '\nВсё сошлось.')
