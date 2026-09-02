'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { PORTFOLIO_THRESHOLD } from '@/engine/taxonomy'
import { prisma } from '@/lib/db'
import { TEXT_MAX, TooMuchText, bounded } from '@/lib/text'
import { allow, forgive } from '@/lib/guard'
import { assistant } from '@/lib/assist'
import { mailer, sendAccessKey } from '@/lib/mail'
import { chosenDirection } from '@/lib/services/direction'
import { inboundArtifacts } from '@/lib/services/relay'
import { parseList, toProfile } from '@/lib/rows'
import { SPECIALIZATIONS, type Specialization } from '@/engine/taxonomy'
import { retryMessage } from '@/lib/rate-limit'
import {
  accept,
  applyGates,
  comment,
  refreshProjectStatus,
  requestRevision,
  resolveConflict,
} from '@/lib/services/relay'
import { alertsForBureau, alertsForProject } from '@/lib/services/pm'
import { MessageRefused, answer } from '@/lib/services/dialogue'
import { BillingRefused, issueDueInvoices, markPaid, voidInvoice } from '@/lib/services/billing'
import { MAX_IMPORT_ROWS, importDrafts, inviteWaiting, reinvite } from '@/lib/services/intake'
import { readIntake } from '@/lib/intake/map'
import { fieldErrors, fromFormData, siteSchema } from '@/lib/forms'
import { isNudgeKind } from '@/engine/pm'
import { runAssembly } from '@/lib/services/matching'
import { isOperator, signInOperator, signOutOperator } from '@/lib/session'
import { NotErasable, anonymiseSpecialist, eraseProject } from '@/lib/services/privacy'
import { fill } from '@/lib/fill'
import {
  applicationDeclined,
  clientAnswered,
  conflictResolved,
  deliveryNote,
  invoicePaid,
  resend,
  ticketAccepted,
  ticketCommented,
  ticketReturned,
} from '@/lib/services/notify'

export type OpsState = { error?: string; message?: string }

async function requireOperator(): Promise<void> {
  if (!(await isOperator())) throw new Error('The bureau panel is closed.')
}

export async function opsSignIn(_prev: OpsState, formData: FormData): Promise<OpsState> {
  // Пароль один на всех и живёт в окружении: без ограничения попыток его
  // подбирают за вечер.
  const verdict = await allow('opsLogin')
  if (!verdict.allowed) return { error: retryMessage(verdict.retryAfterSeconds) }

  const ok = await signInOperator(String(formData.get('password') ?? ''))
  if (!ok) return { error: 'Wrong password.' }

  // Успех обнуляет счётчик: ограничитель здесь про подбор, а подбор — это
  // неудачные попытки. Иначе обычная работа выбирает лимит и панель
  // закрывается перед своими.
  await forgive('opsLogin')

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
    return { error: 'A portfolio rating is a number from 0 to 10.' }
  }

  const passed = rating >= PORTFOLIO_THRESHOLD

  const specialist = await prisma.specialist.update({
    where: { id },
    data: { portfolioRating: rating, status: passed ? 'active' : 'rejected' },
  })

  revalidatePath('/ops/applications')
  revalidatePath('/ops/pool')

  if (!passed) {
    // Отказ доходит до человека. Он подал заявку и ждёт ответа; молчание —
    // это ожидание без конца, и оно хуже отказа. Письмо разговора не
    // открывает: порог не обсуждается по случаям (п.9).
    const told = await applicationDeclined(specialist.id).catch((error) => {
      console.error('Письмо об отказе не ушло:', error)
      return 'failed' as const
    })

    return {
      message: `Below the ${PORTFOLIO_THRESHOLD}/10 threshold — the application does not pass. ${deliveryNote(told, 'The applicant')}`,
    }
  }

  // Ключ выдаётся тем же каналом, которым с человеком разговаривали, и только
  // после подтверждения: до него ключ существует, но не работает.
  //
  // При заглушке письмо никуда не уходит, и говорить «ключ отправлен» нельзя:
  // оператор закроет карточку, а человек останется без доступа. Ключ в этом
  // случае показывается прямо здесь — передать его есть чем.
  if (mailer().mode === 'stub') {
    return {
      message: `The specialist is in the pool. Email delivery is off: the key is ${specialist.accessKey} — hand it over yourself.`,
    }
  }

  try {
    await sendAccessKey(
      specialist.email,
      'specialist',
      specialist.accessKey,
    )
    return { message: 'The specialist is in the pool; the access key has gone to their address.' }
  } catch (error) {
    console.error('The email with the key did not go out:', error)
    return {
      message: `The specialist is in the pool, but the email did not go out. Key: ${specialist.accessKey} — hand it over yourself.`,
    }
  }
}

