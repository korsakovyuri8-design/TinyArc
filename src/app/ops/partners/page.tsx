import Link from 'next/link'
import { redirect } from 'next/navigation'
import { DISCIPLINES, JURISDICTIONS, JURISDICTION_NAMES, SIGNED_DISCIPLINES } from '@/engine/taxonomy'
import { prisma } from '@/lib/db'
import { DISCIPLINE_LABELS } from '@/lib/labels'
import { parseList } from '@/lib/rows'
import { isOperator } from '@/lib/session'
import { addPartner, togglePartner } from './actions'

export const metadata = { title: 'Signing partners · TinyArc Cloud Bureau' }

/**
 * Местные фирмы с правом подписи.
 *
 * Страна открывается не пулом, а подписью: пока под архитектурой,
 * конструкциями и системами в стране проекта подписать некому, движок
 * проект не берёт, сколько бы сильных людей ни было в пуле.
 */
export default async function PartnersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  if (!(await isOperator())) redirect('/ops')

  const { error } = await searchParams
  const rows = await prisma.signingPartner.findMany({ orderBy: [{ active: 'desc' }, { createdAt: 'asc' }] })

  return (
    <section style={{ paddingTop: 'clamp(40px, 6vw, 72px)' }}>
      <div className="shell" style={{ maxWidth: 880 }}>
        <Link href="/ops">Bureau panel</Link>
        <h1 style={{ marginTop: 16 }}>Signing partners</h1>
        <p className="lead" style={{ marginTop: 16 }}>
          Local design firms that review the team&apos;s sections, sign them through their licensed engineers and
          file the permit package. A section needs a signature from a team member licensed in the project&apos;s
          country, or from a partner here. The engine does not take a project while any of architecture,
          structural or MEP has no one to sign it.
        </p>

        {rows.length === 0 ? (
          <p className="muted" style={{ marginTop: 32 }}>No partners yet.</p>
        ) : (
          <div style={{ marginTop: 32 }}>
            {rows.map((r) => {
              const disciplines = parseList(r.disciplinesJson, DISCIPLINES)
              return (
                <div key={r.id} className="panel" style={{ marginBottom: 14, opacity: r.active ? 1 : 0.55 }}>
                  <div className="row" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <strong>{r.name}</strong>
                    <span className="tag">{r.active ? 'signs' : 'paused'}</span>
                  </div>
                  <p className="muted" style={{ margin: '8px 0 0' }}>
                    {JURISDICTION_NAMES[r.jurisdiction as keyof typeof JURISDICTION_NAMES] ?? r.jurisdiction}
                    {': '}
                    {disciplines.map((d) => DISCIPLINE_LABELS[d]).join(', ')}
                    {r.registration ? `. Registration ${r.registration}` : ''}
                  </p>
                  {(r.contactName || r.email || r.phone) && (
                    <p className="muted" style={{ margin: '4px 0 0' }}>
                      {[r.contactName, r.email, r.phone].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {r.terms && <p style={{ margin: '8px 0 0' }}>Terms: {r.terms}</p>}
                  {r.notes && <p className="muted" style={{ margin: '4px 0 0' }}>{r.notes}</p>}
                  <form action={togglePartner} style={{ marginTop: 12 }}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="btn btn-quiet" type="submit">
                      {r.active ? 'Pause' : 'Resume'}
                    </button>
                  </form>
                </div>
              )
            })}
          </div>
        )}

        <h2 style={{ marginTop: 48 }}>Add a partner</h2>
        {error && (
          <p role="alert" style={{ color: 'var(--fail)', marginTop: 12 }}>
            {error}
          </p>
        )}
        <form action={addPartner} style={{ marginTop: 20 }}>
          <div className="field">
            <label htmlFor="name">Firm</label>
            <input id="name" name="name" required />
          </div>
          <div className="field">
            <label htmlFor="jurisdiction">Country where it signs</label>
            <select id="jurisdiction" name="jurisdiction" defaultValue="ME">
              {JURISDICTIONS.map((j) => (
                <option key={j} value={j}>
                  {JURISDICTION_NAMES[j]}
                </option>
              ))}
            </select>
          </div>
          <fieldset className="field">
            <legend>Sections it can sign</legend>
            {SIGNED_DISCIPLINES.map((d) => (
              <label key={d} className="row" style={{ gap: 8 }}>
                <input type="checkbox" name="disciplines" value={d} />
                <span>{DISCIPLINE_LABELS[d]}</span>
              </label>
            ))}
          </fieldset>
          <div className="field">
            <label htmlFor="registration">Registration or licence number</label>
            <input id="registration" name="registration" />
            <div className="hint">What you checked in the chamber register before trusting the firm with a signature</div>
          </div>
          <div className="grid grid-2">
            <div className="field">
              <label htmlFor="contactName">Contact</label>
              <input id="contactName" name="contactName" />
            </div>
            <div className="field">
              <label htmlFor="phone">Phone</label>
              <input id="phone" name="phone" type="tel" />
            </div>
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" />
          </div>
          <div className="field">
            <label htmlFor="terms">Terms</label>
            <textarea id="terms" name="terms" rows={3} />
            <div className="hint">What the firm charges for review and signature, and in what form</div>
          </div>
          <div className="field">
            <label htmlFor="notes">Notes</label>
            <textarea id="notes" name="notes" rows={2} />
          </div>
          <button className="btn btn-solid" type="submit">
            Add
          </button>
        </form>
      </div>
    </section>
  )
}
