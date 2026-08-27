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

export class UnknownDirection extends Error {
  constructor() {
    super('Такого направления у этого проекта нет.')
    this.name = 'UnknownDirection'
  }
}

/**
 * Фиксирует выбор клиента.
 *
 * Выбранное направление ровно одно: «нравится и то и это» — это не решение, а
 * его отсутствие, и команде оно ничего не сообщает.
 */
export async function chooseDirection(projectId: string, key: string): Promise<void> {
  const direction = await prisma.designDirection.findUnique({
    where: { projectId_key: { projectId, key } },
  })

  if (!direction) throw new UnknownDirection()

  await prisma.$transaction([
    prisma.designDirection.updateMany({ where: { projectId }, data: { chosen: false } }),
    prisma.designDirection.update({ where: { id: direction.id }, data: { chosen: true } }),
  ])
}
