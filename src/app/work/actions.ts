'use server'

import { revalidatePath } from 'next/cache'
import { redirect, unstable_rethrow } from 'next/navigation'
import type { Discipline } from '@/engine/taxonomy'
import { MAX_FILE_BYTES } from '@/lib/storage'
import {
  attachArtifact,
  claim,
  comment,
  generateRender,
  raiseConflict,
  requestFrom,
  submit,
  uploadArtifact,
} from '@/lib/services/relay'
import { HandoverRefused, stepOut } from '@/lib/services/handover'
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

/**
 * Изображение к тикету.
 *
 * Материал для работы, а не сданная работа: он ложится в тикет с пометкой
 * происхождения, и предъявляет специалист то, за что готов отвечать.
 */
export async function makeRender(_prev: WorkState, formData: FormData): Promise<WorkState> {
  const prompt = String(formData.get('prompt') ?? '').trim()
  const name = String(formData.get('name') ?? '').trim()

  if (!prompt) return { error: 'Опишите, что нужно на изображении.' }

  return act(
    formData,
    (ticketId, specialistId) =>
      generateRender(ticketId, specialistId, prompt, name || 'Изображение'),
    'Изображение приложено к тикету с пометкой, что оно сгенерировано.',
  )
}

/**
 * Приложить работу к задаче: файлом или ссылкой.
 *
 * Файл предпочтительнее, и это не вкус. Материалы проекта принадлежат
 * заказчику и передаются ему по завершении в полном объёме (п.13) — а ссылка
 * на чужой диск живёт ровно до того дня, когда её владелец наведёт порядок.
 * Ссылка остаётся для того, что снаружи по своей природе: облачная модель,
 * общий диск заказчика.
 */
export async function addArtifact(_prev: WorkState, formData: FormData): Promise<WorkState> {
  const name = String(formData.get('name') ?? '').trim()
  const url = String(formData.get('url') ?? '').trim()
  const kind = String(formData.get('kind') ?? 'sheet')
  const upload = formData.get('file')
  const file = upload instanceof File && upload.size > 0 ? upload : null

  if (!name) return { error: 'Назовите файл: смежник увидит это имя, а не ваше.' }
  if (!file && !url) return { error: 'Приложите файл или дайте ссылку.' }

  if (file) {
    if (file.size > MAX_FILE_BYTES) {
      return {
        error: 'Файл больше потолка, указанного у поля. Это уже архив, а не чертёж: положите его отдельно и дайте ссылку.',
      }
    }

    const bytes = new Uint8Array(await file.arrayBuffer())

    return act(
      formData,
      (ticketId, specialistId) =>
        uploadArtifact(ticketId, specialistId, {
          name,
          kind,
          bytes,
          contentType: file.type || 'application/octet-stream',
        }).then(() => undefined),
      'Файл загружен. Смежники получат его, когда тикет примут.',
    )
  }

  return act(
    formData,
    (ticketId, specialistId) => attachArtifact(ticketId, specialistId, { name, url, kind }),
    'Ссылка приложена. Смежники получат её, когда тикет примут.',
  )
}

/**
 * Выход из роли на проекте.
 *
 * Не «отказ от тикета»: тикеты в роли связаны графом, и бросить один, оставив
 * соседние, значит оставить проект в состоянии, которое никто не разберёт.
 * Человек выходит из роли целиком, и алгоритм ищет замену там же, где искал
 * состав — в ранжированном списке того же прогона.
 *
 * Кнопка стоит на задаче, потому что именно там человек понимает, что не
 * потянет. Но действие шире задачи, и текст рядом с кнопкой говорит об этом
 * прямо: соглашаться вслепую тут нечему.
 */
export async function leaveProject(_prev: WorkState, formData: FormData): Promise<WorkState> {
  const specialistId = await currentSpecialistId()
  if (!specialistId) return { error: 'Сначала войдите по ключу.' }

  const projectId = String(formData.get('projectId') ?? '')
  const reason = String(formData.get('reason') ?? '').trim()

  if (!reason) {
    return { error: 'Напишите причину: её увидит и бюро, и тот, кто придёт на замену.' }
  }

  try {
    const result = await stepOut(specialistId, projectId, reason)

    revalidatePath('/work')
    revalidatePath('/work/profile')

    // Уводим на доску, а не оставляем на тикете: тикет уже не его, и страница
    // ушла бы из-под ног ошибкой доступа вместо подтверждения. Что именно
    // произошло, доска скажет по метке в адресе.
    redirect(result.replaced ? '/work?left=passed' : '/work?left=orphaned')
  } catch (error) {
    // redirect работает через исключение, и try/catch его глушит: без этой
    // строки человек увидел бы «не получилось» после успешного выхода.
    // Способ публичный, из документации этой версии Next.
    unstable_rethrow(error)

    if (error instanceof HandoverRefused) return { error: error.message }

    console.error('Выход из проекта не выполнен:', error)
    return { error: 'Не получилось. Напишите в тикет — бюро разберёт вручную.' }
  }
}
