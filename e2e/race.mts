/**
 * Гонки: два запроса в один момент на одну запись.
 *
 * Все переходы состояния были устроены одинаково — прочитали статус,
 * проверили, записали. Между чтением и записью успевает второй запрос, и это
 * не теория: на этом же стенде две одновременные приёмки прошли обе и начислили
 * человеку двойной зачёт по метрикам поставки. По ним решается его доступ к
 * следующим проектам, то есть ошибка не «неаккуратная цифра», а чужая работа,
 * отданная не тому.
 *
 * Проверяется не «второй вызов вернул ошибку» — это следствие. Проверяется
 * состояние базы после двух одновременных вызовов: счётчик вырос на единицу,
 * круг записан один, дата поступления не переписана.
 *
 * Сценарий работает с сервисами напрямую, минуя браузер: гонку надо создать
 * настоящую, а два щелчка мышью сериализуются сетью и не докажут ничего.
 *
 * Всё состояние он готовит себе сам. Полагаться на то, что нужную задачу или
 * неоплаченный счёт оставит предыдущий сценарий в цепочке, нельзя: порядок
 * однажды поменяют, и проверки начнут молча пропускаться, оставаясь зелёными.
 * Заготовки пишутся в базу напрямую — гонка проверяется в переходе, а не в
 * том, как задача до этого перехода дошла.
 */

import type { DocStage } from '../src/engine/taxonomy'
import { dueDate } from '../src/engine/relay'
import { prisma } from '../src/lib/db'
import { unpaidInvoice } from './stand.mts'
import { accept, claim, requestRevision, submit } from '../src/lib/services/relay'
import { markPaid } from '../src/lib/services/billing'
import { approveStage } from '../src/lib/services/approval'

function check(condition, message) {
  if (!condition) {
    console.error(`  ✗ ${message}`)
    process.exitCode = 1
    return false
  }
  console.log(`  ✓ ${message}`)
  return true
}

console.log('Гонки')

/* --- Заготовки -------------------------------------------------------------- */

/**
 * Задачи с исполнителем, приведённые в состояние «выдана».
 *
 * Берутся те, что ещё не предъявлены: переписывать принятую работу значит
 * задним числом менять историю, по которой считаются чужие метрики.
 */
async function claimable(count: number) {
  const found = await prisma.ticket.findMany({
    where: { specialistId: { not: null }, status: { in: ['blocked', 'open', 'in_progress'] } },
    orderBy: { id: 'asc' },
    take: count,
    select: { id: true, specialistId: true, revisionRounds: true, slaHours: true },
  })

  const now = new Date()

  for (const ticket of found) {
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: 'open',
        openedAt: now,
        claimedAt: null,
        submittedAt: null,
        dueAt: dueDate(now, ticket.slaHours),
      },
    })
  }

  return found
}

/**
 * Стадия, которую заказчик вправе подтвердить: все её задачи приняты бюро и
 * подтверждения ещё нет.
 */
async function approvable() {
  const rows = await prisma.ticket.findMany({
    select: { projectId: true, stage: true },
  })

  for (const row of rows) {
    const already = await prisma.stageApproval.count({
      where: { projectId: row.projectId, stage: row.stage },
    })

    if (already > 0) continue

    await prisma.ticket.updateMany({
      where: { projectId: row.projectId, stage: row.stage },
      data: { status: 'accepted' },
    })

    return { projectId: row.projectId, stage: row.stage as DocStage }
  }

  return null
}

const spare = await claimable(3)
check(spare.length >= 3, `задач для проверки гонок: ${spare.length}`)

/* --- Приёмка: счётчики поставки ------------------------------------------- */

{
  const ticket = spare[0]

  if (!ticket?.specialistId) {
    check(false, 'на стенде нет взятой задачи')
  } else {
    await claim(ticket.id, ticket.specialistId)
    await submit(ticket.id, ticket.specialistId)

    const before = await prisma.specialist.findUniqueOrThrow({
      where: { id: ticket.specialistId },
      select: { deliveredTickets: true, onTimeTickets: true },
    })

    const results = await Promise.allSettled([
      accept(ticket.id),
      accept(ticket.id),
      accept(ticket.id),
    ])

    const after = await prisma.specialist.findUniqueOrThrow({
      where: { id: ticket.specialistId },
      select: { deliveredTickets: true, onTimeTickets: true },
    })

    const passed = results.filter((r) => r.status === 'fulfilled').length

    check(passed === 1, `из трёх одновременных приёмок прошла одна: ${passed}`)
    check(
      after.deliveredTickets - before.deliveredTickets === 1,
      `зачёт поставки одинарный: +${after.deliveredTickets - before.deliveredTickets}`,
    )
    check(
      after.onTimeTickets - before.onTimeTickets <= 1,
      `срок засчитан один раз: +${after.onTimeTickets - before.onTimeTickets}`,
    )
  }
}

