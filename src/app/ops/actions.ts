'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { PORTFOLIO_THRESHOLD } from '@/engine/taxonomy'
import { prisma } from '@/lib/db'
import { allow } from '@/lib/guard'
import { assistant } from '@/lib/assist'
import { sendAccessKey } from '@/lib/mail'
import { chosenDirection } from '@/lib/services/direction'
import { inboundArtifacts } from '@/lib/services/relay'
import { parseList, toProfile } from '@/lib/rows'
import { SPECIALIZATIONS, type Specialization } from '@/engine/taxonomy'
import { retryMessage } from '@/lib/rate-limit'
import { accept, comment, requestRevision, resolveConflict } from '@/lib/services/relay'
import { alertsForBureau, alertsForProject } from '@/lib/services/pm'
import { isNudgeKind } from '@/engine/pm'
import { runAssembly } from '@/lib/services/matching'
import { isOperator, signInOperator, signOutOperator } from '@/lib/session'

export type OpsState = { error?: string; message?: string }

async function requireOperator(): Promise<void> {
  if (!(await isOperator())) throw new Error('Панель бюро закрыта.')
}

export async function opsSignIn(_prev: OpsState, formData: FormData): Promise<OpsState> {
  // Пароль один на всех и живёт в окружении: без ограничения попыток его
  // подбирают за вечер.
  const verdict = await allow('opsLogin')
  if (!verdict.allowed) return { error: retryMessage(verdict.retryAfterSeconds) }

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

  const passed = rating >= PORTFOLIO_THRESHOLD

  const specialist = await prisma.specialist.update({
    where: { id },
    data: { portfolioRating: rating, status: passed ? 'active' : 'rejected' },
  })

  revalidatePath('/ops/applications')
  revalidatePath('/ops/pool')

  if (!passed) return { message: `Ниже порога ${PORTFOLIO_THRESHOLD}/10 — заявка не проходит.` }

  // Ключ выдаётся тем же каналом, которым с человеком разговаривали, и только
  // после подтверждения: до него ключ существует, но не работает.
  try {
    await sendAccessKey(specialist.email, 'specialist', specialist.accessKey)
    return { message: 'Специалист в пуле, ключ доступа отправлен на его адрес.' }
  } catch (error) {
    console.error('Письмо с ключом не ушло:', error)
    return {
      message: `Специалист в пуле, но письмо не ушло. Ключ: ${specialist.accessKey} — передайте вручную.`,
    }
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

/**
 * Черновик постановки.
 *
 * Пишется в тикет только если постановки там ещё нет: затирать написанное
 * человеком помощник не должен ни при каких обстоятельствах. Дальше бюро
 * правит текст и сохраняет его обычной формой — черновик не уходит никуда сам.
 */
export async function draftTicketSpec(_prev: OpsState, formData: FormData): Promise<OpsState> {
  await requireOperator()

  const ticketId = String(formData.get('ticketId') ?? '')

  const ticket = await prisma.ticket.findUniqueOrThrow({
    where: { id: ticketId },
    include: { project: true },
  })

  if (ticket.spec.trim().length > 0) {
    return { error: 'Постановка уже написана. Черновик её не перезаписывает — правьте вручную.' }
  }

  const [slot, direction, inbound] = await Promise.all([
    prisma.teamSlot.findUnique({
      where: { projectId_discipline: { projectId: ticket.projectId, discipline: ticket.discipline } },
    }),
    chosenDirection(ticket.projectId),
    inboundArtifacts(ticket.id),
  ])

  try {
    const draft = await assistant().draftSpec({
      projectTitle: ticket.project.title,
      typology: ticket.project.typology,
      storeys: ticket.project.storeys,
      areaSqm: ticket.project.areaSqm,
      jurisdiction: ticket.project.jurisdiction,
      terrain: ticket.project.terrain,
      gridConnection: ticket.project.gridConnection,
      materialSystem: ticket.project.materialSystem,
      stage: ticket.stage,
      discipline: ticket.discipline,
      specializations: slot
        ? parseList<Specialization>(slot.roleSpecializationsJson, SPECIALIZATIONS)
        : [],
      ticketTitle: ticket.title,
      direction: direction ? { title: direction.title, summary: direction.summary } : null,
      inboundArtifacts: inbound.map((a) => a.name),
    })

    const spec = [draft.spec, '', 'Проверить на приёмке:', ...draft.checklist.map((c) => `— ${c}`)]
      .join('\n')
      .trim()

    await prisma.ticket.update({ where: { id: ticketId }, data: { spec } })
    revalidatePath(`/ops/projects/${ticket.projectId}`)

    return { message: 'Черновик записан. Прочитайте и поправьте — он не готовая постановка.' }
  } catch (error) {
    console.error('Черновик постановки не получен:', error)
    return { error: 'Помощник не ответил. Постановку можно написать руками — поле ниже.' }
  }
}

/**
 * Сводка спора для арбитра.
 *
 * Только позиции сторон и вопрос. Кто прав — не её дело: решение принимает
 * человек, и подсказка тут была бы решением, замаскированным под пересказ.
 */
export async function summariseTicketConflict(
  _prev: OpsState,
  formData: FormData,
): Promise<OpsState> {
  await requireOperator()

  const ticketId = String(formData.get('ticketId') ?? '')

  const ticket = await prisma.ticket.findUniqueOrThrow({
    where: { id: ticketId },
    include: { comments: { orderBy: { createdAt: 'asc' } } },
  })

  try {
    const summary = await assistant().summariseConflict({
      ticketTitle: ticket.title,
      conflictNote: ticket.conflictNote,
      comments: ticket.comments.map((c) => ({
        author: c.authorRole === 'bureau' ? ('bureau' as const) : ('specialist' as const),
        body: c.body,
      })),
    })

    return {
      message: [
        ...summary.positions.map((p, i) => `Сторона ${i + 1}: ${p}`),
        `Вопрос: ${summary.question}`,
      ].join(' · '),
    }
  } catch (error) {
    console.error('Сводка спора не получена:', error)
    return { error: 'Помощник не ответил. Переписка по тикету — выше.' }
  }
}

/**
 * Предложение рейтинга портфолио.
 *
 * В базу оно не пишется: помощник смотрит профиль и говорит, что видит, а
 * рейтинг ставит человек той же формой, что и раньше. Порог допуска — восемь,
 * и цена ошибки в обе стороны слишком высока, чтобы число проставлялось само.
 */
export async function proposeRating(_prev: OpsState, formData: FormData): Promise<OpsState> {
  await requireOperator()

  const id = String(formData.get('specialistId') ?? '')

  const row = await prisma.specialist.findUniqueOrThrow({
    where: { id },
    include: { portfolio: { orderBy: { createdAt: 'asc' } } },
  })

  const profile = toProfile(row)

  try {
    const proposal = await assistant().proposePortfolioRating({
      displayName: profile.displayName,
      portfolioUrl: row.portfolioUrl,
      disciplines: profile.disciplines,
      specializations: profile.specializations,
      jurisdictions: profile.jurisdictions,
      maxStoreys: profile.maxStoreys,
      works: row.portfolio.map((w) => ({
        title: w.title,
        kind: w.kind,
        roleDescription: w.roleDescription,
        areaSqm: w.areaSqm,
      })),
    })

    const gaps = proposal.gaps.length > 0 ? ` Пробелы: ${proposal.gaps.join('; ')}.` : ''

    return {
      message: `Предложение: ${proposal.rating.toFixed(1)}. ${proposal.reasoning}${gaps} Рейтинг ставите вы — полем ниже.`,
    }
  } catch (error) {
    console.error('Предложение рейтинга не получено:', error)
    return { error: 'Помощник не ответил. Смотрите портфолио сами — ссылка выше.' }
  }
}

/**
 * Проверка комплектности перед приёмкой.
 *
 * Не принимает и не отклоняет: называет то, что по постановке должно быть, а в
 * приложенном не видно. Кнопку «принять» жмёт человек, и он же решает, что
 * делать с замечаниями.
 */
export async function checkTicketCompleteness(
  _prev: OpsState,
  formData: FormData,
): Promise<OpsState> {
  await requireOperator()

  const ticketId = String(formData.get('ticketId') ?? '')

  const ticket = await prisma.ticket.findUniqueOrThrow({
    where: { id: ticketId },
    include: { artifacts: true },
  })

  try {
    const check = await assistant().checkCompleteness({
      ticketTitle: ticket.title,
      spec: ticket.spec,
      discipline: ticket.discipline,
      stage: ticket.stage,
      artifacts: ticket.artifacts.map((a) => ({ name: a.name, kind: a.kind })),
    })

    if (check.missing.length === 0 && check.worthChecking.length === 0) {
      return { message: 'По постановке расхождений не видно. Содержимое файлов смотрите сами.' }
    }

    return {
      message: [
        check.missing.length > 0 ? `Не хватает: ${check.missing.join('; ')}.` : null,
        check.worthChecking.length > 0 ? `Посмотреть глазами: ${check.worthChecking.join('; ')}.` : null,
      ]
        .filter(Boolean)
        .join(' '),
    }
  } catch (error) {
    console.error('Проверка комплектности не выполнена:', error)
    return { error: 'Помощник не ответил. Приложенное — в списке выше.' }
  }
}

/**
 * Разбор очереди цифрового менеджера.
 *
 * Порядок срочности считает движок, и помощник его не пересчитывает: он
 * переводит очередь в список действий на сегодня. Это меняет не решение, а
 * скорость, с которой человек до него доходит.
 */
export async function planBureauQueue(_prev: OpsState, _formData: FormData): Promise<OpsState> {
  await requireOperator()

  const alerts = await alertsForBureau()

  if (alerts.length === 0) return { message: 'Очередь пуста — разбирать нечего.' }

  try {
    const plan = await assistant().planQueue({
      alerts: alerts.map((a) => ({
        kind: a.kind,
        title: a.title,
        projectTitle: a.projectTitle,
        discipline: a.discipline,
        hours: a.hours,
      })),
    })

    return {
      message: [
        `Первое: ${plan.first}`,
        ...plan.steps.map((step, i) => `${i + 1}. ${step}`),
        plan.notes,
      ]
        .filter(Boolean)
        .join(' · '),
    }
  } catch (error) {
    console.error('Очередь не разобрана:', error)
    return { error: 'Помощник не ответил. Очередь ниже — она отсортирована движком.' }
  }
}

/**
 * Черновик напоминания по вставшей задаче.
 *
 * Причину пишем не с чужих слов: вид сигнала берётся из движка по текущему
 * состоянию тикета, а не из формы. Отправляет напоминание человек — обычным
 * комментарием в тикет, потому что другого канала до исполнителя нет (п.11).
 */
export async function draftTicketNudge(_prev: OpsState, formData: FormData): Promise<OpsState> {
  await requireOperator()

  const ticketId = String(formData.get('ticketId') ?? '')

  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })
  const alerts = await alertsForProject(ticket.projectId)
  const alert = alerts.find((a) => a.ticketId === ticketId && isNudgeKind(a.kind))

  if (!alert || !isNudgeKind(alert.kind)) {
    return { error: 'По этой задаче писать пока не о чем: срок в порядке и работа идёт.' }
  }

  try {
    const draft = await assistant().draftNudge({
      ticketTitle: ticket.title,
      discipline: ticket.discipline,
      kind: alert.kind,
      hours: alert.hours,
      spec: ticket.spec,
    })

    return {
      message: `Черновик: ${draft.body.replace(/\n+/g, ' ')} Прочитайте и отправьте формой ниже — сам он никуда не уходит.`,
    }
  } catch (error) {
    console.error('Черновик напоминания не получен:', error)
    return { error: 'Помощник не ответил. Напишите в тикет сами — форма ниже.' }
  }
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
