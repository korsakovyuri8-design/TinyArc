import { NextResponse } from 'next/server'
import { DOC_STAGE_LABELS } from '@/lib/labels'
import { dateTime } from '@/lib/format'
import { packageOf, type PackageStage } from '@/lib/services/package'
import { prisma } from '@/lib/db'
import { storage } from '@/lib/storage'
import { currentProjectId, isOperator } from '@/lib/session'
import { zipStream, type ZipEntry } from '@/lib/zip'
import type { DocStage } from '@/engine/taxonomy'

/**
 * Комплект документации одним архивом.
 *
 * П.13 говорит, что материалы передаются заказчику в полном объёме. По одной
 * ссылке за раз это исполняется терпением: разрешительный пакет — это десятки
 * файлов, и человек, пришедший забрать то, за что заплатил, вместо документации
 * получает работу. Архив — это и есть «в полном объёме», сделанное один раз.
 *
 * Право то же, что и на одиночный файл, и проверяется так же строго: заказчик
 * этого проекта и бюро. Специалиста здесь нет намеренно — он видит свою задачу
 * и входные к ней, а комплект целиком не полагается никому в команде (п.11).
 *
 * Отказ — тот же 404, что и везде: разница между «нет проекта» и «есть, но не
 * ваш» сама по себе сведения.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params
  const missing = () => NextResponse.json({ error: 'No such project.' }, { status: 404 })

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { title: true, dataErasedAt: true },
  })

  if (!project) return missing()

  // Удалённые по обращению данные не воскресают архивом.
  if (project.dataErasedAt) return missing()

  const operator = await isOperator()
  if (!operator && (await currentProjectId()) !== projectId) return missing()

  const stages = await packageOf(projectId)
  const files = stages.flatMap((s) => s.files)
  if (files.length === 0) return missing()

  const body = zipStream(entries(projectId, stages))

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(
        `${archiveName(project.title)}.zip`,
      )}`,
      // Длину заранее не знаем: архив собирается по ходу отдачи. Ответ уходит
      // кусками, и это правильный размен — иначе комплект пришлось бы целиком
      // собрать в памяти, чтобы сообщить число, которое никому не нужно.
      'Cache-Control': 'private, no-store',
    },
  })
}

/**
 * Что кладём в архив.
 *
 * Стадия — папка: комплект читается по стадиям, а плоская куча из сорока
 * файлов читается никак. Файлы, которых у нас нет (внешние ссылки старых
 * записей), в архив попасть не могут — они названы в описи, и это честнее,
 * чем промолчать о них.
 */
async function* entries(projectId: string, stages: PackageStage[]): AsyncGenerator<ZipEntry> {
  const missed: string[] = []
  const store = storage()

  for (const stage of stages) {
    const folder = DOC_STAGE_LABELS[stage.stage as DocStage] ?? stage.stage

    for (const file of stage.files) {
      if (!file.storageKey) {
        missed.push(`${folder} — ${file.name}: ${file.url}`)
        continue
      }

      const stored = await store.get(file.storageKey)

      if (!stored) {
        // Строка есть, файла нет. Молчать нельзя: заказчик пересчитает
        // листы по кабинету и не найдёт этого, а спросить будет не о чем.
        missed.push(`${folder} — ${file.name}: missing from storage`)
        continue
      }

      yield {
        dir: folder,
        name: file.name,
        bytes: stored.bytes,
        modified: file.createdAt,
      }
    }
  }

  yield {
    name: 'CONTENTS.txt',
    bytes: new TextEncoder().encode(manifest(projectId, stages, missed)),
  }
}

/** Опись: что в архиве, по стадиям, и чего в нём нет. */
function manifest(projectId: string, stages: PackageStage[], missed: string[]): string {
  const lines = [
    'TinyArc Cloud Bureau — project documentation set',
    `Assembled: ${dateTime(new Date())}`,
    '',
    'The set builds up as stages close, so it holds every stage closed to date.',
    'Generated images are not part of it at any stage: they are working material,',
    'not documentation.',
    '',
  ]

  for (const stage of stages) {
    lines.push(
      `${DOC_STAGE_LABELS[stage.stage as DocStage] ?? stage.stage} — ${
        stage.approved ? 'confirmed by you' : 'awaiting your confirmation'
      }`,
    )

    for (const file of stage.files) {
      lines.push(`  ${file.name}`)
    }

    lines.push('')
  }

  if (missed.length > 0) {
    lines.push(
      'Not in this archive:',
      ...missed.map((line) => `  ${line}`),
      '',
      'Tell the bureau about anything listed here — it is a gap on our side, not yours.',
      '',
    )
  }

  return lines.join('\n')
}

/**
 * Имя архива из названия проекта.
 *
 * Название писал человек, и в нём бывает всё. Чистится до того, из чего
 * получается имя файла на любой системе; если не осталось ничего — берётся
 * нейтральное, а не пустое.
 */
function archiveName(title: string): string {
  const clean = title
    .split('')
    .filter((ch) => ch.charCodeAt(0) > 0x1f && !'\\/:*?"<>|'.includes(ch))
    .join('')
    .trim()
    .slice(0, 80)

  return clean || 'documentation-set'
}
