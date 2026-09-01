/**
 * Направления проекта: генерация вариантов и фиксация выбора.
 *
 * Движок решает, какие направления вообще применимы к этому участку
 * (src/engine/direction.ts). Здесь — получение изображений и запись.
 */

import { directionsFor, promptFor } from '@/engine/direction'
import type { ProjectShape } from '@/engine/taxonomy'
import { images, massingDataUri } from '../images'
import { prisma } from '../db'
import { toRequirements } from '../rows'

function shapeOf(project: Parameters<typeof toRequirements>[0]): ProjectShape {
  const requirements = toRequirements(project)

  return {
    typology: requirements.typology,
    targetStage: requirements.targetStage,
    materialSystem: requirements.materialSystem,
    terrain: requirements.terrain,
    gridConnection: requirements.gridConnection,
  }
}

/**
 * Готовит направления под проект.
 *
 * Изображения запрашиваются параллельно. С режимом `stub` это мгновенно; с
 * настоящим генератором — секунды, и тогда это место надо выносить в очередь:
 * держать человека на форме, пока рисуются четыре картинки, нельзя. Пока
 * генератор по умолчанию `stub`, вынос очереди был бы работой вперёд нужды.
 */
export async function prepareDirections(projectId: string): Promise<void> {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })

  // Проект вне продуктовой границы направлений не получает: предлагать выбрать
  // облик тому, кому мы отказали, — издевательство.
  if (project.status === 'rejected') return

  const shape = shapeOf(project)
  const generator = images()

  const prepared = await Promise.all(
    directionsFor(shape).map(async (direction, position) => {
      const prompt = promptFor(
        shape,
        project.areaSqm,
        project.storeys,
        project.climateZone,
        direction.key,
      )

      try {
        const image = await generator.generate({
          key: direction.key,
          title: direction.title,
          prompt,
        })

        return { direction, position, prompt, url: image.url, source: image.source }
      } catch (error) {
        // Упавший генератор не должен стоить клиенту выбора: схема объёма
        // говорит о направлении ровно то же, что картинка.
        console.error(`Изображение направления «${direction.key}» не получено:`, error)

        return {
          direction,
          position,
          prompt,
          url: massingDataUri(direction.key, direction.title),
          source: 'stub',
        }
      }
    }),
  )

  await prisma.$transaction(async (tx) => {
    await tx.designDirection.deleteMany({ where: { projectId } })

    for (const item of prepared) {
      await tx.designDirection.create({
        data: {
          projectId,
          key: item.direction.key,
          position: item.position,
          title: item.direction.title,
          summary: item.direction.summary,
          tradeoff: item.direction.tradeoff,
          prompt: item.prompt,
          imageUrl: item.url,
          source: item.source,
        },
      })
    }
  })

}

export async function directionsOf(projectId: string) {
  return prisma.designDirection.findMany({
    where: { projectId },
    orderBy: { position: 'asc' },
  })
}

export async function chosenDirection(projectId: string) {
  return prisma.designDirection.findFirst({ where: { projectId, chosen: true } })
}

/** Дольше этого направление ждёт заказчика — бюро пора спросить. */
export const DIRECTION_NUDGE_HOURS = 72

export type PendingDirection = {
  projectId: string
  projectTitle: string
  /** Сколько часов направления лежат невыбранными. */
  hours: number
  /** Открытых задач по проекту: столько людей уже работает без ответа. */
  working: number
}

/**
 * Проекты, где направления готовы, а выбора нет.
 *
 * Это очередь, а не гейт, и разница здесь принципиальная. Гейтов три — граф,
 * подтверждение и оплата (п.14а), — и четвёртый останавливал бы работу там,
 * где концепт её не останавливает. Но молчание заказчика тут не бесплатно:
 * направления готовятся сразу после сборки, потому что выбор нужен команде до
 * первого тикета, а не когда по нему уже что-то нарисовали. Пока выбора нет,
 * архитектор и визуализатор работают вслепую — и переделывать будем мы.
 *
 * У всех остальных ожиданий заказчика очередь в панели есть: счёт, стадия,
 * вопрос. У этого не было, и увидеть простой было неоткуда.
 */
export async function awaitingDirection(now = new Date()): Promise<PendingDirection[]> {
  const projects = await prisma.project.findMany({
    where: {
      status: { in: ['assembled', 'delivering'] },
      // Направления готовы, но ни одно не выбрано. Проект без направлений
      // сюда не попадает: там ждать нечего, готовить ещё не начали.
      directions: { some: {}, none: { chosen: true } },
    },
    select: {
      id: true,
      title: true,
      directions: { select: { createdAt: true }, orderBy: { createdAt: 'asc' }, take: 1 },
      _count: { select: { tickets: { where: { status: { in: ['open', 'in_progress'] } } } } },
    },
  })

  return projects
    .map((project) => ({
      projectId: project.id,
      projectTitle: project.title,
      hours: project.directions[0]
        ? (now.getTime() - project.directions[0].createdAt.getTime()) / 3_600_000
        : 0,
      working: project._count.tickets,
    }))
    .sort((a, b) => b.hours - a.hours)
}

export class UnknownDirection extends Error {
  constructor() {
    super('This project has no such direction.')
    this.name = 'UnknownDirection'
  }
}

export class DirectionClosed extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DirectionClosed'
  }
}

/**
 * Открыт ли ещё выбор направления.
 *
 * Направление — фиксация намерения до начала работ (п.7а), и смысл у него
 * ровно один: команде есть куда двигаться. Отсюда граница — не «работа ещё не
 * началась», а «выбор ещё до кого-то доходит».
 *
 * Поэтому `delivering` остаётся открытым: пока хоть один тикет жив, невыбранное
 * направление означает, что архитектор и визуализатор работают вслепую, и
 * очередь бюро (`awaitingDirection`) именно этого и ждёт. Закрыто там, где
 * ждать больше некому: проект сдан или мы за него не взялись.
 */
export function directionOpen(status: string): boolean {
  return status !== 'delivered' && status !== 'rejected'
}

/**
 * Фиксирует выбор клиента.
 *
 * Выбранное направление ровно одно: «нравится и то и это» — это не решение, а
 * его отсутствие, и команде оно ничего не сообщает.
 */
export async function chooseDirection(projectId: string, key: string): Promise<void> {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { status: true },
  })

  /*
   * Закрытый проект выбора не принимает.
   *
   * На сданном проекте экран предлагал сменить направление и обещал, что
   * «выбор дойдёт до команды раньше первого тикета», — тикетов не осталось ни
   * одного, все приняты и подтверждены. Запись менялась, комплект оставался
   * прежним, и в кабинете появлялось направление, которому не соответствует
   * ни один выданный документ. На отказном — тем более: направлений там нет
   * вовсе, но форма отправляется адресом и без экрана.
   */
  if (!directionOpen(project.status)) {
    throw new DirectionClosed(
      project.status === 'rejected'
        ? 'This project is outside the product boundary: there is no team for a direction to reach.'
        : 'The project is closed. The direction stays as the record of what was fixed at the start; a new direction is new work — write to the bureau.',
    )
  }

  const direction = await prisma.designDirection.findUnique({
    where: { projectId_key: { projectId, key } },
  })

  if (!direction) throw new UnknownDirection()

  await prisma.$transaction([
    prisma.designDirection.updateMany({ where: { projectId }, data: { chosen: false } }),
    prisma.designDirection.update({ where: { id: direction.id }, data: { chosen: true } }),
  ])
}
