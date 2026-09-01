/**
 * Доска специалиста не показывает всю его историю.
 *
 * Принятые задачи не убывают никогда. Через год работы доска превращалась в
 * стену сданного, сквозь которую надо искать сегодняшнее, — и растёт она у
 * каждого, кто работает. Живые задачи при этом обязаны показываться все:
 * срезанная задача это работа, которую никто не сделает, потому что её никто
 * не увидел.
 *
 * Сценарий заводит себе свой проект и свои задачи: чужие трогать нельзя, а
 * ждать, пока у кого-то на стенде накопится двадцать одна принятая, значит не
 * проверять это никогда.
 */

import { prisma } from '../src/lib/db'
import { ACCEPTED_SHOWN, ticketsOf } from '../src/lib/services/relay'

function check(condition, message) {
  if (!condition) {
    console.error(`  ✗ ${message}`)
    process.exitCode = 1
    return false
  }
  console.log(`  ✓ ${message}`)
  return true
}

console.log('Доска специалиста')

const person = await prisma.specialist.findFirstOrThrow({
  where: { status: 'active' },
  orderBy: { accessKey: 'asc' },
  select: { id: true },
})

const key = `board-${Date.now()}`

const project = await prisma.project.create({
  data: {
    clientKey: key,
    title: 'Проверка доски',
    clientName: 'e2e',
    clientEmail: `${key}@example.invalid`,
    typology: 'villa',
    storeys: 2,
    areaSqm: 200,
    jurisdiction: 'ME',
    climateZone: 'mediterranean',
    materialSystem: 'concrete',
    status: 'delivering',
  },
  select: { id: true },
})

/** Сколько принятых заводится: заведомо больше потолка. */
const ACCEPTED = ACCEPTED_SHOWN + 5
const LIVE = 4

const now = new Date()

await prisma.ticket.createMany({
  data: [
    ...Array.from({ length: ACCEPTED }, (_, i) => ({
      projectId: project.id,
      specialistId: person.id,
      discipline: 'architecture',
      stage: 'concept',
      title: `Принято ${i}`,
      status: 'accepted',
      // Разные моменты приёмки: потолок обязан оставлять последние, а не
      // случайные.
      acceptedAt: new Date(now.getTime() - i * 60_000),
    })),
    ...Array.from({ length: LIVE }, (_, i) => ({
      projectId: project.id,
      specialistId: person.id,
      discipline: 'architecture',
      stage: 'permit',
      title: `В работе ${i}`,
      status: 'open',
      openedAt: now,
    })),
  ],
})

const board = await ticketsOf(person.id)

const own = board.tickets.filter((t) => t.projectId === project.id)
const shownLive = own.filter((t) => t.status !== 'accepted')

/*
 * Потолок считается по человеку, а не по проекту: доска у него одна. Поэтому
 * и проверяется вся доска — у подопытного на стенде есть и прежние приёмки.
 */
const shownAccepted = board.tickets.filter((t) => t.status === 'accepted')

check(
  shownAccepted.length === ACCEPTED_SHOWN,
  `принятых показано по потолку: ${shownAccepted.length}, заведено ${ACCEPTED}`,
)
check(shownLive.length === LIVE, `живые задачи показаны все: ${shownLive.length} из ${LIVE}`)

/*
 * Последние, а не первые попавшиеся: человек сдал работу и смотрит, взяли ли
 * её, — вчерашняя приёмка ему нужнее прошлогодней.
 */
check(
  shownAccepted.every((t) => t.title !== `Принято ${ACCEPTED - 1}`),
  'самая старая приёмка за потолком осталась',
)
check(
  shownAccepted.some((t) => t.title === 'Принято 0'),
  'самая свежая приёмка показана',
)

check(
  board.acceptedTotal >= ACCEPTED,
  `сколько принятых всего — сказано честно: ${board.acceptedTotal}`,
)

await prisma.ticket.deleteMany({ where: { projectId: project.id } })
await prisma.project.delete({ where: { id: project.id } })
await prisma.$disconnect()

console.log(process.exitCode ? '\nЕсть расхождения.' : '\nВсё сошлось.')