export async function rerunAssembly(_prev: OpsState, formData: FormData): Promise<OpsState> {
  await requireOperator()

  const projectId = String(formData.get('projectId') ?? '')

  try {
    const { assembly } = await runAssembly(projectId)
    revalidatePath(`/ops/projects/${projectId}`)
    return { message: `Run complete: ${assembly.outcome}. ${assembly.notes}`.trim() }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'The run failed.' }
  }
}

/**
 * Участок и объём проекта.
 *
 * Заполняет бюро, а не заказчик, и это не про доверие: пятна застройки, высоты
 * и отступов до проекта не существует. Они появляются с концепцией, и до тех
 * пор проверка на нормы честно говорит, что ей нечем считать (п.7б).
 *
 * Пустое поле стирает значение. Иначе неверно введённую высоту нельзя было бы
 * убрать — только заменить другой такой же.
 */
export async function setSiteFacts(_prev: OpsState, formData: FormData): Promise<OpsState> {
  await requireOperator()

  const projectId = String(formData.get('projectId') ?? '')
  const parsed = siteSchema.safeParse(fromFormData(formData, []))

  if (!parsed.success) {
    const errors = fieldErrors(parsed.error)
    return { error: Object.values(errors)[0] ?? 'Check the numbers.' }
  }

  const input = parsed.data
  const value = (n: number | undefined) => (n === undefined ? null : n)

  await prisma.project.update({
    where: { id: projectId },
    data: {
      municipality: input.municipality || null,
      zone: input.zone || null,
      plotAreaSqm: value(input.plotAreaSqm),
      footprintSqm: value(input.footprintSqm),
      heightM: value(input.heightM),
      setbackFrontM: value(input.setbackFrontM),
      setbackSideM: value(input.setbackSideM),
      setbackRearM: value(input.setbackRearM),
      units: value(input.units),
      parkingSpaces: value(input.parkingSpaces),
      greenSqm: value(input.greenSqm),
    },
  })

  revalidatePath(`/ops/projects/${projectId}`)
  revalidatePath('/project')

  return { message: 'Site data saved. The rules were re-checked against it.' }
}

