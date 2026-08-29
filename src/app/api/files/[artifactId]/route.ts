import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { storage } from '@/lib/storage'
import { currentProjectId, currentSpecialistId, isOperator } from '@/lib/session'

/**
 * Выдача файла проекта.
 *
 * Единственный путь к содержимому: предподписанных ссылок хранилище не выдаёт,
 * и публичных адресов у файлов нет. Ссылка, работающая сама по себе, — это
 * чужой проект в руках любого, кому её переслали, и проверять там уже негде.
 *
 * Право на файл есть у троих, и у каждого по своей причине:
 *
 *  — заказчик проекта: материалы принадлежат ему (п.13);
 *  — бюро: оно принимает работу;
 *  — специалист, если файл лежит в его задаче или пришёл к ней входными
 *    данными — то есть в задаче, от которой его задача зависит и которая
 *    принята. Это ровно то, что он и так видит в своей доске; шире доступа у
 *    него нет, потому что чужая принятая работа ему не полагается (п.11).
 *
 * Отказ везде одинаковый — 404. Разница между «нет файла» и «есть, но не ваш»
 * сама по себе сведения: по ней перебором узнают, что у проекта вообще есть.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ artifactId: string }> },
) {
  const { artifactId } = await params

  const artifact = await prisma.artifact.findUnique({
    where: { id: artifactId },
    include: {
      ticket: {
        select: {
          id: true,
          projectId: true,
          specialistId: true,
          // «Тикеты, которые ждут этот»: связь называется blocks,
          // и её строки указывают на зависящие задачи.
          blocks: { select: { dependentId: true } },
        },
      },
    },
  })

  const missing = () => NextResponse.json({ error: 'Файла нет.' }, { status: 404 })

  if (!artifact?.storageKey) return missing()

  if (!(await mayRead(artifact.ticket))) return missing()

  const file = await storage().get(artifact.storageKey)
  if (!file) return missing()

  return new NextResponse(Buffer.from(file.bytes), {
    headers: {
      'Content-Type': file.contentType || 'application/octet-stream',
      // Имя показывается человеческое, из базы: в ключе его нет намеренно.
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(artifact.name)}`,
      // Файлы проекта не кэшируются посредниками: право на них проверяется
      // каждый раз, а кэш об этом праве ничего не знает.
      'Cache-Control': 'private, no-store',
    },
  })
}

async function mayRead(ticket: {
  id: string
  projectId: string
  specialistId: string | null
  blocks: { dependentId: string }[]
}): Promise<boolean> {
  if (await isOperator()) return true

  const projectId = await currentProjectId()
  if (projectId === ticket.projectId) return true

  const specialistId = await currentSpecialistId()
  if (!specialistId) return false

  // Свой файл в своей задаче.
  if (ticket.specialistId === specialistId) return true

  /*
   * Входные данные: задача, зависящая от этой, принадлежит спрашивающему, а
   * сама эта задача принята. Непринятую работу смежник не видит — иначе он
   * читает черновик, за который автор ещё не отвечает.
   */
  if (ticket.blocks.length === 0) return false

  const own = await prisma.ticket.count({
    where: {
      id: { in: ticket.blocks.map((d) => d.dependentId) },
      specialistId,
    },
  })

  if (own === 0) return false

  const accepted = await prisma.ticket.findUnique({
    where: { id: ticket.id },
    select: { status: true },
  })

  return accepted?.status === 'accepted'
}
