import Link from 'next/link'
import { redirect } from 'next/navigation'
import { DISCIPLINES, DOC_STAGES, type Discipline, type DocStage } from '@/engine/taxonomy'
import { CURRENCY } from '@/engine/payout'
import { DISCIPLINE_LABELS, DOC_STAGE_LABELS } from '@/lib/labels'
import { amount as money } from '@/lib/format'
import { fill } from '@/lib/fill'
import { isOperator } from '@/lib/session'
import { payoutQueue, rates, unratedObligations } from '@/lib/services/payouts'
import { OpsAction } from '../OpsForms'
import { markObligationPaid, setPayoutRate } from '../actions'

export const metadata = { title: 'Payouts — bureau panel' }

export default async function PayoutsPage() {
  if (!(await isOperator())) redirect('/ops')

  const [table, queue, unrated] = await Promise.all([rates(), payoutQueue(), unratedObligations()])

  const open = queue.filter((row) => row.status === 'accrued')
  const paid = queue.filter((row) => row.status === 'paid')

  const owedKnown = open.reduce((sum, row) => sum + (row.amount ?? 0), 0)
  const owedUnknown = open.filter((row) => row.amount === null).length

  const rateOf = new Map(table.map((r) => [`${r.discipline}:${r.stage}`, r.amount]))

  return (
    <section style={{ paddingTop: 'clamp(40px, 7vw, 72px)' }}>
      <div className="shell">
        <span className="eyebrow">Bureau panel</span>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h1>What the bureau owes</h1>
          <Link href="/ops" className="btn btn-quiet">
            ← panel
          </Link>
        </div>

        <p className="muted" style={{ marginTop: 12, maxWidth: '64ch' }}>An obligation is accrued the moment the bureau accepts the work — not when the client confirms the stage. Acceptance means “done as specified”, and a client who takes a week to confirm does not make the work undone. The fee is set per discipline per stage, not per ticket: tickets are how the relay split the work, and paying by their number would be paying for the split.</p>

        <div className="grid grid-3" style={{ marginTop: 32 }}>
          <Stat value={`${money(owedKnown)} ${CURRENCY}`} label="owed, by known rates" />
          <Stat value={String(open.length)} label="obligations open" />
          <Stat
            value={String(owedUnknown)}
            label="of them without a rate"
            note={owedUnknown > 0 ? 'the total above is short by these' : 'the total above is complete'}
            warn={owedUnknown > 0}
          />
        </div>

        {/*
          Незакрытые пары — первыми и отдельно от таблицы ставок. Список всех
          возможных пар в сорок с лишним строк означал бы «назови цену работе,
          которой у тебя никогда не было»; спрашивается ставка ровно там, где
          долг уже возник.
        */}
        {unrated.length > 0 && (
          <div className="panel" style={{ marginTop: 32, borderColor: 'var(--fail)' }}>
            <div className="label" style={{ color: 'var(--fail)' }}>Rates the ledger is waiting for</div>
            <p className="muted" style={{ marginTop: 12, marginBottom: 16, maxWidth: '62ch' }}>Work has been accepted on these and the bureau owes for it, but the amount is unknown. Until every one of them has a rate, gross margin cannot be computed for the projects they belong to — and a margin computed over part of the cost is always too high, never too low.</p>

            <div className="stack" style={{ gap: 8 }}>
              {unrated.map((row) => (
                <div key={`${row.discipline}:${row.stage}`} className="row" style={{ gap: 10 }}>
                  <span className="tag tag-fail">{DISCIPLINE_LABELS[row.discipline]}</span>
                  <span className="dim">{DOC_STAGE_LABELS[row.stage]}</span>
                  <span className="num dim">
                    {fill('{count} owed', { count: row.count })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="divider" style={{ marginTop: 44 }} />

        <h2>Rates</h2>
        <p className="muted" style={{ marginTop: 12, marginBottom: 24, maxWidth: '62ch' }}>Rates are not built into the product, and that is deliberate. The price shown to a client has starting figures because a price has to be named before any statistics exist; a made-up fee here would mean a made-up margin, and margin is what tells you whether the business is alive. A saved rate is also applied to obligations already accrued without one: the work was the same work, and the first month should not fall out of the arithmetic for good.</p>

        <div className="panel" style={{ maxWidth: 560 }}>
          <OpsAction action={setPayoutRate} label="Save the rate" solid>
            <div className="grid grid-2" style={{ gap: 16, marginBottom: 14 }}>
              <div className="field">
                <label htmlFor="discipline">Discipline</label>
                <select id="discipline" name="discipline" defaultValue="architecture">
                  {DISCIPLINES.map((value) => (
                    <option key={value} value={value}>
                      {DISCIPLINE_LABELS[value as Discipline]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="stage">Stage</label>
                <select id="stage" name="stage" defaultValue="concept">
                  {DOC_STAGES.map((value) => (
                    <option key={value} value={value}>
                      {DOC_STAGE_LABELS[value as DocStage]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field" style={{ marginBottom: 14 }}>
              <label htmlFor="amount">{fill('Fee, {currency}', { currency: CURRENCY })}</label>
              <input id="amount" name="amount" type="number" min="0" step="1" defaultValue="0" />
            </div>
          </OpsAction>
        </div>

        <div className="table-scroll panel" style={{ padding: 0, marginTop: 28 }}>
          <table>
            <thead>
              <tr>
                <th>Discipline</th>
                {DOC_STAGES.map((stage) => (
                  <th key={stage}>{DOC_STAGE_LABELS[stage]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DISCIPLINES.map((discipline) => (
                <tr key={discipline}>
                  <td>{DISCIPLINE_LABELS[discipline as Discipline]}</td>
                  {DOC_STAGES.map((stage) => {
                    const value = rateOf.get(`${discipline}:${stage}`)

                    return (
                      <td key={stage} className="num">
                        {/*
                          Пустая клетка, а не ноль. Ноль означает бесплатную
                          работу, то есть маржу, равную всей цене стадии.
                        */}
                        {value === undefined ? <span className="dim">not set</span> : money(value)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="divider" style={{ marginTop: 44 }} />

        <h2>Owed now</h2>
        <p className="muted" style={{ marginTop: 12, marginBottom: 24, maxWidth: '62ch' }}>Every open obligation is shown, with no cap: on the other side of each is a person who did the work and is waiting for the money, and one cut off the list is one nobody pays. There is no payment processing here — the bureau marks a payout once it has sent the money, the same way it marks an invoice once it sees it arrive.</p>

        {open.length === 0 && paid.length === 0 ? (
          <div className="note">Nothing has been accrued yet. Obligations appear as the bureau accepts work.</div>
        ) : (
          <div className="stack" style={{ gap: 16 }}>
            {[...open, ...paid].map((row) => (
              <div key={row.id} className={row.status === 'accrued' ? 'panel panel-accent' : 'panel'}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <Link href={`/ops/projects/${row.projectId}`}>{row.projectTitle}</Link>
                    <div className="dim" style={{ fontSize: '0.82rem', marginTop: 4 }}>
                      {row.specialistName} · {DISCIPLINE_LABELS[row.discipline]} ·{' '}
                      {DOC_STAGE_LABELS[row.stage]}
                    </div>
                  </div>
                  <span className={row.status === 'paid' ? 'tag tag-pass' : 'tag tag-wait'}>
                    {row.status === 'paid' ? 'Paid' : 'Owed'}
                  </span>
                </div>

                <div className="num" style={{ fontSize: '1.6rem', marginTop: 12 }}>
                  {row.amount === null ? (
                    <span style={{ color: 'var(--fail)' }}>rate not set</span>
                  ) : (
                    `${money(row.amount)} ${row.currency}`
                  )}
                </div>

                {row.status === 'accrued' && (
                  <div style={{ marginTop: 14 }}>
                    <OpsAction
                      action={markObligationPaid}
                      hidden={{ payoutId: row.id }}
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
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function Stat({
  value,
  label,
  note,
  warn,
}: {
  value: string
  label: string
  note?: string
  warn?: boolean
}) {
  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
      <div className="num" style={{ fontSize: '1.6rem', color: warn ? 'var(--fail)' : undefined }}>
        {value}
      </div>
      <div className="label" style={{ marginTop: 6 }}>
        {label}
      </div>
      {note && (
        <div className="dim" style={{ fontSize: '0.8rem', marginTop: 4 }}>
          {note}
        </div>
      )}
    </div>
  )
}
