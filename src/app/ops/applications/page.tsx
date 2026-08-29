import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  PORTFOLIO_THRESHOLD,
  JURISDICTION_NAMES,
  type Discipline,
  type Jurisdiction,
  type Specialization,
} from '@/engine/taxonomy'
import { prisma } from '@/lib/db'
import { DISCIPLINE_LABELS, PORTFOLIO_KIND_LABELS, SPECIALIZATION_LABELS } from '@/lib/labels'
import { toProfile } from '@/lib/rows'
import { isOperator } from '@/lib/session'
import { proposeRating, reinviteSpecialist, reviewApplication } from '../actions'
import { OpsAction } from '../OpsForms'

export const metadata = { title: 'Applications — bureau panel' }

export default async function ApplicationsPage() {
  if (!(await isOperator())) redirect('/ops')

  const [rows, invited] = await Promise.all([
    prisma.specialist.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      include: { portfolio: { orderBy: { createdAt: 'asc' } } },
    }),
    prisma.specialist.findMany({
      where: { status: 'invited' },
      orderBy: { invitedAt: 'asc' },
      select: { id: true, displayName: true, email: true, invitedAt: true, accessKey: true },
    }),
  ])

  return (
    <section style={{ paddingTop: 'clamp(40px, 7vw, 72px)' }}>
      <div className="shell">
        <Link href="/ops" className="label">
          ← panel
        </Link>
        <h1 style={{ marginTop: 18 }}>Applications under review</h1>
        <p className="muted" style={{ marginTop: 14, maxWidth: '58ch' }}>
          The only decision here is the portfolio rating. Whether someone passes follows from the threshold
          {' '}{PORTFOLIO_THRESHOLD}/10 automatically: that is a product rule, not discretion.
        </p>

        {invited.length > 0 && (
          <>
            <div className="divider" style={{ marginTop: 40 }} />
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h2>Invited, profile not filled in</h2>
              <span className="tag tag-wait">{invited.length}</span>
            </div>
            <p className="muted" style={{ marginTop: 12, marginBottom: 24, maxWidth: '58ch' }}>
              These came in through a database import. The ball is in their court, not ours: until the profile is filled in, selection does not see them — not by a decision of the bureau, but because there is nothing to compute on.
            </p>

            <div className="table-scroll panel" style={{ padding: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Who</th>
                    <th>Email</th>
                    <th>Key</th>
                    <th>Silent for</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {invited.map((row) => {
                    const days = row.invitedAt
                      ? Math.floor((Date.now() - row.invitedAt.getTime()) / 86_400_000)
                      : null

                    return (
                      <tr key={row.id}>
                        <td>{row.displayName}</td>
                        <td className="dim">{row.email}</td>
                        {/* Ключ виден здесь, потому что при почте-заглушке
                            письмо не уходит, а передать доступ всё равно надо.
                            Панель закрыта паролем — это не публичное место. */}
                        <td className="num dim" style={{ fontSize: '0.78rem' }}>{row.accessKey}</td>
                        <td className="num dim">
                          {days === null ? 'not invited yet' : `${days} days`}
                        </td>
                        <td>
                          <OpsAction
                            action={reinviteSpecialist}
                            hidden={{ specialistId: row.id }}
                            label="Invite again"
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="divider" style={{ marginTop: 40 }} />
          </>
        )}

        {rows.length === 0 ? (
          <p className="dim" style={{ marginTop: 40 }}>
            Everything is reviewed.
          </p>
        ) : (
          <div className="grid grid-2" style={{ marginTop: 36 }}>
            {rows.map((row) => {
              const profile = toProfile(row)

              return (
                <div key={row.id} className="panel">
                  <h3>{profile.displayName}</h3>
                  <p className="dim" style={{ marginTop: 6, fontSize: '0.85rem' }}>
                    {row.email}
                  </p>

                  <p style={{ marginTop: 14, marginBottom: 14 }}>
                    <a href={row.portfolioUrl} target="_blank" rel="noreferrer noopener">
                      Portfolio ↗
                    </a>
                  </p>

                  {row.portfolio.length > 0 && (
                    <div
                      className="stack"
                      style={{ gap: 10, marginBottom: 16, paddingLeft: 12, borderLeft: '1px solid var(--border-strong)' }}
                    >
                      {row.portfolio.map((work) => (
                        <div key={work.id}>
                          <div className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
                            <a href={work.url} target="_blank" rel="noreferrer noopener">
                              {work.title}
                            </a>
                            <span className="tag">
                              {PORTFOLIO_KIND_LABELS[work.kind] ?? work.kind}
                            </span>
                          </div>
                          <div className="dim" style={{ fontSize: '0.8rem', marginTop: 4 }}>
                            {work.roleDescription}
                            {work.areaSqm ? ` · ${work.areaSqm} m²` : ''}
                            {work.durationMonths ? ` · ${work.durationMonths} months` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="stack" style={{ gap: 6, fontSize: '0.85rem' }}>
                    <Line label="Disciplines" value={profile.disciplines.map((d) => DISCIPLINE_LABELS[d as Discipline]).join(', ')} />
                    <Line
                      label="Specialisation"
                      value={profile.specializations
                        .map((x) => SPECIALIZATION_LABELS[x as Specialization])
                        .join(', ')}
                    />
                    <Line label="Jurisdictions" value={profile.jurisdictions.map((j) => JURISDICTION_NAMES[j as Jurisdiction]).join(', ')} />
                    <Line
                      label="Signing"
                      value={profile.signsIn.map((j) => JURISDICTION_NAMES[j as Jurisdiction]).join(', ') || 'none'}
                    />
                    <Line label="Storey count" value={String(profile.maxStoreys)} />
                    <Line label="Software / IFC" value={`${profile.software.join(', ')} · ${profile.ifcLevel}`} />
                    <Line label="Capacity" value={`${profile.weeklyCapacityHours} h/week, starts within ${profile.leadTimeDays} days`} />
                  </div>

                  <div className="divider" style={{ margin: '18px 0' }} />

                  <div style={{ marginBottom: 14 }}>
                    <OpsAction
                      action={proposeRating}
                      hidden={{ specialistId: row.id }}
                      label="What the portfolio shows"
                    />
                  </div>

                  <OpsAction
                    action={reviewApplication}
                    hidden={{ specialistId: row.id }}
                    label="Set the rating"
                    solid
                  >
                    <div className="field">
                      <label htmlFor={`rating-${row.id}`}>Portfolio rating, 0–10</label>
                      <input
                        id={`rating-${row.id}`}
                        name="portfolioRating"
                        type="number"
                        min={0}
                        max={10}
                        step={0.1}
                        defaultValue={8}
                      />
                    </div>
                  </OpsAction>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
      <span className="dim">{label}</span>
      <span style={{ textAlign: 'right' }}>{value || '—'}</span>
    </div>
  )
}
