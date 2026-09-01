/**
 * Очередь несобравшихся брифов не растёт вместе с историей.
 *
 * Это единственная очередь бюро, которой потолок нужен по природе. Счета,
 * подтверждения и вопросы убывают, когда бюро работает; эта не убывает
 * никогда: бриф, под который так и не нашлось человека, остаётся черновиком
 * навсегда — и на запуске, с тонким пулом, растёт быстрее всех. Три с
 * половиной тысячи таких брифов давали два мегабайта разметки и секунду на
 * главной странице панели, той самой, которую открывают каждый день.
 *
 * Потолок обязан быть честным: счёт над списком показывает всё, а не
 * показанное. Сотня из трёх тысяч, выданная молча, читается как «всего сотня»
 * — и найм под неё планируют неправильно.
 *
 * Сценарий заводит себе свои брифы и в конце убирает: чужие черновики трогать
 * нельзя, а ждать, пока на стенде накопится сотня, значит не проверять это
 * никогда.
 */

import { prisma } from '../src/lib/db'
import { LOST_SHOWN, lostProjects } from '../src/lib/services/demand'

function check(condition, message) {
  if (!condition) {
    console.error(`  ✗ ${message}`)
    process.exitCode = 1
    return false
  }
  console.log(`  ✓ ${message}`)
  return true
}

console.log('Очередь несобравшихся брифов')

const before = await lostProjects()

/** Заводится заведомо больше потолка. */
const EXTRA = 5
const MADE = LOST_SHOWN + EXTRA

const stamp = `demand-${Date.now()}`

const made: string[] = []

for (let i = 0; i < MADE; i += 1) {
  const project = await prisma.project.create({
    data: {
      clientKey: `${stamp}-${i}`,
      title: `Бриф без команды ${i}`,
      clientName: 'e2e',
      clientEmail: `${stamp}-${i}@example.invalid`,
      typology: 'villa',
      storeys: 2,
      areaSqm: 200,
      jurisdiction: 'GR',
      climateZone: 'mediterranean',
      materialSystem: 'concrete',
      status: 'draft',
    },
    select: { id: true },
  })

  made.push(project.id)
}

await prisma.matchRun.createMany({
  data: made.map((projectId) => ({
    projectId,
    outcome: 'no_signatory',
    pooledCount: 93,
    survivedCount: 4,
  })),
})

/*
 * Собравшийся проект в очереди делать нечего, и проверяется это здесь же:
 * прогон повторяют после пополнения пула, и вчерашняя неудача не должна
 * оставаться в списке найма навсегда.
 */
const assembled = await prisma.project.create({
  data: {
    clientKey: `${stamp}-assembled`,
    title: 'Бриф, собравшийся со второго раза',
    clientName: 'e2e',
    clientEmail: `${stamp}-assembled@example.invalid`,
    typology: 'villa',
    storeys: 2,
    areaSqm: 200,
    jurisdiction: 'GR',
    climateZone: 'mediterranean',
    materialSystem: 'concrete',
    status: 'assembled',
  },
  select: { id: true },
})

await prisma.matchRun.create({
  data: { projectId: assembled.id, outcome: 'ok', pooledCount: 93, survivedCount: 12 },
})

const after = await lostProjects()

check(
  after.rows.length === LOST_SHOWN,
  `список по потолку: ${after.rows.length}, заведено ${MADE}`,
)
check(
  after.total === before.total + MADE,
  `счёт говорит обо всех: ${after.total} при ${before.total} до прогона`,
)
check(
  after.total > after.rows.length,
  'счёт и список расходятся — значит, потолок виден бюро числом',
)
check(
  !after.rows.some((row) => row.projectId === assembled.id),
  'собравшийся со второго раза в очередь не попал',
)

/*
 * Порядок — по времени ожидания, а не какой попало: пул пополняют под тех, кто
 * ждёт дольше всех, и срезать надо хвост, а не голову.
 */
const waits = after.rows.map((row) => row.since.getTime())
check(
  waits.every((value, i) => i === 0 || waits[i - 1] <= value),
  'первым показан тот, кто ждёт дольше всех',
)

await prisma.project.deleteMany({ where: { id: { in: [...made, assembled.id] } } })

const restored = await lostProjects()
check(restored.total === before.total, `стенд возвращён как был: ${restored.total}`)

await prisma.$disconnect()

console.log(process.exitCode ? '\nЕсть расхождения.' : '\nВсё сошлось.')
