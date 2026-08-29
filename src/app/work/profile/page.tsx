import Link from 'next/link'
import { redirect } from 'next/navigation'
import { deliveryMetrics, deliveryScore, historyWeight } from '@/engine/metrics'
import {
  PORTFOLIO_THRESHOLD,
  type Discipline,
  type Jurisdiction,
  type Specialization,
} from '@/engine/taxonomy'
import { JURISDICTION_NAMES } from '@/engine/taxonomy'
import {
  AVAILABILITY_LABELS,
  DISCIPLINE_LABELS,
  SPECIALIST_STATUS_LABELS,
  SPECIALIZATION_LABELS,
  SUBSCRIPTION_LABELS,
} from '@/lib/labels'
import { AvailabilityForm } from './AvailabilityForm'
import { toProfile } from '@/lib/rows'
import { company } from '@/lib/legal'
import { currentSpecialist } from '@/lib/session'
import { pageMetadata } from '@/lib/metadata'
import { fill } from '@/lib/fill'

export const metadata = pageMetadata('Profile and metrics')

export default async function ProfilePage() {
  const row = await currentSpecialist()
  if (!row) redirect('/enter')

  // Приглашённому здесь нечего делать: ни задач, ни метрик у него ещё нет, а
  // нужен от него профиль. Ведём туда, а не показываем пустой экран.
  if (row.status === 'invited') redirect('/work/profile/complete')

  const profile = toProfile(row)
  const metrics = deliveryMetrics(profile.delivery)
  const delivery = deliveryScore(metrics)
  const weight = historyWeight(profile.delivery)

  // Адрес бюро из настроек. Пока его нет — отвечать на письмо с ключом:
  // «напишите бюро» без адреса не действие, а отписка.
  const bureauEmail =
    company().email || 'the bureau’s address — reply to the email with your access key'

  return (
    <section style={{ paddingTop: 'clamp(40px, 7vw, 72px)' }}>
      <div className="shell" style={{ maxWidth: 900 }}>
        <Link href="/work" className="label">
          ← back to the work board
        </Link>

        <div className="row" style={{ justifyContent: 'space-between', marginTop: 20 }}>
          <h1>{profile.displayName}</h1>
          <span className="tag tag-accent">
            {SPECIALIST_STATUS_LABELS[row.status] ?? row.status}
          </span>
        </div>

        <div className="grid grid-3" style={{ marginTop: 36 }}>
          <Stat
            value={profile.portfolioRating.toFixed(1)}
            label={'portfolio'}
            note={fill('threshold {threshold}/10', { threshold: PORTFOLIO_THRESHOLD })}
            accent={profile.portfolioRating >= PORTFOLIO_THRESHOLD}
          />
          <Stat
            value={metrics ? delivery.toFixed(1) : '—'}
            label={'delivery score'}
            note={
              metrics
                ? fill('weight in Quality — {percent}%', { percent: Math.round(weight * 100) })
                : 'no history yet'
            }
          />
          <Stat
            value={String(profile.weeklyCapacityHours)}
            label={'h/week free'}
            note={
              profile.weeklyCapacityHours === 0
                ? 'at zero you are out of selection'
                : fill('{status}, starts within {days} days', {
                    status: AVAILABILITY_LABELS[row.availabilityStatus] ?? row.availabilityStatus,
                    days: profile.leadTimeDays,
                  })
            }
          />
        </div>

        {/*
          Доступ показывается всегда, а не только когда он закрыт. Гейт,
          который виден лишь в момент отказа, человек обнаруживает по
          отсутствию задач — то есть позже всего и хуже всего.
        */}
        <div
          className="panel"
          style={{
            marginTop: 36,
            borderColor: profile.subscription === 'none' ? 'var(--fail)' : undefined,
          }}
        >
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="label">Access to projects</div>
            <span className={profile.subscription === 'none' ? 'tag tag-fail' : 'tag'}>
              {SUBSCRIPTION_LABELS[profile.subscription]}
            </span>
          </div>

          {profile.subscription === 'none' ? (
            <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
              {fill(
                'While access is closed the engine does not consider you — whatever your portfolio and metrics. This is about paying for access, not about the quality of your work: being turned away over money and being turned away over qualification are different things, and we do not mix them. To open it, write to {email}.',
                { email: bureauEmail },
              )}
            </p>
          ) : (
            <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>Access is open: you take part in selection on the usual terms. The supply side pays for access to demand — the bureau takes no commission from your fee.</p>
          )}
        </div>

        <div className="divider" style={{ marginTop: 44 }} />

        <h2>Availability</h2>
        <p className="muted" style={{ marginTop: 12, marginBottom: 24 }}>The one thing you control directly. The engine counts the score, you count the time.</p>
        <div className="panel" style={{ maxWidth: 460 }}>
          <AvailabilityForm
            status={row.availabilityStatus}
            hours={profile.weeklyCapacityHours}
           
          />
        </div>

        <div className="divider" style={{ marginTop: 44 }} />

        <h2>Quality metrics</h2>
        <p className="muted" style={{ marginTop: 12 }}>Calculated from the events on your tickets. Neither the bureau nor the client can adjust them: there is no field for a rating in the system.</p>

        {metrics ? (
          <div className="grid grid-2" style={{ marginTop: 28 }}>
            <Metric
              name="SLA compliance"
              value={`${Math.round(metrics.slaCompliance * 100)}%`}
              fill={metrics.slaCompliance}
              note={fill('{onTime} of {delivered} on time', {
                onTime: profile.delivery.onTimeTickets,
                delivered: metrics.delivered,
              })}
            />
            <Metric
              name="First Time Right"
              value={`${Math.round(metrics.firstTimeRight * 100)}%`}
              fill={metrics.firstTimeRight}
              note={fill('{count} accepted first time', {
                count: profile.delivery.firstTimeRightTickets,
              })}
            />
            <Metric
              name="Response Time"
              value={fill('{hours} h', { hours: metrics.responseHours.toFixed(1) })}
              fill={Math.max(0, 1 - metrics.responseHours / 48)}
              note={'to the first substantive reply'}
            />
            <Metric
              name="Revision Rate"
              value={metrics.revisionRate.toFixed(2)}
              fill={Math.max(0, 1 - metrics.revisionRate / 3)}
              note={'revision rounds per ticket'}
            />
          </div>
        ) : (
          <div className="panel" style={{ marginTop: 24 }}>
            <p className="muted" style={{ margin: 0 }}>You have no closed tickets yet, so your Quality is your portfolio rating. Once a history appears it starts displacing the portfolio: up to 60% of the weight.</p>
          </div>
        )}

        <div className="divider" style={{ marginTop: 44 }} />

        <h2>What the engine knows about you</h2>
        <div className="grid grid-2" style={{ marginTop: 24 }}>
          <Row
            label={'Disciplines'}
            value={profile.disciplines
              .map((d) => DISCIPLINE_LABELS[d as Discipline])
              .join(', ')}
          />
          <Row
            label={'Specialisation'}
            value={profile.specializations
              .map((x) => SPECIALIZATION_LABELS[x as Specialization])
              .join(', ')}
          />
          <Row
            label={'Jurisdictions'}
            value={profile.jurisdictions
              .map((j) => JURISDICTION_NAMES[j as Jurisdiction])
              .join(', ')}
          />
          <Row
            label={'Signing rights'}
            value={
              profile.signsIn.length > 0
                ? profile.signsIn.map((j) => JURISDICTION_NAMES[j as Jurisdiction]).join(', ')
                : 'none'
            }
          />
          <Row label={'Maximum storeys'} value={String(profile.maxStoreys)} />
          <Row label={'Software'} value={profile.software.join(', ')} />
          <Row label={'IFC exchange'} value={profile.ifcLevel} />
          <Row label={'Access key'} value={row.accessKey} mono />
          <Row label={'UTC offset'} value={String(profile.utcOffset)} mono />
        </div>

        <p className="hint" style={{ marginTop: 28 }}>These fields are changed through the bureau: they enter selection, and editing them yourself, around the review, would mean editing your own score.</p>
      </div>
    </section>
  )
}

