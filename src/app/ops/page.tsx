import Link from 'next/link'
import { amount, date, dateTime } from '@/lib/format'
import { fill } from '@/lib/fill'
import { ALERT_ACTIONS, ALERT_LABELS, alertAudience, projectHeat } from '@/engine/pm'
import type { Discipline } from '@/engine/taxonomy'
import { prisma } from '@/lib/db'
import { DISCIPLINE_LABELS } from '@/lib/labels'
import { alertsForBureau } from '@/lib/services/pm'
import { lostProjects } from '@/lib/services/demand'
import { ANSWER_SLA_HOURS, waitingQuestions } from '@/lib/services/dialogue'
import { APPROVAL_NUDGE_HOURS, awaitingApproval } from '@/lib/services/approval'
import { DIRECTION_NUDGE_HOURS, awaitingDirection } from '@/lib/services/direction'
import { INVOICE_NUDGE_HOURS, PAID_SHOWN, invoiceQueue } from '@/lib/services/billing'
import { DOC_STAGE_LABELS } from '@/lib/labels'
import type { DocStage } from '@/engine/taxonomy'
import { roleName } from '@/lib/gap'
import { JURISDICTION_NAMES } from '@/engine/taxonomy'
import { isOperator } from '@/lib/session'
import { markInvoicePaid, planBureauQueue, voidProjectInvoice } from './actions'
import { OpsAction, OpsSignIn } from './OpsForms'

export const metadata = { title: 'Bureau panel — TinyArc Cloud Bureau' }

