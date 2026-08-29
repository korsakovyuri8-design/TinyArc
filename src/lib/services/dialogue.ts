/**
 * Разговор заказчика с бюро.
 *
 * Blind Relay закрывает каналы между специалистами (п.11). У заказчика
 * контрагент один, и это бюро (п.6) — поэтому здесь канал есть, и он должен
 * быть: человек, отдавший участок и деньги, после брифа оставался зрителем.
 * Сказать «сдвиньте срок на месяц» или «я передумал по направлению» ему было
 * некуда, а контактов бюро в системе нет вовсе.
 *
 * Чего этот канал не делает: он не соединяет заказчика с исполнителями.
 * Сказанное переводит в постановку бюро — иначе клиент начинает руководить
 * командой напрямую, и ответственность, на которой держится продукт,
 * рассыпается на «но он же сам просил».
 */

import { prisma } from '../db'

/** Дольше этого вопрос без ответа — уже не задержка, а неуважение. */
export const ANSWER_SLA_HOURS = 24

export class MessageRefused extends Error {}

export async function say(projectId: string, body: string): Promise<void> {
  const text = body.trim()
  if (!text) throw new MessageRefused('The message is empty.')
  if (text.length > 4000) throw new MessageRefused('Too long: up to four thousand characters.')

  await prisma.clientMessage.create({
    data: { projectId, authorRole: 'client', body: text },
  })
}

/**
 * Ответ бюро.
 *
 * Ответ закрывает все висящие вопросы по проекту разом: заказчик задал три
 * вопроса подряд — это один разговор, а не три очереди.
 */
export async function answer(projectId: string, body: string): Promise<void> {
  const text = body.trim()
  if (!text) throw new MessageRefused('The answer is empty.')

  await prisma.$transaction([
    prisma.clientMessage.create({
      data: { projectId, authorRole: 'bureau', body: text },
    }),
    prisma.clientMessage.updateMany({
      where: { projectId, authorRole: 'client', answeredAt: null },
      data: { answeredAt: new Date() },
    }),
  ])
}

export async function threadOf(projectId: string) {
  return prisma.clientMessage.findMany({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
  })
}

export type WaitingQuestion = {
  projectId: string
  projectTitle: string
  body: string
  since: Date
  hours: number
  /** Сколько вопросов по проекту висит без ответа. */
  count: number
}

/**
 * Вопросы, на которые бюро не ответило.
 *
 * Группируются по проекту: три вопроса от одного человека — это один разговор,
 * и три строки в очереди сделали бы вид, будто работы втрое больше.
 */
export async function waitingQuestions(now = new Date()): Promise<WaitingQuestion[]> {
  const rows = await prisma.clientMessage.findMany({
    where: { authorRole: 'client', answeredAt: null },
    orderBy: { createdAt: 'asc' },
    include: { project: { select: { title: true } } },
  })

  const byProject = new Map<string, WaitingQuestion>()

  for (const row of rows) {
    const existing = byProject.get(row.projectId)

    if (existing) {
      existing.count += 1
      // Показываем последнее сказанное: оно обычно и есть суть.
      existing.body = row.body
      continue
    }

    byProject.set(row.projectId, {
      projectId: row.projectId,
      projectTitle: row.project.title,
      body: row.body,
      since: row.createdAt,
      hours: (now.getTime() - row.createdAt.getTime()) / 3_600_000,
      count: 1,
    })
  }

  return [...byProject.values()].sort((a, b) => b.hours - a.hours)
}