export async function setTicketSpec(_prev: OpsState, formData: FormData): Promise<OpsState> {
  await requireOperator()

  const ticketId = String(formData.get('ticketId') ?? '')

  let spec: string
  try {
    spec = bounded(String(formData.get('spec') ?? ''), TEXT_MAX.spec)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'That did not work.' }
  }

  await prisma.ticket.update({ where: { id: ticketId }, data: { spec } })

  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })
  revalidatePath(`/ops/projects/${ticket.projectId}`)

  return { message: 'The brief is saved.' }
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

  // Помощник обращается к внешней модели: предел здесь про счёт, а не про
  // доступ — вход в панель уже закрыт паролем.
  const assistVerdict = await allow('assist')
  if (!assistVerdict.allowed) return { error: retryMessage(assistVerdict.retryAfterSeconds) }

  const ticketId = String(formData.get('ticketId') ?? '')

  const ticket = await prisma.ticket.findUniqueOrThrow({
    where: { id: ticketId },
    include: { project: true },
  })

  if (ticket.spec.trim().length > 0) {
    return { error: 'A brief is already written. The draft does not overwrite it — edit it by hand.' }
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

    // Черновик приходит из слоя помощников, а не от человека, — и потолок ему
    // нужен ровно поэтому: что вернёт модель, здесь никто не обещает.
    const spec = [draft.spec, '', 'Check on acceptance:', ...draft.checklist.map((c) => `— ${c}`)]
      .join('\n')
      .trim()
      .slice(0, TEXT_MAX.spec)

    await prisma.ticket.update({ where: { id: ticketId }, data: { spec } })
    revalidatePath(`/ops/projects/${ticket.projectId}`)

    return { message: 'The draft is saved. Read it and correct it — it is not a finished brief.' }
  } catch (error) {
    console.error('No brief draft came back:', error)
    return { error: 'The assistant did not answer. The brief can be written by hand — the field is below.' }
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

  // Помощник обращается к внешней модели: предел здесь про счёт, а не про
  // доступ — вход в панель уже закрыт паролем.
  const assistVerdict = await allow('assist')
  if (!assistVerdict.allowed) return { error: retryMessage(assistVerdict.retryAfterSeconds) }

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
        ...summary.positions.map((p, i) => `Side ${i + 1}: ${p}`),
        `Question: ${summary.question}`,
      ].join(' · '),
    }
  } catch (error) {
    console.error('No summary of the dispute came back:', error)
    return { error: 'The assistant did not answer. The ticket thread is above.' }
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

  // Помощник обращается к внешней модели: предел здесь про счёт, а не про
  // доступ — вход в панель уже закрыт паролем.
  const assistVerdict = await allow('assist')
  if (!assistVerdict.allowed) return { error: retryMessage(assistVerdict.retryAfterSeconds) }

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

    const gaps = proposal.gaps.length > 0 ? ` Gaps: ${proposal.gaps.join('; ')}.` : ''

    return {
      message: `Suggested: ${proposal.rating.toFixed(1)}. ${proposal.reasoning}${gaps} You set the rating — in the field below.`,
    }
  } catch (error) {
    console.error('No rating suggestion came back:', error)
    return { error: 'The assistant did not answer. Look at the portfolio yourself — the link is above.' }
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

  // Помощник обращается к внешней модели: предел здесь про счёт, а не про
  // доступ — вход в панель уже закрыт паролем.
  const assistVerdict = await allow('assist')
  if (!assistVerdict.allowed) return { error: retryMessage(assistVerdict.retryAfterSeconds) }

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
      return { message: 'No discrepancies against the brief are visible. Look at the contents of the files yourself.' }
    }

    return {
      message: [
        check.missing.length > 0 ? `Missing: ${check.missing.join('; ')}.` : null,
        check.worthChecking.length > 0 ? `Worth a look: ${check.worthChecking.join('; ')}.` : null,
      ]
        .filter(Boolean)
        .join(' '),
    }
  } catch (error) {
    console.error('The completeness check did not run:', error)
    return { error: 'The assistant did not answer. What was attached is in the list above.' }
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

  // Помощник обращается к внешней модели: предел здесь про счёт, а не про
  // доступ — вход в панель уже закрыт паролем.
  const assistVerdict = await allow('assist')
  if (!assistVerdict.allowed) return { error: retryMessage(assistVerdict.retryAfterSeconds) }

  const alerts = await alertsForBureau()

  if (alerts.length === 0) return { message: 'The queue is empty — nothing to work through.' }

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
        `First: ${plan.first}`,
        ...plan.steps.map((step, i) => `${i + 1}. ${step}`),
        plan.notes,
      ]
        .filter(Boolean)
        .join(' · '),
    }
  } catch (error) {
    console.error('The queue was not worked through:', error)
    return { error: 'The assistant did not answer. The queue is below — sorted by the engine.' }
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

  // Помощник обращается к внешней модели: предел здесь про счёт, а не про
  // доступ — вход в панель уже закрыт паролем.
  const assistVerdict = await allow('assist')
  if (!assistVerdict.allowed) return { error: retryMessage(assistVerdict.retryAfterSeconds) }

  const ticketId = String(formData.get('ticketId') ?? '')

  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })
  const alerts = await alertsForProject(ticket.projectId)
  const alert = alerts.find((a) => a.ticketId === ticketId && isNudgeKind(a.kind))

  if (!alert || !isNudgeKind(alert.kind)) {
    return { error: 'There is nothing to write about this task yet: the deadline is fine and the work is moving.' }
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
      message: `Draft: ${draft.body.replace(/\n+/g, ' ')} Read it and send it with the form below — by itself it goes nowhere.`,
    }
  } catch (error) {
    console.error('No nudge draft came back:', error)
    return { error: 'The assistant did not answer. Write in the ticket yourself — the form is below.' }
  }
}

