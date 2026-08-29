/**
 * Счета за стадии (концепт, п.14, п.14а).
 *
 * Здесь нет платёжного провайдера, и это сказано вслух и в интерфейсе. Отметку
 * «оплачено» ставит бюро, увидев поступление. Делать вид, что это приём
 * платежа, значило бы обещать сверку, которой нет: непроведённый платёж
 * выглядел бы оплаченным до первой ручной проверки.
 *
 * Цена считается движком (`src/engine/pricing.ts`) и записывается в счёт
 * вместе с разбором. Пересчитывать её при показе нельзя: правка ставки в коде
 * задним числом изменила бы уже выставленный счёт, и заказчик увидел бы другое
 * число под тем же документом.
 */

import { billable } from '@/engine/relay'
import type { RelayTicket } from '@/engine/relay'
import { priceStage, type PriceBasis, type PricedProject } from '@/engine/pricing'
import { DOC_STAGE_ORDER, type DocStage, type Jurisdiction, type Typology } from '@/engine/taxonomy'
import { prisma } from '../db'
import { approvedStages } from './approval'

/**
 * Дольше этого счёт висит неоплаченным — бюро пора напомнить.
 *
 * Втрое дольше, чем на подтверждение стадии: подтверждение это минута
 * внимания, оплата — платёж, который где-то надо провести. Торопить человека
 * на вторые сутки значит выглядеть навязчиво там, где ничего не случилось.
 */
export const INVOICE_NUDGE_HOURS = 144

export class BillingRefused extends Error {}

export type InvoiceView = {
  id: string
  stage: DocStage
  amount: number
  currency: string
  status: 'issued' | 'paid' | 'void'
  issuedAt: Date
  paidAt: Date | null
  basis: PriceBasis | null
}

function toView(row: {
  id: string
  stage: string
  amount: number
  currency: string
  status: string
  issuedAt: Date
  paidAt: Date | null
  basisJson: string
}): InvoiceView {
  let basis: PriceBasis | null = null

  try {
    const parsed = JSON.parse(row.basisJson) as PriceBasis
    basis = parsed && typeof parsed.amount === 'number' ? parsed : null
  } catch {
    // Счёт без разбора остаётся счётом: сумма в нём своя, а не вычисленная
    // заново. Показать нечего — но и врать нечем.
    basis = null
  }

  return {
    id: row.id,
    stage: row.stage as DocStage,
    amount: row.amount,
    currency: row.currency,
    status: row.status as InvoiceView['status'],
    issuedAt: row.issuedAt,
    paidAt: row.paidAt,
    basis,
  }
}

export async function invoicesOf(projectId: string): Promise<InvoiceView[]> {
  const rows = await prisma.invoice.findMany({ where: { projectId } })

  return rows
    .map(toView)
    .sort((a, b) => DOC_STAGE_ORDER[a.stage] - DOC_STAGE_ORDER[b.stage])
}

/** Стадии, за которые заплачено. Это и есть третий гейт. */
export async function paidStages(projectId: string): Promise<DocStage[]> {
  const rows = await prisma.invoice.findMany({
    where: { projectId, status: 'paid' },
    select: { stage: true },
  })

  return rows
    .map((r) => r.stage as DocStage)
    .sort((a, b) => DOC_STAGE_ORDER[a] - DOC_STAGE_ORDER[b])
}

async function relayTickets(projectId: string): Promise<RelayTicket[]> {
  const tickets = await prisma.ticket.findMany({
    where: { projectId },
    include: { dependsOn: true },
  })

  return tickets.map((t) => ({
    id: t.id,
    status: t.status as RelayTicket['status'],
    stage: t.stage as DocStage,
    dependsOn: t.dependsOn.map((d) => d.prerequisiteId),
  }))
}

/**
 * Выставляет счета за всё, чему сейчас мешает только оплата.
 *
 * Вызывается после сборки команды и после каждого подтверждения стадии — там
 * же, где работает гейт. Счёт не выставляется впрок: пока заказчик не
 * подтвердил предыдущую стадию, счёт на следующую выглядел бы попыткой взять
 * деньги вперёд подтверждения.
 *
 * Повторный вызов ничего не дублирует: на пару «проект + стадия» стоит
 * уникальность, и уже выставленный счёт остаётся с прежней суммой.
 */
