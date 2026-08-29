'use server'

import { revalidatePath } from 'next/cache'
import { allow } from '@/lib/guard'
import { retryMessage } from '@/lib/rate-limit'
import { DOC_STAGES, type DocStage } from '@/engine/taxonomy'
import { ApprovalRefused, approveStage } from '@/lib/services/approval'
import { MessageRefused, say } from '@/lib/services/dialogue'
import { applyGates, refreshProjectStatus } from '@/lib/services/relay'
import { currentProjectId } from '@/lib/session'

export type ProjectState = { error?: string; message?: string }

/**
 * Заказчик пишет бюро.
 *
 * Единственный канал, который у него есть, и единственный, который ему нужен:
 * его контрагент — бюро, а не команда. Исполнители этой переписки не видят —
 * сказанное переводит в постановку бюро, иначе клиент начинает руководить
 * командой напрямую (п.6, п.11).
 */
export async function sendToBureau(
  _prev: ProjectState,
  formData: FormData,
): Promise<ProjectState> {
  const projectId = await currentProjectId()
  if (!projectId) return { error: 'Сначала войдите по ключу.' }

  const verdict = await allow('clientMessage')
  if (!verdict.allowed) return { error: retryMessage(verdict.retryAfterSeconds) }

  try {
    await say(projectId, String(formData.get('body') ?? ''))
    revalidatePath('/project')

    return { message: 'Отправлено бюро. Ответ появится здесь же.' }
  } catch (error) {
    if (error instanceof MessageRefused) return { error: error.message }

    console.error('Сообщение бюро не отправлено:', error)
    return { error: 'Не отправилось. Попробуйте ещё раз.' }
  }
}

/**
 * Заказчик подтверждает стадию.
 *
 * Приёмка бюро означает «сделано как заказано». Это — «заказано было именно
 * это». До подтверждения следующая стадия не открывается: разрабатывать
 * документацию по неподтверждённой концепции значит готовить переделку.
 *
 * Замечания сюда не идут: для них есть разговор с бюро, и там они превращаются
 * в круг правок, а не в отказ подтвердить, о котором никто не узнает.
 */
export async function approveProjectStage(
  _prev: ProjectState,
  formData: FormData,
): Promise<ProjectState> {
  const projectId = await currentProjectId()
  if (!projectId) return { error: 'Сначала войдите по ключу.' }

  const stage = String(formData.get('stage') ?? '')
  if (!DOC_STAGES.includes(stage as DocStage)) return { error: 'Неизвестная стадия.' }

  try {
    await approveStage(projectId, stage as DocStage, String(formData.get('note') ?? ''))

    // Два шага, и оба обязательны. Первый открывает следующую стадию.
    // Второй пересчитывает статус проекта: без него подтверждение последней
    // стадии не закрывало проект вовсе — всё принято, всё подтверждено, а он
    // навсегда «в выпуске».
    await applyGates(projectId)
    await refreshProjectStatus(projectId)

    revalidatePath('/project')

    return { message: 'Стадия подтверждена. Следующая открыта для команды.' }
  } catch (error) {
    if (error instanceof ApprovalRefused) return { error: error.message }

    console.error('Стадия не подтверждена:', error)
    return { error: 'Не получилось. Напишите бюро — разберём.' }
  }
}