export async function acceptTicket(_prev: OpsState, formData: FormData): Promise<OpsState> {
  await requireOperator()

  const ticketId = String(formData.get('ticketId') ?? '')

  try {
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })
    await accept(ticketId)

    // Про возврат на круг человеку писали, про приёмку — нет. Сдав работу, он
    // ждёт вердикта, и молчание означает для него «ещё не смотрели».
    const told = await ticketAccepted(ticketId).catch((error) => {
      console.error('Письмо о приёмке не ушло:', error)
      return 'failed' as const
    })

    revalidatePath(`/ops/projects/${ticket.projectId}`)

    return {
      message: `Accepted. The gate opened the tickets that depend on it. ${deliveryNote(told, 'The specialist')}`,
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'That did not work.' }
  }
}

export async function returnTicket(_prev: OpsState, formData: FormData): Promise<OpsState> {
  await requireOperator()

  const ticketId = String(formData.get('ticketId') ?? '')
  const note = String(formData.get('note') ?? '').trim()

  if (!note) return { error: 'Say what exactly is wrong: sending work back without a reason is not a revision round.' }

  try {
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })
    await requestRevision(ticketId, note)

    // Письмо здесь, а не в гейте: гейт зовут после приёмки, а возврат — это
    // как раз то, что до приёмки не дошло.
    await ticketReturned(ticketId).catch((error) =>
      console.error('Письмо о возврате не ушло:', error),
    )

    revalidatePath(`/ops/projects/${ticket.projectId}`)
    return { message: 'Sent back for revision. The specialist has been told by email.' }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'That did not work.' }
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

  if (!ruling) return { error: 'A ruling with no text settles nothing.' }

  try {
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })
    const rulingId = await resolveConflict(ticketId, ruling)

    // Работа стояла, пока шёл спор, и теперь пошла: срок идёт снова, значит
    // человека надо позвать — как и на открытии задачи.
    const told = await conflictResolved(ticketId, rulingId).catch((error) => {
      console.error('Письмо о решении не ушло:', error)
      return 'failed' as const
    })

    revalidatePath(`/ops/projects/${ticket.projectId}`)

    return {
      message: `The ruling is written into the ticket and the conflict is cleared. ${deliveryNote(told, 'The specialist')}`,
    }
  } catch (error) {
    // Без этого отказ сервиса выпадал из действия наружу, и оператор получал
    // экран ошибки вместо ответа: очередь при этом теряется посреди дня.
    return { error: error instanceof Error ? error.message : 'That did not work.' }
  }
}

export async function bureauComment(_prev: OpsState, formData: FormData): Promise<OpsState> {
  await requireOperator()

  const ticketId = String(formData.get('ticketId') ?? '')
  const body = String(formData.get('body') ?? '').trim()
  if (!body) return { error: 'The comment is empty.' }

  try {
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })
    const commentId = await comment(ticketId, { role: 'bureau' }, body)

    // Реплика бюро — это то, после чего от человека чего-то ждут: вопрос про
    // срок, уточнение постановки, напоминание. Без письма он прочтёт её в тот
    // день, когда сам зайдёт на доску, — то есть после срока.
    const told = await ticketCommented(commentId).catch((error) => {
      console.error('Письмо о реплике не ушло:', error)
      return 'failed' as const
    })

    revalidatePath(`/ops/projects/${ticket.projectId}`)

    return { message: `Written into the ticket. ${deliveryNote(told, 'The specialist')}` }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'That did not work.' }
  }
}

/**
 * Предпросмотр базы.
 *
 * Ничего не создаёт. Человек должен увидеть, что система прочла в его таблице,
 * до того как в базе появятся записи и уйдут письма: столбец, названный не так,
 * тихо потерялся бы, и обнаружилось бы это на первом прогоне отбора.
 */
