'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { PORTFOLIO_THRESHOLD } from '@/engine/taxonomy'
import { prisma } from '@/lib/db'
import { accept, comment, requestRevision, resolveConflict } from '@/lib/services/relay'
import { runAssembly } from '@/lib/services/matching'
import { isOperator, signInOperator, signOutOperator } from '@/lib/session'

export type OpsState = { error?: string; message?: string }

async function requireOperator(): Promise<void> {
  if (!(await isOperator())) throw new Error('Панель бюро закрыта.')
}

export async function opsSignIn(_prev: OpsState, formData: FormData): Promise<OpsState> {
  const ok = await signInOperator(String(formData.get('password') ?? ''))
  if (!ok) return { error: 'Пароль не подошёл.' }

  redirect('/ops')
}

export async function opsSignOut(): Promise<void> {
  await signOutOperator()
  redirect('/ops')
}

/**
 * Разбор заявки: бюро ставит рейтинг портфолио и всё.
 *
 * Решение «в пул или нет» из рейтинга следует, а не принимается отдельно:
 * порог — это правило продукта, а не усмотрение оператора (п.9).
 */
export async function reviewApplication(_prev: OpsState, formData: FormData): Promise<OpsState> {
  await requireOperator()

  const id = String(formData.get('specialistId') ?? '')
  const rating = Number(formData.get('portfolioRating'))

  if (!Number.isFinite(rating) || rating < 0 || rating > 10) {
    return { error: 'Рейтинг портфолио — число от 0 до 10.' }
  }

  await prisma.specialist.update({
    where: { id },
    data: {
      portfolioRating: rating,
      status: rating >= PORTFOLIO_THRESHOLD ? 'active' : 'rejected',
    },
  })

  revalidatePath('/ops/applications')
  revalidatePath('/ops/pool')

  return {
    message:
      rating >= PORTFOLIO_THRESHOLD
        ? 'Специалист в пуле. Ключ доступа можно выдавать.'
        : `Ниже порога ${PORTFOLIO_THRESHOLD}/10 — заявка не проходит.`,
  }
}

export async function rerunAssembly(_prev: OpsState, formData: FormData): Promise<OpsState> {
  await requireOperator()

  const projectId = String(formData.get('projectId') ?? '')

  try {
    const { assembly } = await runAssembly(projectId)
    revalidatePath(`/ops/projects/${projectId}`)
    return { message: `Прогон выполнен: ${assembly.outcome}. ${assembly.notes}`.trim() }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Прогон не удался.' }
  }
}

export async function setTicketSpec(_prev: OpsState, formData: FormData): Promise<OpsState> {
  await requireOperator()

  const ticketId = String(formData.get('ticketId') ?? '')
  const spec = String(formData.get('spec') ?? '').trim()

  await prisma.ticket.update({ where: { id: ticketId }, data: { spec } })

  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })
  revalidatePath(`/ops/projects/${ticket.projectId}`)

  return { message: 'Постановка сохранена.' }
}

export async function acceptTicket(_prev: OpsState, formData: FormData): Promise<OpsState> {
  await requireOperator()

  const ticketId = String(formData.get('ticketId') ?? '')

  try {
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })
    await accept(ticketId)
    revalidatePath(`/ops/projects/${ticket.projectId}`)
    return { message: 'Принято. Гейт открыл зависящие тикеты.' }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Не получилось.' }
  }
}

export async function returnTicket(_prev: OpsState, formData: FormData): Promise<OpsState> {
  await requireOperator()

  const ticketId = String(formData.get('ticketId') ?? '')
  const note = String(formData.get('note') ?? '').trim()

  if (!note) return { error: 'Скажите, что именно не так: возврат без причины — это не круг правок.' }

  try {
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })
    await requestRevision(ticketId, note)
    revalidatePath(`/ops/projects/${ticket.projectId}`)
    return { message: 'Возвращено на круг.' }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Не получилось.' }
  }
}

/**
 * Решение арбитра (концепт, п.11).
 *
 * Спор между смежниками разрешает бюро — не потому, что оно умнее, а потому что
 * между собой им спорить негде: канала нет, и «договорились устно» в системе не
 * существует.
 */
export async function resolveTicketConflict(_prev: OpsState, formData: FormData): Promise<OpsState> {
  await requireOperator()

  const ticketId = String(formData.get('ticketId') ?? '')
  const ruling = String(formData.get('ruling') ?? '').trim()

  if (!ruling) return { error: 'Решение без текста ничего не решает.' }

  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })
  await resolveConflict(ticketId, ruling)
  revalidatePath(`/ops/projects/${ticket.projectId}`)

  return { message: 'Решение записано в тикет, конфликт снят.' }
}

export async function bureauComment(_prev: OpsState, formData: FormData): Promise<OpsState> {
  await requireOperator()

  const ticketId = String(formData.get('ticketId') ?? '')
  const body = String(formData.get('body') ?? '').trim()
  if (!body) return { error: 'Пустой комментарий.' }

  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })
  await comment(ticketId, { role: 'bureau' }, body)
  revalidatePath(`/ops/projects/${ticket.projectId}`)

  return { message: 'Отправлено.' }
}
