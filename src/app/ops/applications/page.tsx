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
import { proposeRating, reviewApplication } from '../actions'
import { OpsAction } from '../OpsForms'

export const metadata = { title: 'Заявки — панель бюро' }

export default async function ApplicationsPage() {
  if (!(await isOperator())) redirect('/ops')

  const rows = await prisma.specialist.findMany({
    where: { status: 'pending' },
    orderBy: { createdAt: 'asc' },
    include: { portfolio: { orderBy: { createdAt: 'asc' } } },
  })

  return (
    <section style={{ paddingTop: 'clamp(40px, 7vw, 72px)' }}>
      <div className="shell">
        <Link href="/ops" className="label">
          ← панель
        </Link>
        <h1 style={{ marginTop: 18 }}>Заявки на разборе</h1>
        <p className="muted" style={{ marginTop: 14, maxWidth: '58ch' }}>
          Единственное решение здесь — рейтинг портфолио. Пускать или нет, следует из порога
          {' '}{PORTFOLIO_THRESHOLD}/10 автоматически: это правило продукта, а не усмотрение.
        </p>

        {rows.length === 0 ? (
          <p className="dim" style={{ marginTop: 40 }}>
            Разобрано всё.
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
                      Портфолио ↗
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
                            {work.areaSqm ? ` · ${work.areaSqm} м²` : ''}
                            {work.durationMonths ? ` · ${work.durationMonths} мес.` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="stack" style={{ gap: 6, fontSize: '0.85rem' }}>
                    <Line label="Дисциплины" value={profile.disciplines.map((d) => DISCIPLINE_LABELS[d as Discipline]).join(', ')} />
                    <Line
                      label="Специализация"
                      value={profile.specializations
                        .map((x) => SPECIALIZATION_LABELS[x as Specialization])
                        .join(', ')}
                    />
                    <Line label="Юрисдикции" value={profile.jurisdictions.map((j) => JURISDICTION_NAMES[j as Jurisdiction]).join(', ')} />
                    <Line
                      label="Подпись"
                      value={profile.signsIn.map((j) => JURISDICTION_NAMES[j as Jurisdiction]).join(', ') || 'нет'}
                    />
                    <Line label="Этажность" value={String(profile.maxStoreys)} />
                    <Line label="Софт / IFC" value={`${profile.software.join(', ')} · ${profile.ifcLevel}`} />
                    <Line label="Ёмкость" value={`${profile.weeklyCapacityHours} ч/нед, выход ${profile.leadTimeDays} дн.`} />
                  </div>

                  <div className="divider" style={{ margin: '18px 0' }} />

                  <div style={{ marginBottom: 14 }}>
                    <OpsAction
                      action={proposeRating}
                      hidden={{ specialistId: row.id }}
                      label="Что видно в портфолио"
                    />
                  </div>

                  <OpsAction
                    action={reviewApplication}
                    hidden={{ specialistId: row.id }}
                    label="Поставить рейтинг"
                    solid
                  >
                    <div className="field">
                      <label htmlFor={`rating-${row.id}`}>Рейтинг портфолио, 0–10</label>
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
