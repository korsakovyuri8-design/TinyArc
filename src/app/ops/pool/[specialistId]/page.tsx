import Link from 'next/link'
import { amount, date, dateTime } from '@/lib/format'
import { notFound, redirect } from 'next/navigation'
import { deliveryMetrics } from '@/engine/metrics'
import { PORTFOLIO_THRESHOLD, SUBSCRIPTIONS } from '@/engine/taxonomy'
import { SpecialistForm } from '@/components/SpecialistForm'
import { prisma } from '@/lib/db'
import { AVAILABILITY_LABELS, SPECIALIST_STATUS_LABELS, SUBSCRIPTION_LABELS } from '@/lib/labels'
import { toProfile } from '@/lib/rows'
import { isOperator } from '@/lib/session'
import { OpsAction } from '@/app/ops/OpsForms'
import { editSpecialist, setSubscription } from './actions'

export const metadata = { title: 'Specialist profile — bureau panel' }

export default async function SpecialistPage({
  params,
}: {
  params: Promise<{ specialistId: string }>
}) {
  if (!(await isOperator())) redirect('/ops')

  const { specialistId } = await params
  const row = await prisma.specialist.findUnique({ where: { id: specialistId } })
  if (!row) notFound()

  // Выходы из проектов показываются, но в отбор не входят. Решение сознательное:
  // штраф за честный отказ учит молчать, а молчание вскрывается позже и дороже.
  // Видеть их всё равно надо — по ним понятно, где заявленная ёмкость расходится
  // с настоящей.
  const withdrawals = await prisma.withdrawal.findMany({
    where: { specialistId },
    orderBy: { createdAt: 'desc' },
    include: { project: { select: { title: true } } },
  })

  const profile = toProfile(row)
  const metrics = deliveryMetrics(profile.delivery)

  return (
    <section style={{ paddingTop: 'clamp(40px, 7vw, 72px)' }}>
      <div className="shell" style={{ maxWidth: 760 }}>
        <Link href="/ops/pool" className="label">
          ← pool
        </Link>

        <div className="row" style={{ justifyContent: 'space-between', marginTop: 20 }}>
          <h1>{profile.displayName}</h1>
          <span className="tag">{SPECIALIST_STATUS_LABELS[row.status] ?? row.status}</span>
        </div>

        <p className="dim" style={{ marginTop: 8, fontSize: '0.85rem' }}>
          {row.email} · key {row.accessKey} ·{' '}
          {row.source === 'import' ? 'created by database import' : 'applied on their own'}
        </p>

        <div className="grid grid-3" style={{ marginTop: 32 }}>
          <Stat
            value={profile.portfolioRating.toFixed(1)}
            label="portfolio"
            note={`threshold ${PORTFOLIO_THRESHOLD}/10`}
          />
          <Stat
            value={String(profile.weeklyCapacityHours)}
            label="h/week free"
            note={AVAILABILITY_LABELS[row.availabilityStatus] ?? row.availabilityStatus}
          />
          <Stat
            value={metrics ? String(metrics.delivered) : '0'}
            label="tickets delivered"
            note={metrics ? `${Math.round(metrics.slaCompliance * 100)}% on time` : 'no history'}
          />
        </div>

        {withdrawals.length > 0 && (
          <div className="panel" style={{ marginTop: 32 }}>
            <div className="label">Left projects · {withdrawals.length}</div>
            <p className="hint" style={{ marginTop: 8, marginBottom: 14 }}>
              This does not enter selection and does not become a score: penalising an honest withdrawal teaches silence, and silence surfaces later and costs more. It is worth looking at here for a different reason — the gap between declared capacity and real capacity.
            </p>
            <div className="stack" style={{ gap: 10 }}>
              {withdrawals.map((w) => (
                <div key={w.id} className="dim" style={{ fontSize: '0.85rem' }}>
                  <strong style={{ color: 'var(--text)' }}>{w.project.title}</strong> ·{' '}
                  {date(w.createdAt)} · {w.reason}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="panel" style={{ marginTop: 32 }}>
          <div className="label label-accent">Access to projects</div>
          <p className="muted" style={{ marginTop: 12, marginBottom: 16 }}>
            The subscription is a gate, not a score: without it the person is not in selection at all, and it is checked before the portfolio. Being turned away over money must not look like being turned away over qualification (§14a). Currently:{' '}
            <strong style={{ color: 'var(--text)' }}>
              {SUBSCRIPTION_LABELS[profile.subscription]}
            </strong>
            .
          </p>

          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
            {SUBSCRIPTIONS.filter((value) => value !== profile.subscription).map((value) => (
              <OpsAction
                key={value}
                action={setSubscription}
                hidden={{ specialistId: row.id, subscription: value }}
                label={`Switch to “${SUBSCRIPTION_LABELS[value]}”`}
              />
            ))}
          </div>
        </div>

        <div className="divider" style={{ marginTop: 44 }} />

        <h2>Editing the profile</h2>

        <p className="muted" style={{ marginTop: 14, maxWidth: '62ch' }}>
          The specialist’s cabinet says selection fields are changed through the bureau. This is that place. What is edited here are facts about the person: discipline, specialisation, jurisdictions, software suite, stages, languages, time zone.
        </p>

        <div className="panel" style={{ marginTop: 24, marginBottom: 36 }}>
          <div className="label label-accent">What is not here, and why</div>
          <ul className="muted" style={{ marginTop: 14, marginBottom: 0, paddingLeft: 18 }}>
            <li style={{ marginBottom: 8 }}>
              <strong>Portfolio rating.</strong> It is set during application review and changed there, as a separate action — so that editing facts never quietly becomes editing the score.
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong>Free capacity and availability status.</strong> A specialist governs their own time. It is the one thing they control directly, and taking it away would mean computing on a number nobody answers for.
            </li>
            <li>
              <strong>Delivery metrics.</strong> Computed from ticket events. There is no field to edit them for anyone, the bureau included (§12).
            </li>
          </ul>
        </div>

        <SpecialistForm
          action={editSpecialist}
          submitLabel="Save the profile"
          showCapacity={false}
          hidden={{ specialistId: row.id }}
          defaults={{
            portfolioUrl: row.portfolioUrl,
            disciplines: profile.disciplines,
            specializations: profile.specializations,
            typologies: profile.typologies,
            scaleBands: profile.scaleBands,
            materialSystems: profile.materialSystems,
            climateZones: profile.climateZones,
            jurisdictions: profile.jurisdictions,
            signsIn: profile.signsIn,
            software: profile.software,
            languages: profile.languages,
            docStages: profile.docStages,
            regulatoryTracks: profile.regulatoryTracks,
            ifcLevel: profile.ifcLevel,
            workMode: profile.workMode,
            maxStoreys: String(row.maxStoreys),
            utcOffset: String(row.utcOffset),
            leadTimeDays: String(row.leadTimeDays),
            weeklyCapacityHours: String(row.weeklyCapacityHours),
          }}
          done={
            <div className="panel panel-accent">
              <div className="label label-accent">Profile saved</div>
              <p className="muted" style={{ marginTop: 12, marginBottom: 16 }}>
                The changes enter the next selection run. They do not reassemble teams already put together: a line-up is fixed by its run, not re-read afterwards.
              </p>
              <Link href="/ops/pool">To the pool →</Link>
            </div>
          }
        />
      </div>
    </section>
  )
}

function Stat({ value, label, note }: { value: string; label: string; note: string }) {
  return (
    <div style={{ borderTop: '1px solid var(--border-strong)', paddingTop: 14 }}>
      <div className="num" style={{ fontSize: '2rem' }}>
        {value}
      </div>
      <div className="label">{label}</div>
      <div className="dim" style={{ fontSize: '0.82rem', marginTop: 6 }}>
        {note}
      </div>
    </div>
  )
}