function Stat({
  value,
  label,
  note,
  accent,
}: {
  value: string
  label: string
  note: string
  accent?: boolean
}) {
  return (
    <div style={{ borderTop: '1px solid var(--border-strong)', paddingTop: 14 }}>
      <div className="num" style={{ fontSize: '2.2rem', color: accent ? 'var(--accent)' : 'var(--text)' }}>
        {value}
      </div>
      <div className="label">{label}</div>
      <div className="dim" style={{ fontSize: '0.82rem', marginTop: 6 }}>
        {note}
      </div>
    </div>
  )
}

function Metric({
  name,
  value,
  fill,
  note,
}: {
  name: string
  value: string
  fill: number
  note: string
}) {
  return (
    <div className="panel">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="label label-accent">{name}</span>
        <span className="num">{value}</span>
      </div>
      <div className="bar" style={{ marginTop: 12 }}>
        <span style={{ width: `${Math.min(100, Math.max(0, fill * 100))}%` }} />
      </div>
      <div className="dim" style={{ fontSize: '0.82rem', marginTop: 10 }}>
        {note}
      </div>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
      <div className="label">{label}</div>
      <div className={mono ? 'num' : ''} style={{ marginTop: 4 }}>
        {value || '—'}
      </div>
    </div>
  )
}
