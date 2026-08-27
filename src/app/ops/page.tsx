import Link from 'next/link'
import { ALERT_LABELS, alertAudience } from '@/engine/pm'
import type { Discipline } from '@/engine/taxonomy'
import { prisma } from '@/lib/db'
import { DISCIPLINE_LABELS } from '@/lib/labels'
import { alertsForBureau } from '@/lib/services/pm'
import { isOperator } from '@/lib/session'
import { OpsSignIn } from './OpsForms'

export const metadata = { title: 'Панель бюро — TinyArc Cloud Bureau' }

export default async function OpsPage() {
  if (!(await isOperator())) {
    return (
      <section style={{ paddingTop: 'clamp(48px, 8vw, 96px)' }}>
        <div className="shell" style={{ maxWidth: 460 }}>
          <span className="eyebrow">Панель бюро</span>
          <h1>Вход</h1>
          <p className="muted" style={{ marginTop: 16 }}>
            Панель закрывает разбор заявок, постановку задач и приёмку. Права назначить
            специалиста в команду она не даёт никому — такого поля нет в схеме.
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

  const conflicts = alerts.filter((a) => a.kind === 'conflict')

  return (
    <section style={{ paddingTop: 'clamp(40px, 7vw, 72px)' }}>
      <div className="shell">
        <span className="eyebrow">Панель бюро</span>
        <h1>Что сейчас на столе</h1>

        <div className="grid grid-3" style={{ marginTop: 40 }}>
          <Tile value={pending} label="заявок на разборе" href="/ops/applications" accent={pending > 0} />
          <Tile value={active} label="в пуле" href="/ops/pool" />
          <Tile value={projects} label="проектов" href="/ops/projects" />
          <Tile value={submitted} label="ждут приёмки" href="/ops/projects" accent={submitted > 0} />
          <Tile value={openTickets} label="тикетов в работе" href="/ops/projects" />
        </div>

        <div className="divider" style={{ marginTop: 48 }} />

        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2>Цифровой менеджер</h2>
          {conflicts.length > 0 && (
            <span className="tag tag-fail">Conflict Detected · {conflicts.length}</span>
          )}
        </div>
        <p className="muted" style={{ marginTop: 12, marginBottom: 24 }}>
          Он следит и сигналит — не чертит и не считает нагрузки. Чертежи делают люди, которых
          подобрал алгоритм; задача менеджера — чтобы эстафета не вставала.
        </p>

        {alerts.length === 0 ? (
          <p className="dim">Тихо: сроки в порядке, всё взято в работу, приёмка не копится.</p>
        ) : (
          <div className="table-scroll panel" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Сигнал</th>
                  <th>Задача</th>
                  <th>Проект</th>
                  <th>Часов</th>
                  <th>Кому</th>
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
                      {alertAudience(alert.kind) === 'bureau' ? 'бюро' : 'специалисту'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="divider" style={{ marginTop: 48 }} />

        <div className="stack" style={{ gap: 10 }}>
          <Link href="/ops/applications">Заявки специалистов →</Link>
          <Link href="/ops/pool">Пул и метрики →</Link>
          <Link href="/ops/projects">Проекты и прогоны →</Link>
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