/*
 * Потолок на таблицу импорта.
 *
 * Разбор идёт в памяти целиком, и до сих пор его ограничивал только предел
 * тела серверного действия — который поднят до пятидесяти мегабайт ради
 * чертежей. Пятьдесят мегабайт CSV в разборе это не «медленно», это упавший
 * процесс, унёсший с собой всех, кто в этот момент работал.
 */
const TOO_MUCH_CSV =
  'That table is too large to read in one go. Split it into parts and import them one after another.'

export async function previewIntake(_prev: OpsState, formData: FormData): Promise<OpsState> {
  await requireOperator()

  const text = String(formData.get('csv') ?? '')

  if (text.length > TEXT_MAX.csv) return { error: TOO_MUCH_CSV }

  const intake = readIntake(text)

  if (intake.rows.length === 0) {
    return { error: 'I see no rows at all. A header row is needed, and at least one row under it.' }
  }

  const good = intake.rows.filter((r) => r.ok)
  const bad = intake.rows.filter((r) => !r.ok)

  const parts = [
    `Rows read: ${intake.rows.length}. Ready to create: ${good.length}.`,
    `Columns recognised: ${intake.recognisedColumns.join(', ') || '—'}.`,
  ]

  if (intake.ignoredColumns.length > 0) {
    parts.push(`Not recognised and not imported: ${intake.ignoredColumns.join(', ')}.`)
  }

  if (bad.length > 0) {
    parts.push(
      `Rows with an error ${bad.length}: ` +
        bad
          .slice(0, 5)
          .map((r) => (r.ok ? '' : `${r.line} — ${r.problem}`))
          .join('; ') +
        (bad.length > 5 ? ' and others' : '') +
        '.',
    )
  }

  const unrecognised = [
    ...new Set(good.flatMap((r) => (r.ok ? r.unrecognised : []))),
  ].slice(0, 12)

  if (unrecognised.length > 0) {
    parts.push(`Values absent from the taxonomy: ${unrecognised.join(', ')}.`)
  }

  return { message: parts.join(' ') }
}

/**
 * Заведение записей.
 *
 * Строки с ошибкой пропускаются, а не роняют импорт: в базе на двести человек
 * всегда найдётся тот, у кого вместо адреса телеграм, и останавливать из-за
 * него остальных незачем. Отчёт называет, сколько пропущено.
 *
 * Письма отсюда не уходят. Рассылка — отдельная кнопка: вставка записей это
 * один запрос, а письмо — сетевой вызов на человека, и связывать их значит
 * ставить заведение базы в зависимость от почтового провайдера.
 */
export async function runIntake(_prev: OpsState, formData: FormData): Promise<OpsState> {
  await requireOperator()

  const csv = String(formData.get('csv') ?? '')

  if (csv.length > TEXT_MAX.csv) return { error: TOO_MUCH_CSV }

  const intake = readIntake(csv)
  const drafts = intake.rows.flatMap((r) => (r.ok ? [r.draft] : []))

  if (drafts.length === 0) {
    return { error: 'Nothing to create: not a single row parsed. Press “Parse”.' }
  }

  try {
    const outcome = await importDrafts(drafts)

    revalidatePath('/ops/import')
    revalidatePath('/ops/applications')
    revalidatePath('/ops/pool')
    revalidatePath('/ops')

    const parts = [
      `Created: ${outcome.created}.`,
      outcome.existing > 0 ? `Already in the database and left untouched: ${outcome.existing}.` : '',
      outcome.skipped > 0
        ? `Over the ${MAX_IMPORT_ROWS}-row ceiling, ${outcome.skipped} remain — paste them on the next pass.`
        : '',
      outcome.created > 0 ? 'The invitations have not been sent yet — the button is below.' : '',
    ]

    return { message: parts.filter(Boolean).join(' ') }
  } catch (error) {
    console.error('The import did not run:', error)
    return { error: error instanceof Error ? error.message : 'The import did not run.' }
  }
}

/**
 * Рассылка тем, кого завели и ещё не звали.
 *
 * Идёт порциями и не отмечает приглашённым того, до кого письмо не дошло:
 * иначе он молча выпал бы из рассылки навсегда. Незаконченная очередь не
 * теряется — следующий заход берёт её же.
 */
