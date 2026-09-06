'use server'

import { revalidatePath } from 'next/cache'
import { allow } from '@/lib/guard'
import { retryMessage } from '@/lib/rate-limit'
import { DOC_STAGES, type DocStage } from '@/engine/taxonomy'
import { ApprovalRefused, approveStage } from '@/lib/services/approval'
import { MessageRefused, say } from '@/lib/services/dialogue'
import { applyGates, refreshProjectStatus } from '@/lib/services/relay'
import { currentProjectId } from '@/lib/session'
import { prisma } from '@/lib/db'
import { AccessRefused, requestAccess } from '@/lib/services/build-access'
import { TooMuchText } from '@/lib/text'

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
  if (!projectId) return { error: 'Sign in with your key first.' }

  const verdict = await allow('clientMessage')
  if (!verdict.allowed) return { error: retryMessage(verdict.retryAfterSeconds) }

  try {
    await say(projectId, String(formData.get('body') ?? ''))
    revalidatePath('/project')

    return { message: 'Sent to the bureau. The reply will appear right here.' }
  } catch (error) {
    if (error instanceof MessageRefused || error instanceof TooMuchText) {
      return { error: error.message }
    }

    console.error('Сообщение бюро не отправлено:', error)
    return { error: 'It did not send. Please try again.' }
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
  if (!projectId) return { error: 'Sign in with your key first.' }

  const stage = String(formData.get('stage') ?? '')
  if (!DOC_STAGES.includes(stage as DocStage)) return { error: 'Unknown stage.' }

  try {
    await approveStage(projectId, stage as DocStage, String(formData.get('note') ?? ''))

    // Два шага, и оба обязательны. Первый выставляет счёт за следующую стадию
    // и открывает её, если он оплачен. Второй пересчитывает статус проекта:
    // без него подтверждение последней стадии не закрывало проект вовсе — всё
    // принято, всё подтверждено, а он навсегда «в выпуске».
    await applyGates(projectId)
    await refreshProjectStatus(projectId)

    revalidatePath('/project')

    // Формулировка осторожная намеренно. Раньше здесь стояло «следующая
    // открыта для команды», и после появления счёта это стало неправдой в
    // самом обидном месте: заказчик читает, что работа пошла, а она ждёт
    // оплаты. Что именно мешает — видно ниже на странице.
    return { message: 'Stage confirmed.' }
  } catch (error) {
    if (error instanceof ApprovalRefused || error instanceof TooMuchText) {
      return { error: error.message }
    }

    console.error('Стадия не подтверждена:', error)
    return { error: 'That did not work. Write to the bureau and we will sort it out.' }
  }
}

/**
 * Заказчик просит доступ к подрядчикам (п.14б).
 *
 * Просьба, а не покупка в один клик: приёма платежей на сайте нет, и здесь
 * выставляется счёт, который заказчик оплачивает переводом, а бюро отмечает,
 * увидев поступление. Тот же порядок, что у стадий, и по той же причине —
 * автоматический «приём платежа» без сверки с банком означал бы, что
 * непроведённый платёж что-то открывает.
 *
 * Ничего не открывает и сама просьба: комплект выдаётся своим чередом, стадии
 * идут своим. Неоплаченный доступ закрывает ровно один экран — короткий
 * список, — а не работу.
 */
export async function askForBuildAccess(_prev: ProjectState): Promise<ProjectState> {
  const projectId = await currentProjectId()
  if (!projectId) return { error: 'Sign in with your key first.' }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      status: true,
      typology: true,
      storeys: true,
      areaSqm: true,
      materialSystem: true,
      terrain: true,
      gridConnection: true,
      jurisdiction: true,
    },
  })

  if (!project) return { error: 'Sign in with your key first.' }

  /*
   * Не раньше выпуска. Короткий список строится из типологии, площадей,
   * материальной системы и инженерных решений — то есть из того, что
   * существует, когда комплект уже делается. Проданный на черновике, он
   * считался бы по брифу, а стройка пойдёт по комплекту.
   */
  if (project.status !== 'delivering' && project.status !== 'delivered') {
    return {
      error: 'This becomes available once your documentation is in production: the shortlist is built from the set, not from the brief.',
    }
  }

  try {
    await requestAccess(project)
    revalidatePath('/project')

    return {
      message: 'The bureau has issued the charge. It is below, with what it is made of.',
    }
  } catch (error) {
    if (error instanceof AccessRefused) return { error: error.message }

    console.error('Доступ к подрядчикам не выставлен:', error)
    return { error: 'Issuing the charge failed.' }
  }
}
