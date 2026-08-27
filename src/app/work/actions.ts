'use server'

import { revalidatePath } from 'next/cache'
import type { Discipline } from '@/engine/taxonomy'
import {
  attachArtifact,
  claim,
  comment,
  raiseConflict,
  requestFrom,
  submit,
} from '@/lib/services/relay'
import { currentSpecialistId } from '@/lib/session'

export type WorkState = { error?: string; message?: string }

/**
 * Действия специалиста по тикету.
 *
 * Каждое проверяет, что тикет принадлежит вошедшему: серверное действие
 * достижимо прямым POST, а не только из своей формы.
 */
async function act(
  formData: FormData,
  run: (ticketId: string, specialistId: string) => Promise<void>,
  message?: string,
): Promise<WorkState> {
  const specialistId = await currentSpecialistId()
  if (!specialistId) return { error: 'Сначала войдите по ключу.' }

  const ticketId = String(formData.get('ticketId') ?? '')

  try {
    await run(ticketId, specialistId)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Не получилось.' }
  }

  revalidatePath(`/work/${ticketId}`)
  revalidatePath('/work')

  return message ? { message } : {}
}

export async function claimTicket(_prev: WorkState, formData: FormData): Promise<WorkState> {
  return act(formData, claim, 'Тикет взят в работу.')
}

export async function postComment(_prev: WorkState, formData: FormData): Promise<WorkState> {
  const body = String(formData.get('body') ?? '').trim()
  if (!body) return { error: 'Пустой комментарий.' }

  return act(formData, (ticketId, specialistId) =>
    comment(ticketId, { role: 'specialist', specialistId }, body),
  )
}

export async function submitTicket(_prev: WorkState, formData: FormData): Promise<WorkState> {
  return act(formData, submit, 'Работа предъявлена, ждёт приёмки бюро.')
}

/**
 * Поднять конфликт. Это не переписка со смежником — такого канала нет. Это
 * сигнал арбитру: бюро видит его в панели и решает (п.11).
 */
export async function raiseTicketConflict(
  _prev: WorkState,
  formData: FormData,
): Promise<WorkState> {
  const note = String(formData.get('note') ?? '').trim()
  if (!note) return { error: 'Опишите, в чём именно расхождение.' }

  return act(
    formData,
    (ticketId, specialistId) =>
      raiseConflict(ticketId, { role: 'specialist', specialistId }, note),
    'Конфликт передан бюро.',
  )
}

/**
 * Запрос смежной дисциплине.
 *
 * Не переписка: система заводит тикет для той дисциплины, с исполнителем и
 * сроком. Прямого канала между специалистами по-прежнему нет.
 */
export async function askDiscipline(_prev: WorkState, formData: FormData): Promise<WorkState> {
  const discipline = String(formData.get('discipline') ?? '') as Discipline
  const title = String(formData.get('title') ?? '').trim()
  const body = String(formData.get('body') ?? '').trim()

  if (!discipline) return { error: 'Выберите дисциплину.' }
  if (!title) return { error: 'Коротко назовите, что нужно.' }
  if (!body) return { error: 'Опишите запрос: адресату нужно понять его без вас.' }

  return act(
    formData,
    (ticketId, specialistId) =>
      requestFrom(ticketId, specialistId, discipline, title, body).then(() => undefined),
    'Запрос заведён как тикет для смежной дисциплины.',
  )
}

export async function addArtifact(_prev: WorkState, formData: FormData): Promise<WorkState> {
  const name = String(formData.get('name') ?? '').trim()
  const url = String(formData.get('url') ?? '').trim()
  const kind = String(formData.get('kind') ?? 'sheet')

  if (!name || !url) return { error: 'Нужны название и ссылка на файл.' }

  return act(
    formData,
    (ticketId, specialistId) => attachArtifact(ticketId, specialistId, { name, url, kind }),
    'Файл приложен. Смежники получат его, когда тикет примут.',
  )
}