export async function sendInvites(_prev: OpsState, _formData: FormData): Promise<OpsState> {
  await requireOperator()

  try {
    const outcome = await inviteWaiting()

    revalidatePath('/ops/import')
    revalidatePath('/ops/applications')

    if (outcome.sent === 0 && outcome.unsent.length === 0) {
      return { message: 'No one to invite: everyone created has been invited already.' }
    }

    const parts = [
      `Sent: ${outcome.sent}.`,
      outcome.waiting > 0 ? `Waiting their turn: ${outcome.waiting} — press again.` : '',
    ]

    if (outcome.unsent.length > 0) {
      parts.push(
        `Did not go out: ${outcome.unsent.length}. The keys — ` +
          outcome.unsent.map((u) => `${u.email}: ${u.accessKey}`).join('; ') +
          ' — hand it over by hand.',
      )
    }

    return { message: parts.filter(Boolean).join(' ') }
  } catch (error) {
    console.error('The mailing did not run:', error)
    return { error: 'The mailing did not run. The keys are visible in the invited list.' }
  }
}

/**
 * Повторить отправку письма, которое не ушло.
 *
 * Повод собирается заново из нынешнего состояния базы: копии текста у нас нет
 * и не должно быть — письмо содержит чужие данные, и хранить его вторым
 * экземпляром значит завести вторую базу этих данных рядом с первой.
 */
export async function resendLetter(_prev: OpsState, formData: FormData): Promise<OpsState> {
  await requireOperator()

  const kind = String(formData.get('kind') ?? '')
  const targetId = String(formData.get('targetId') ?? '')

  if (!kind || !targetId) return { error: 'There is no such letter.' }

  try {
    const told = await resend(kind, targetId)

    revalidatePath('/ops/letters')

    switch (told) {
      case 'sent':
        return { message: 'The letter has gone out.' }
      case 'stub':
        return { error: 'Email delivery is off: nothing was sent. Write to them yourself.' }
      case 'failed':
        return { error: 'It did not go out this time either. The reason is in the row.' }
      case 'skipped':
        // Повода больше нет: человека обезличили, проект удалили, задачу сняли.
        return { message: 'There is no one to write to any more: the occasion is gone.' }
    }
  } catch (error) {
    console.error('Повторная отправка не удалась:', error)
    return { error: 'The letter did not go out.' }
  }
}

/**
 * Прогнать гейт по проекту руками.
 *
 * Гейт идемпотентен и зовётся сам после каждой приёмки, подтверждения и
 * оплаты. Кнопка нужна на случай разрыва между переходом состояния и гейтом:
 * приёмка записана транзакцией, а открытие зависимых задач идёт следующим
 * вызовом, и между ними помещается перезапуск контейнера. После такого
 * разрыва проект стоит молча — всё оплачено, всё подтверждено, а работа
 * никому не выдана.
 *
 * Ничего не открыть — нормальный исход, и он назван словами: чаще всего гейт
 * ждёт человека, а не сбоя.
 */
export async function runProjectGate(_prev: OpsState, formData: FormData): Promise<OpsState> {
  await requireOperator()

  const projectId = String(formData.get('projectId') ?? '')

  try {
    const opened = await applyGates(projectId)
    await refreshProjectStatus(projectId)

    revalidatePath(`/ops/projects/${projectId}`)
    revalidatePath('/ops')

    return {
      message:
        opened.length === 0
          ? 'Nothing to open: the gate is waiting on a payment, a confirmation or work up the graph.'
          : fill('The gate opened {count} task(s). The people on them have been told.', {
              count: opened.length,
            }),
    }
  } catch (error) {
    console.error('Гейт не прогнался:', error)
    return { error: 'The gate did not run.' }
  }
}

/** Повторный зов тому, кто не откликнулся на приглашение. */
export async function reinviteSpecialist(_prev: OpsState, formData: FormData): Promise<OpsState> {
  await requireOperator()

  const id = String(formData.get('specialistId') ?? '')

  try {
    const { sent, key } = await reinvite(id)

    revalidatePath('/ops/applications')

    return sent
      ? { message: 'The invitation was sent again.' }
      : { message: `The email did not go out. Key: ${key} — hand it over yourself.` }
  } catch (error) {
    // Неизвестный идентификатор приходит прямым запросом, а не из списка:
    // серверное действие достижимо и без формы.
    console.error('Приглашение не отправлено повторно:', error)
    return { error: 'The invitation did not go out again. The key is visible in the invited list.' }
  }
}