export async function issueDueInvoices(projectId: string): Promise<DocStage[]> {
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project || project.status === 'rejected') return []

  const [tickets, approved, existing] = await Promise.all([
    relayTickets(projectId),
    approvedStages(projectId),
    prisma.invoice.findMany({ where: { projectId }, select: { stage: true } }),
  ])

  const alreadyBilled = existing.map((r) => r.stage as DocStage)
  const due = billable(tickets, approved, alreadyBilled)

  if (due.length === 0) return []

  const priced: PricedProject = {
    typology: project.typology as Typology,
    jurisdiction: project.jurisdiction as Jurisdiction,
    areaSqm: project.areaSqm,
    targetStage: project.targetStage as DocStage,
  }

  const issued: DocStage[] = []

  for (const stage of due) {
    const basis = priceStage(priced, stage)

    // createMany со skipDuplicates не годится: нужен разный basisJson на
    // стадию, а гонку двух одновременных вызовов ловит уникальный ключ.
    try {
      await prisma.invoice.create({
        data: {
          projectId,
          stage,
          amount: basis.amount,
          currency: basis.currency,
          basisJson: JSON.stringify(basis),
        },
      })
      issued.push(stage)
    } catch {
      // Счёт за эту стадию уже есть. Это не ошибка: две приёмки подряд зовут
      // сюда обе, и вторая обязана промолчать.
    }
  }

  return issued
}

/**
 * Бюро отмечает счёт оплаченным.
 *
 * Отозванный счёт оплаченным не становится: если бюро его отозвало, значит
 * договорились иначе, и вернуть его надо явным действием, а не оплатой.
 */
export async function markPaid(invoiceId: string, note: string): Promise<DocStage> {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } })
  if (!invoice) throw new BillingRefused('Счёта нет.')

  if (invoice.status === 'void') {
    throw new BillingRefused('Счёт отозван. Оплаченным он не становится — выставьте заново.')
  }

  // Повторная отметка молча проходит: кнопку жмут дважды чаще, чем кажется.
  if (invoice.status !== 'paid') {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'paid', paidAt: new Date(), paidNote: note.trim().slice(0, 400) },
    })
  }

  return invoice.stage as DocStage
}

export type QueuedInvoice = {
  invoiceId: string
  projectId: string
  projectTitle: string
  stage: DocStage
  amount: number
  currency: string
  status: InvoiceView['status']
  /** Часов в ожидании оплаты. У оплаченного — сколько ждал, пока не заплатили. */
  hours: number
  paidAt: Date | null
}

/**
 * Очередь счетов бюро: сначала неоплаченные, потом оплаченные.
 *
 * Оплаченные показываются намеренно, и это не «история для полноты». Серверное
 * действие перерисовывает страницу, оплаченный счёт ушёл бы из списка вместе с
 * формой — а вместе с формой исчезает и строка ответа. Оператор жмёт кнопку,
 * строка пропадает, и отличить успех от ошибки в этот момент нечем.
 *
 * Подтверждением служит состояние, а не всплывшая надпись: строка остаётся на
 * месте и меняет статус на «оплачен». Это к тому же то, что бюро и так хочет
 * видеть — за что уже заплатили.
 */
export async function invoiceQueue(): Promise<QueuedInvoice[]> {
  const rows = await prisma.invoice.findMany({
    where: { status: { not: 'void' } },
    include: { project: { select: { title: true, status: true } } },
    orderBy: { issuedAt: 'asc' },
  })

  const now = Date.now()

  return rows
    .filter((r) => r.project.status !== 'rejected')
    .map((r) => ({
      invoiceId: r.id,
      projectId: r.projectId,
      projectTitle: r.project.title,
      stage: r.stage as DocStage,
      amount: r.amount,
      currency: r.currency,
      status: r.status as InvoiceView['status'],
      hours: ((r.paidAt ?? new Date(now)).getTime() - r.issuedAt.getTime()) / 3_600_000,
      paidAt: r.paidAt,
    }))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'issued' ? -1 : 1
      return b.hours - a.hours
    })
}