export default async function OpsPage() {
  if (!(await isOperator())) {
    return (
      <section style={{ paddingTop: 'clamp(48px, 8vw, 96px)' }}>
        <div className="shell" style={{ maxWidth: 460 }}>
          <span className="eyebrow">Bureau panel</span>
          <h1>Sign in</h1>
          <p className="muted" style={{ marginTop: 16 }}>
            The panel covers application review, writing briefs and accepting work. It gives no one the right to assign a specialist to a team — there is no such field in the schema.
          </p>
          <div style={{ marginTop: 32 }}>
            <OpsSignIn />
          </div>
        </div>
      </section>
    )
  }

  const [pending, active, projects, openTickets, submitted, alerts] = await Promise.all([
    prisma.specialist.count({ where: { status: 'pending' } }),
    prisma.specialist.count({ where: { status: 'active' } }),
    prisma.project.count(),
    prisma.ticket.count({ where: { status: 'open' } }),
    prisma.ticket.count({ where: { status: 'submitted' } }),
    alertsForBureau(),
  ])

  const [lost, questions, approvals, invoices, directions] = await Promise.all([
    lostProjects(),
    waitingQuestions(),
    awaitingApproval(),
    invoiceQueue(),
    awaitingDirection(),
  ])

  const waitingInvoices = invoices.filter((i) => i.status === 'issued').length
  const conflicts = alerts.filter((a) => a.kind === 'conflict')
  const heat = projectHeat(alerts)
  const titles = new Map(alerts.map((a) => [a.projectId, a.projectTitle]))

  return (
    <section style={{ paddingTop: 'clamp(40px, 7vw, 72px)' }}>
      <div className="shell">
        <span className="eyebrow">Bureau panel</span>
        <h1>What is on the table now</h1>

        <div className="grid grid-3" style={{ marginTop: 40 }}>
          <Tile value={pending} label="applications under review" href="/ops/applications" accent={pending > 0} />
          <Tile value={active} label="in the pool" href="/ops/pool" />
          <Tile value={projects} label="projects" href="/ops/projects" />
          <Tile value={submitted} label="await acceptance" href="/ops/projects" accent={submitted > 0} />
          <Tile value={openTickets} label="tickets in progress" href="/ops/projects" />
        </div>

        <div className="divider" style={{ marginTop: 48 }} />

        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2>Digital manager</h2>
          {conflicts.length > 0 && (
            <span className="tag tag-fail">Conflict Detected · {conflicts.length}</span>
          )}
        </div>
        <p className="muted" style={{ marginTop: 12, marginBottom: 24 }}>
          It watches and signals — it does not draw and does not run calculations. The drawings are made by the people the algorithm selected; the manager’s job is to keep the relay moving.
        </p>

        {alerts.length === 0 ? (
          <p className="dim">Quiet: deadlines are fine, everything has been picked up, acceptance is not piling up.</p>
        ) : (
          <>
            {heat.length > 1 && (
              <div className="stack" style={{ gap: 8, marginBottom: 24 }}>
                <div className="label">Where it stalled</div>
                {heat.map((h) => (
                  <div key={h.projectId} className="row" style={{ gap: 12, alignItems: 'baseline' }}>
                    <Link href={`/ops/projects/${h.projectId}`}>{titles.get(h.projectId)}</Link>
                    <span className="dim" style={{ fontSize: '0.85rem' }}>
                      {ALERT_LABELS[h.worst].toLowerCase()} · signals {h.total} · {Math.round(h.hours)} h
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginBottom: 24 }}>
              <OpsAction action={planBureauQueue} label="Work through the queue" />
              <p className="hint" style={{ marginTop: 8 }}>
                The assistant turns the queue into a list of actions for today. The order of urgency is computed by the engine — the assistant does not recompute it.
              </p>
            </div>
          </>
        )}

        {alerts.length > 0 && (
          <div className="table-scroll panel" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Signal</th>
                  <th>Task</th>
                  <th>Project</th>
                  <th>Hours</th>
                  <th>To whom</th>
                  <th>What to do</th>
                </tr>
              </thead>
              <tbody>
                {alerts.slice(0, 20).map((alert) => (
                  <tr key={`${alert.ticketId}-${alert.kind}`}>
                    <td>
                      <span
                        className={`tag ${alert.kind === 'conflict' || alert.kind === 'overdue' ? 'tag-fail' : 'tag-wait'}`}
                      >
                        {ALERT_LABELS[alert.kind]}
                      </span>
                    </td>
                    <td>
                      <Link href={`/ops/projects/${alert.projectId}`}>{alert.title}</Link>
                      <br />
                      <span className="dim" style={{ fontSize: '0.8rem' }}>
                        {DISCIPLINE_LABELS[alert.discipline as Discipline] ?? alert.discipline}
                      </span>
                    </td>
                    <td className="dim">{alert.projectTitle}</td>
                    <td className="num dim">{Math.round(alert.hours)}</td>
                    <td className="dim">
                      {alertAudience(alert.kind) === 'bureau' ? 'bureau' : 'specialist'}
                    </td>
                    <td className="dim">{ALERT_ACTIONS[alert.kind]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="divider" style={{ marginTop: 48 }} />

        <div id="invoices">
          <div
            className="row"
            style={{ justifyContent: 'space-between', alignItems: 'baseline' }}
          >
            <h2>Invoices</h2>
            {waitingInvoices > 0 && <span className="tag tag-wait">{waitingInvoices}</span>}
          </div>
          <p className="muted" style={{ marginTop: 12, marginBottom: 24, maxWidth: '62ch' }}>
            A stage does not open until its invoice is paid (§14a). There is no payment processing on the site: a person marks it after seeing the money arrive. An automatic “received” without checking the bank would mean an unsettled payment opens work for living people.
          </p>

          {invoices.length === 0 ? (
            <p className="dim">No invoices yet: the gate issues them when a stage is ready.</p>
          ) : (
            <div className="stack" style={{ gap: 16 }}>
              {invoices.map((invoice) => (
                <div key={invoice.invoiceId} className="panel">
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <Link href={`/ops/projects/${invoice.projectId}`}>{invoice.projectTitle}</Link>
                    {invoice.status === 'paid' ? (
                      <span className="tag">Paid</span>
                    ) : (
                      <span
                        className={
                          invoice.hours > INVOICE_NUDGE_HOURS ? 'tag tag-fail' : 'tag tag-wait'
                        }
                      >
                        {Math.round(invoice.hours)} h
                      </span>
                    )}
                  </div>

                  <div className="dim" style={{ marginTop: 8, fontSize: '0.85rem' }}>
                    {DOC_STAGE_LABELS[invoice.stage]} ·{' '}
                    <strong style={{ color: 'var(--text)' }}>
                      {amount(invoice.amount)} {invoice.currency}
                    </strong>
                    {invoice.paidAt && ` · ${date(invoice.paidAt)}`}
                  </div>

                  {invoice.status === 'issued' && (
                    <div className="row" style={{ marginTop: 14, gap: 20, alignItems: 'flex-end' }}>
                      <OpsAction
                        action={markInvoicePaid}
                        hidden={{ invoiceId: invoice.invoiceId, projectId: invoice.projectId }}
                        label="Mark as paid"
                        solid
                      >
                        <input
                          type="text"
                          name="note"
                          placeholder="What confirms the payment"
                          style={{ marginBottom: 10 }}
                        />
                      </OpsAction>

                      {/*
                        Voiding sits alongside but is not highlighted: the gate issues the invoice, and it is a person who errs — a wrong floor area gives a wrong sum. A reason is required: the client has already seen the invoice.
                      */}
                      <OpsAction
                        action={voidProjectInvoice}
                        hidden={{ invoiceId: invoice.invoiceId, projectId: invoice.projectId }}
                        label="Void"
                      >
                        <input
                          type="text"
                          name="note"
                          placeholder="Why you are voiding it"
                          style={{ marginBottom: 10 }}
                        />
                      </OpsAction>
                    </div>
                  )}
                </div>
              ))}

              {/*
                Список не бесконечный, и об этом сказано прямо. Неоплаченные
                показаны все — это работа; оплаченные обрезаны последними,
                потому что их число растёт всю жизнь бюро, а нужны они здесь
                только как подтверждение только что нажатого.
              */}
              <p className="dim" style={{ fontSize: '0.85rem' }}>
                {fill(
                  'Every unpaid invoice is shown. Of the paid ones — the latest {count}; the rest are on the project pages.',
                  { count: PAID_SHOWN },
                )}
              </p>
            </div>
          )}
        </div>

        <div className="divider" style={{ marginTop: 48 }} />

        <div id="directions">
          <div
            className="row"
            style={{ justifyContent: 'space-between', alignItems: 'baseline' }}
          >
            <h2>Projects without a chosen direction</h2>
            {directions.length > 0 && <span className="tag tag-wait">{directions.length}</span>}
          </div>
          <p className="muted" style={{ marginTop: 12, marginBottom: 24, maxWidth: '62ch' }}>
            This does not stop the work, and that is the problem. The directions are prepared right
            after the team is assembled because the choice is needed before the first ticket, not
            once something has been drawn against it. While the client is silent the architect and
            the visualiser work blind — and the rework is ours.
          </p>

          {directions.length === 0 ? (
            <p className="dim">Every running project has a direction chosen.</p>
          ) : (
            <div className="table-scroll panel" style={{ padding: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Working meanwhile</th>
                    <th>Waiting</th>
                  </tr>
                </thead>
                <tbody>
                  {directions.map((d) => (
                    <tr key={d.projectId}>
                      <td>
                        <Link href={`/ops/projects/${d.projectId}`}>{d.projectTitle}</Link>
                      </td>
                      <td className="num dim">{d.working}</td>
                      <td className="num">
                        <span
                          className={
                            d.hours > DIRECTION_NUDGE_HOURS ? 'tag tag-fail' : 'tag tag-wait'
                          }
                        >
                          {Math.round(d.hours)} h
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="divider" style={{ marginTop: 48 }} />

        {/* id — точка опоры для e2e: таблиц на панели несколько, и «первая
            строка первой таблицы» указывает не на эту. */}
        <div id="approvals">
          <div
            className="row"
            style={{ justifyContent: 'space-between', alignItems: 'baseline' }}
          >
            <h2>Stages awaiting the client</h2>
            {approvals.length > 0 && <span className="tag tag-wait">{approvals.length}</span>}
          </div>
        <p className="muted" style={{ marginTop: 12, marginBottom: 24, maxWidth: '62ch' }}>
          The work is accepted, the next stage does not open: we are waiting on the client’s word. Their silence stops delivery as surely as a missed deadline, and it belongs here, not out of sight in their cabinet.
        </p>

        {approvals.length === 0 ? (
          <p className="dim">No one is waiting: every finished stage is confirmed.</p>
        ) : (
          <div className="table-scroll panel" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Stage</th>
                  <th>Waiting</th>
                </tr>
              </thead>
              <tbody>
                {approvals.map((a) => (
                  <tr key={`${a.projectId}-${a.stage}`}>
                    <td>
                      <Link href={`/ops/projects/${a.projectId}`}>{a.projectTitle}</Link>
                    </td>
                    <td className="dim">{DOC_STAGE_LABELS[a.stage as DocStage] ?? a.stage}</td>
                    <td className="num">
                      <span
                        className={a.hours > APPROVAL_NUDGE_HOURS ? 'tag tag-fail' : 'tag tag-wait'}
                      >
                        {Math.round(a.hours)} h
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </div>

        <div className="divider" style={{ marginTop: 48 }} />

        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2>Clients awaiting an answer</h2>
          {questions.length > 0 && (
            <span className="tag tag-fail">{questions.length}</span>
          )}
        </div>
        <p className="muted" style={{ marginTop: 12, marginBottom: 24, maxWidth: '62ch' }}>
          This is the only channel the client has, and we are the party on the other end. Silence here does not read as busy — it reads as nobody working on the project.
        </p>

        {questions.length === 0 ? (
          <p className="dim">No unanswered questions.</p>
        ) : (
          <div className="stack" style={{ gap: 16 }}>
            {questions.map((q) => (
              <div
                key={q.projectId}
                className="panel"
                style={{ borderColor: q.hours > ANSWER_SLA_HOURS ? 'var(--fail)' : undefined }}
              >
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <Link href={`/ops/projects/${q.projectId}`}>{q.projectTitle}</Link>
                  <span className={q.hours > ANSWER_SLA_HOURS ? 'tag tag-fail' : 'tag tag-wait'}>
                    {Math.round(q.hours)} h
                    {q.count > 1 && ` · messages ${q.count}`}
                  </span>
                </div>
                <p style={{ marginTop: 12, marginBottom: 0, whiteSpace: 'pre-wrap' }}>{q.body}</p>
              </div>
            ))}
          </div>
        )}

        <div className="divider" style={{ marginTop: 48 }} />

        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2>Could not take on</h2>
          {lost.length > 0 && <span className="tag tag-fail">{lost.length}</span>}
        </div>
        <p className="muted" style={{ marginTop: 12, marginBottom: 24, maxWidth: '62ch' }}>
          Briefs for which no team came together. This is not a list of failures but a hiring list — and the most expensive one there is: not “who might we hire”, but which commission we would already have been paid for, had we had this person.
        </p>

        {lost.length === 0 ? (
          <p className="dim">Every brief that reached a run came together.</p>
        ) : (
          <div className="table-scroll panel" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Country</th>
                  <th>Who was missing</th>
                  <th>Waiting</th>
                </tr>
              </thead>
              <tbody>
                {lost.map((row) => (
                  <tr key={row.projectId}>
                    <td>{row.title}</td>
                    <td className="dim">{JURISDICTION_NAMES[row.jurisdiction] ?? row.jurisdiction}</td>
                    <td>
                      {row.outcome === 'no_signatory' ? (
                        <span className="tag tag-fail">no one to sign</span>
                      ) : row.gap ? (
                        <span className="dim" style={{ fontSize: '0.85rem' }}>
                          {roleName(row.gap)}
                          {row.gap.candidates > 0 && ` · candidates ${row.gap.candidates}`}
                        </span>
                      ) : (
                        <span className="dim">no team came together</span>
                      )}
                    </td>
                    <td className="num dim">
                      {Math.max(0, Math.floor((Date.now() - row.since.getTime()) / 86_400_000))} days
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="divider" style={{ marginTop: 48 }} />

        <div className="stack" style={{ gap: 10 }}>
          <Link href="/ops/applications">Specialist applications →</Link>
          <Link href="/ops/import">Specialist database import →</Link>
          <Link href="/ops/pool">Pool and metrics →</Link>
          <Link href="/ops/projects">Projects and runs →</Link>
          <Link href="/ops/letters">Letters sent →</Link>
        </div>
      </div>
    </section>
  )
}

function Tile({
  value,
  label,
  href,
  accent,
}: {
  value: number
  label: string
  href: string
  accent?: boolean
}) {
  return (
    <Link
      href={href}
      className="panel"
      style={{ display: 'block', color: 'var(--text)', borderColor: accent ? 'var(--accent)' : undefined }}
    >
      <div className="num" style={{ fontSize: '2.4rem', color: accent ? 'var(--accent)' : 'var(--text)' }}>
        {value}
      </div>
      <div className="label">{label}</div>
    </Link>
  )
}