/**
 * Ответ бюро заказчику.
 *
 * Закрывает все висящие вопросы по проекту разом: три вопроса подряд от одного
 * человека — это один разговор, а не три очереди.
 */
export async function answerClient(_prev: OpsState, formData: FormData): Promise<OpsState> {
  await requireOperator()

  const projectId = String(formData.get('projectId') ?? '')

  try {
    const answerId = await answer(projectId, String(formData.get('body') ?? ''))

    const told = await clientAnswered(answerId).catch((error) => {
      console.error('Письмо об ответе не ушло:', error)
      return 'failed' as const
    })

    revalidatePath('/ops')
    revalidatePath(`/ops/projects/${projectId}`)

    return {
      message: `The answer is in the project cabinet. ${deliveryNote(told, 'The client')}`,
    }
  } catch (error) {
    if (error instanceof MessageRefused || error instanceof TooMuchText) {
      return { error: error.message }
    }

    console.error('The answer to the client did not go out:', error)
    return { error: 'It did not send.' }
  }
}

/**
 * Бюро отмечает счёт оплаченным.
 *
 * Платёжного провайдера нет, и это осознанно: отметку ставит человек, увидев
 * поступление. Автоматический «приём платежа» без сверки с банком означал бы,
 * что непроведённый платёж открывает стадию, — а открытая стадия это уже
 * начатая работа живых людей.
 *
 * После отметки сразу же вызывается гейт: оплата и есть то, чего стадия ждала,
 * и заставлять её ждать ещё и следующей приёмки незачем.
 */
export async function markInvoicePaid(_prev: OpsState, formData: FormData): Promise<OpsState> {
  await requireOperator()

  const invoiceId = String(formData.get('invoiceId') ?? '')
  const projectId = String(formData.get('projectId') ?? '')

  try {
    const stage = await markPaid(invoiceId, String(formData.get('note') ?? ''))

    // Заказчик перевёл деньги и до сих пор не знал, дошли ли: приёма платежей
    // нет, отметку ставим мы. Молчание он читает как «деньги пропали».
    const told = await invoicePaid(invoiceId).catch((error) => {
      console.error('Письмо об оплате не ушло:', error)
      return 'failed' as const
    })

    const opened = await applyGates(projectId)
    await refreshProjectStatus(projectId)

    /*
     * Панель намеренно не перерисовывается здесь.
     *
     * Оплаченный счёт уходит из очереди, а вместе со строкой очереди
     * исчезает и форма, которая показывает ответ. Оператор жмёт «отметить
     * оплаченным», строка пропадает — и он не знает, прошло ли и открылось ли
     * что-нибудь. Отличить успех от ошибки в этот момент невозможно.
     *
     * Устаревшая на один переход очередь безопасна: повторная отметка того же
     * счёта молча проходит. Пропавшее подтверждение — нет.
     */
    revalidatePath(`/ops/projects/${projectId}`)
    revalidatePath('/project')

    const marked =
      opened.length > 0
        ? `Payment marked. Tasks opened: ${opened.length}.`
        : 'The payment is marked. Tasks open once the rest of the gate’s conditions are met.'

    return { message: `${marked} ${deliveryNote(told, 'The client')}` }
  } catch (error) {
    if (error instanceof BillingRefused || error instanceof TooMuchText) {
      return { error: error.message }
    }

    console.error('The payment was not marked:', error)
    return { error: 'Marking the payment failed.' }
  }
}

/**
 * Бюро отзывает счёт.
 *
 * Счёт выставляет гейт, а ошибается человек: неверно заведённая площадь или
 * страна дают неверную сумму. Без отзыва единственным способом это исправить
 * была бы правка базы руками.
 *
 * Причина обязательна: заказчик этот счёт уже видел, и «он исчез» — не ответ.
 */
