import Link from 'next/link'
import { redirect } from 'next/navigation'
import { deliveryMetrics } from '@/engine/metrics'
import { PORTFOLIO_THRESHOLD, type Discipline } from '@/engine/taxonomy'
import { prisma } from '@/lib/db'
import { DISCIPLINE_LABELS, SPECIALIST_STATUS_LABELS } from '@/lib/labels'
import { toProfile } from '@/lib/rows'
import { isOperator } from '@/lib/session'

export const metadata = { title: 'Пул — панель бюро' }

export default async function PoolPage() {
  if (!(await isOperator())) redirect('/ops')

  const rows = await prisma.specialist.findMany({
    where: { status: { in: ['active', 'paused', 'rejected'] } },
    orderBy: [{ status: 'asc' }, { portfolioRating: 'desc' }],
  })

  const active = rows.filter((r) => r.status === 'active')

  // Ликвидность пула: без покрытия по дисциплинам мэтчинг не имеет смысла (п.21).
  const coverage = new Map<string, number>()
  for (const row of active) {
    for (const discipline of toProfile(row).disciplines) {
      coverage.set(discipline, (coverage.get(discipline) ?? 0) + 1)
    }
  }

  return (
    <section style={{ paddingTop: 'clamp(40px, 7vw, 72px)' }}>
      <div className="shell">
        <Link href="/ops" className="label">
          ← панель
        </Link>
        <h1 style={{ marginTop: 18 }}>Пул</h1>

        <div className="panel" style={{ marginTop: 32 }}>
          <div className="label label-accent">Покрытие по дисциплинам</div>
          <div className="row" style={{ marginTop: 16, gap: 10 }}>
            {(Object.keys(DISCIPLINE_LABELS) as Discipline[]).map((d) => {
              const count = coverage.get(d) ?? 0
              return (
                <span key={d} className={count === 0 ? 'tag tag-fail' : 'tag'}>
                  {DISCIPLINE_LABELS[d]} · {count}
                </span>
              )
            })}
          </div>
          <p className="hint" style={{ marginTop: 14 }}>
            Ноль в дисциплине означает, что любой проект, которому она нужна, соберётся неполным.
          </p>
        </div>

        <div className="table-scroll panel" style={{ marginTop: 32, padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Специалист</th>
                <th>Дисциплины</th>
                <th>Портфолио</th>
                <th>Сдано</th>
                <th>В срок</th>
                <th>С первого раза</th>
                <th>Ёмкость</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const profile = toProfile(row)
                const metrics = deliveryMetrics(profile.delivery)

                return (
                  <tr key={row.id}>
                    <td>{profile.displayName}</td>
                    <td className="dim">
                      {profile.disciplines.map((d) => DISCIPLINE_LABELS[d as Discipline]).join(', ')}
                    </td>
                    <td
                      className="num"
                      style={{
                        color:
                          profile.portfolioRating >= PORTFOLIO_THRESHOLD
                            ? 'var(--accent)'
                            : 'var(--text-dim)',
                      }}
                    >
                      {profile.portfolioRating.toFixed(1)}
                    </td>
                    <td className="num dim">{profile.delivery.deliveredTickets}</td>
                    <td className="num dim">
                      {metrics ? `${Math.round(metrics.slaCompliance * 100)}%` : '—'}
                    </td>
                    <td className="num dim">
                      {metrics ? `${Math.round(metrics.firstTimeRight * 100)}%` : '—'}
                    </td>
                    <td className="num dim">{profile.weeklyCapacityHours} ч</td>
                    <td>
                      <span className={`tag ${row.status === 'active' ? 'tag-pass' : ''}`}>
                        {SPECIALIST_STATUS_LABELS[row.status] ?? row.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