/* --- Возврат на круг: круги правок ---------------------------------------- */

{
  const ticket = spare[1]

  if (!ticket?.specialistId) {
    check(false, 'нет второй задачи для проверки кругов')
  } else {
    await claim(ticket.id, ticket.specialistId)
    await submit(ticket.id, ticket.specialistId)

    await Promise.allSettled([
      requestRevision(ticket.id, 'e2e: гонка, первый'),
      requestRevision(ticket.id, 'e2e: гонка, второй'),
    ])

    const after = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
      select: { revisionRounds: true },
    })

    // Круги идут в метрику «сдано с первого раза»: лишний круг — это чужая
    // работа, записанная человеку в минус.
    check(
      after.revisionRounds - ticket.revisionRounds === 1,
      `круг записан один: +${after.revisionRounds - ticket.revisionRounds}`,
    )
  }
}

/* --- Взятие в работу: время реакции ---------------------------------------- */

{
  const ticket = spare[2]

  if (!ticket?.specialistId) {
    check(false, 'нет третьей задачи для проверки взятия в работу')
  } else {
    const results = await Promise.allSettled([
      claim(ticket.id, ticket.specialistId),
      claim(ticket.id, ticket.specialistId),
    ])

    const passed = results.filter((r) => r.status === 'fulfilled').length
    check(passed === 1, `из двух одновременных взятий прошло одно: ${passed}`)
  }
}

/* --- Оплата: дата поступления ---------------------------------------------- */

{
  const invoice = await unpaidInvoice()

  if (!invoice) {
    check(false, 'не удалось выставить счёт для проверки')
  } else {
    const clicks = ['первое нажатие', 'второе нажатие', 'третье нажатие']

    await Promise.allSettled(clicks.map((note) => markPaid(invoice.id, note)))

    const after = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoice.id },
      select: { status: true, paidNote: true, paidAt: true },
    })

    check(after.status === 'paid', 'счёт оплачен')

    /*
     * Из трёх одновременных нажатий записалось ровно одно — какое именно, не
     * определено, и определённым быть не может.
     *
     * Первая редакция проверки ждала здесь первое по порядку вызова и
     * проходила на SQLite: там пишет один, и выигрывает тот, кто начал раньше.
     * На живом Postgres проверка упала — соединений несколько, и блокировку
     * строки берёт тот, кто успел, а не тот, кого позвали первым. Ошибка была
     * в проверке, а не в коде: оператор, нажавший трижды, получает одно из
     * своих же трёх примечаний.
     */
    check(
      clicks.includes(after.paidNote),
      `записано одно из нажатий целиком: «${after.paidNote}»`,
    )

    /*
     * А вот это — то, ради чего проверка и стоит: отметка оплаты не
     * переписывается позже. Дата поступления и то, чем её подтвердили, —
     * факт, а не последнее нажатие.
     */
    const was = { note: after.paidNote, at: after.paidAt?.getTime() }

    await markPaid(invoice.id, 'нажатие через минуту')

    const later = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoice.id },
      select: { paidNote: true, paidAt: true },
    })

    check(
      later.paidNote === was.note && later.paidAt?.getTime() === was.at,
      `повторная отметка не переписала ни примечание, ни дату: «${later.paidNote}»`,
    )
  }
}

/* --- Подтверждение стадии --------------------------------------------------- */

{
  const target = await approvable()

  if (!target) {
    check(false, 'не удалось найти стадию для подтверждения')
  } else {
    const results = await Promise.allSettled([
      approveStage(target.projectId, target.stage, 'первое'),
      approveStage(target.projectId, target.stage, 'второе'),
    ])

    const rows = await prisma.stageApproval.count({
      where: { projectId: target.projectId, stage: target.stage },
    })

    // Проверка не должна проходить оттого, что подтвердить было нечего:
    // строка обязана появиться ровно одна, а не «не более одной».
    check(rows === 1, `подтверждение стадии записано ровно один раз: ${rows}`)
    check(
      results.every((r) => r.status === 'fulfilled'),
      'второе подтверждение прошло молча, а не грубой ошибкой базы',
    )
  }
}

await prisma.$disconnect()

console.log(process.exitCode ? '\nЕсть расхождения.' : '\nВсё сошлось.')