export async function voidProjectInvoice(_prev: OpsState, formData: FormData): Promise<OpsState> {
  await requireOperator()

  const invoiceId = String(formData.get('invoiceId') ?? '')
  const projectId = String(formData.get('projectId') ?? '')

  try {
    await voidInvoice(invoiceId, String(formData.get('note') ?? ''))

    /*
     * Новый счёт выставляется тут же, а не «когда-нибудь при следующей проверке
     * гейта». Отзыв делается ради исправления ошибки в сумме; если после него
     * счёта нет вовсе, бюро отозвало счёт и осталось ни с чем, а стадия стоит
     * без объяснимой причины.
     */
    const issued = await issueDueInvoices(projectId)

    revalidatePath(`/ops/projects/${projectId}`)
    revalidatePath('/project')

    return {
      message:
        issued.length > 0
          ? 'The invoice is void; a new one has been issued from the project’s current data.'
          : 'The invoice is void. No new one was issued: payment is not what is holding the stage right now.',
    }
  } catch (error) {
    if (error instanceof BillingRefused || error instanceof TooMuchText) {
      return { error: error.message }
    }

    console.error('The invoice was not voided:', error)
    return { error: 'Voiding the invoice failed.' }
  }
}

/**
 * Обезличить профиль специалиста по его обращению (п.13).
 *
 * Действие необратимо, поэтому оператор пишет, откуда взялось требование:
 * через полгода «почему у нас тут Former specialist» — вопрос, на который
 * должен быть ответ. Причина остаётся в записях, как и у выхода из проекта.
 */
export async function anonymiseProfile(_prev: OpsState, formData: FormData): Promise<OpsState> {
  await requireOperator()

  const specialistId = String(formData.get('specialistId') ?? '')
  const reason = String(formData.get('reason') ?? '').trim()

  if (reason.length < 3) {
    return { error: 'Write where the request came from: this cannot be undone.' }
  }

  let moved: Awaited<ReturnType<typeof anonymiseSpecialist>>

  try {
    moved = await anonymiseSpecialist(specialistId)
  } catch (error) {
    if (error instanceof NotErasable) return { error: error.message }

    console.error('Профиль не обезличен:', error)
    return { error: 'Anonymising the profile failed.' }
  }

  revalidatePath('/ops/pool')
  revalidatePath(`/ops/pool/${specialistId}`)

  // Что стало с ролями, оператор узнаёт здесь, а не из просроченного проекта.
  // Роль без замены — не сбой обезличивания, а состояние, за которым надо
  // следить: задача вернулась бюро и ждёт постановки заново.
  const roles =
    moved.handed + moved.stranded === 0
      ? 'They held no roles on running projects.'
      : moved.stranded === 0
        ? fill('{handed} role(s) on running projects went to the next candidate in the run.', {
            handed: moved.handed,
          })
        : fill(
            '{handed} role(s) went to the next candidate in the run; {stranded} found no replacement and are back with the bureau — those tasks need a fresh assembly.',
            { handed: moved.handed, stranded: moved.stranded },
          )

  return {
    message: `The profile is anonymised: the key no longer works, the delivery metrics remain. ${roles}`,
  }
}

/**
 * Удалить данные закрытого проекта по обращению заказчика (п.13).
 *
 * Счета остаются: их хранение — обязанность перед страной регистрации, и
 * обращение человека её не снимает. Об этом сказано в самом сообщении, иначе
 * оператор узнает об этом от заказчика, а не от нас.
 */
export async function eraseProjectData(_prev: OpsState, formData: FormData): Promise<OpsState> {
  await requireOperator()

  const projectId = String(formData.get('projectId') ?? '')
  const reason = String(formData.get('reason') ?? '').trim()

  if (reason.length < 3) {
    return { error: 'Write where the request came from: this cannot be undone.' }
  }

  try {
    await eraseProject(projectId)
  } catch (error) {
    if (error instanceof NotErasable) return { error: error.message }

    console.error('Данные проекта не удалены:', error)
    return { error: 'Erasing the project data failed.' }
  }

  revalidatePath('/ops/projects')
  revalidatePath(`/ops/projects/${projectId}`)

  return {
    message:
      'The data is erased: contacts, brief, correspondence and files are gone. Invoices remain — keeping them is an obligation of the country of registration.',
  }
}
