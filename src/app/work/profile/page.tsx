import Link from 'next/link'
import { localeHref } from '@/lib/i18n/redirect'
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

export const metadata = { title: 'Профиль и метрики — TinyArc Cloud Bureau' }

export default async function ProfilePage() {
  const row = await currentSpecialist()
  if (!row) redirect(await localeHref('/enter'))

  // Приглашённому здесь нечего делать: ни задач, ни метрик у него ещё нет, а
  // нужен от него профиль. Ведём туда, а не показываем пустой экран.
  if (row.status === 'invited') redirect(await localeHref('/work/profile/complete'))

  const profile = toProfile(row)
  const metrics = deliveryMetrics(profile.delivery)
  const delivery = deliveryScore(metrics)
  const weight = historyWeight(profile.delivery)

  // Адрес бюро из настроек. Пока его нет — отвечать на письмо с ключом:
  // «напишите бюро» без адреса не действие, а отписка.
  const bureauEmail = company().email || 'адрес бюро — ответом на письмо с ключом доступа'

  return (
    <section style={{ paddingTop: 'clamp(40px, 7vw, 72px)' }}>
      <div className="shell" style={{ maxWidth: 900 }}>
        <Link href="/work" className="label">
          ← к доске работ
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
            label="портфолио"
            note={`порог ${PORTFOLIO_THRESHOLD}/10`}
            accent={profile.portfolioRating >= PORTFOLIO_THRESHOLD}
          />
          <Stat
            value={metrics ? delivery.toFixed(1) : '—'}
            label="балл поставки"
            note={metrics ? `вес в Quality — ${Math.round(weight * 100)}%` : 'истории пока нет'}
          />
          <Stat
            value={String(profile.weeklyCapacityHours)}
            label="ч/нед свободно"
            note={
              profile.weeklyCapacityHours === 0
                ? 'при нуле вас нет в выборке'
                : `${AVAILABILITY_LABELS[row.availabilityStatus] ?? row.availabilityStatus}, выход за ${profile.leadTimeDays} дн.`
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
            <div className="label">Доступ к проектам</div>
            <span className={profile.subscription === 'none' ? 'tag tag-fail' : 'tag'}>
              {SUBSCRIPTION_LABELS[profile.subscription]}
            </span>
          </div>

          {profile.subscription === 'none' ? (
            <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
              Пока доступ закрыт, движок вас не рассматривает — независимо от портфолио и
              метрик. Это про оплату доступа, а не про качество вашей работы: отказ по деньгам
              и отказ по квалификации — разные вещи, и мы их не смешиваем. Чтобы открыть,
              напишите на {bureauEmail}.
            </p>
          ) : (
            <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
              Доступ открыт: вы участвуете в отборе на общих основаниях. Платит сторона
              предложения за доступ к спросу — с вашего гонорара бюро комиссию не берёт.
            </p>
          )}
        </div>

        <div className="divider" style={{ marginTop: 44 }} />

        <h2>Доступность</h2>
        <p className="muted" style={{ marginTop: 12, marginBottom: 24 }}>
          Единственное, чем вы управляете напрямую. Балл считает движок, время считаете вы.
        </p>
        <div className="panel" style={{ maxWidth: 460 }}>
          <AvailabilityForm
            status={row.availabilityStatus}
            hours={profile.weeklyCapacityHours}
          />
        </div>

        <div className="divider" style={{ marginTop: 44 }} />

        <h2>Метрики качества</h2>
        <p className="muted" style={{ marginTop: 12 }}>
          Считаются из событий ваших тикетов. Ни бюро, ни клиент не могут их поправить: поля для
          оценки в системе нет.
        </p>

        {metrics ? (
          <div className="grid grid-2" style={{ marginTop: 28 }}>
            <Metric
              name="SLA compliance"
              value={`${Math.round(metrics.slaCompliance * 100)}%`}
              fill={metrics.slaCompliance}
              note={`${profile.delivery.onTimeTickets} из ${metrics.delivered} в срок`}
            />
            <Metric
              name="First Time Right"
              value={`${Math.round(metrics.firstTimeRight * 100)}%`}
              fill={metrics.firstTimeRight}
              note={`${profile.delivery.firstTimeRightTickets} принято с первого раза`}
            />
            <Metric
              name="Response Time"
              value={`${metrics.responseHours.toFixed(1)} ч`}
              fill={Math.max(0, 1 - metrics.responseHours / 48)}
              note="до первого содержательного ответа"
            />
            <Metric
              name="Revision Rate"
              value={metrics.revisionRate.toFixed(2)}
              fill={Math.max(0, 1 - metrics.revisionRate / 3)}
              note="кругов правок на тикет"
            />
          </div>
        ) : (
          <div className="panel" style={{ marginTop: 24 }}>
            <p className="muted" style={{ margin: 0 }}>
              Закрытых тикетов пока нет, поэтому Quality у вас — это рейтинг портфолио. Как
              только появится история, она начнёт вытеснять портфолио: до 60% веса.
            </p>
          </div>
        )}

        <div className="divider" style={{ marginTop: 44 }} />

        <h2>Что о вас знает движок</h2>
        <div className="grid grid-2" style={{ marginTop: 24 }}>
          <Row label="Дисциплины" value={profile.disciplines.map((d) => DISCIPLINE_LABELS[d as Discipline]).join(', ')} />
          <Row
            label="Специализация"
            value={profile.specializations
              .map((x) => SPECIALIZATION_LABELS[x as Specialization])
              .join(', ')}
          />
          <Row label="Юрисдикции" value={profile.jurisdictions.map((j) => JURISDICTION_NAMES[j as Jurisdiction]).join(', ')} />
          <Row
            label="Право подписи"
            value={
              profile.signsIn.length > 0
                ? profile.signsIn.map((j) => JURISDICTION_NAMES[j as Jurisdiction]).join(', ')
                : 'нет'
            }
          />
          <Row label="Максимальная этажность" value={String(profile.maxStoreys)} />
          <Row label="Софт" value={profile.software.join(', ')} />
          <Row label="Обмен по IFC" value={profile.ifcLevel} />
          <Row label="Ключ доступа" value={row.accessKey} mono />
          <Row label="Смещение от UTC" value={String(profile.utcOffset)} mono />
        </div>

        <p className="hint" style={{ marginTop: 28 }}>
          Изменить эти поля можно через бюро: они входят в отбор, и править их самому в обход
          разбора — значит править собственный балл.
        </p>
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
