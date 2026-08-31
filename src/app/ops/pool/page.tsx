import Link from 'next/link'
import { redirect } from 'next/navigation'
import { deliveryMetrics } from '@/engine/metrics'
import {
  DISCIPLINES,
  JURISDICTIONS,
  JURISDICTION_NAMES,
  PORTFOLIO_THRESHOLD,
  type Discipline,
} from '@/engine/taxonomy'
import { MIN_DEPTH, coverage as poolCoverage, gaps, readiness } from '@/engine/readiness'
import { SPECIALIZATION_LABELS } from '@/lib/labels'
import { prisma } from '@/lib/db'
import { DISCIPLINE_LABELS, SPECIALIST_STATUS_LABELS } from '@/lib/labels'
import { toProfile } from '@/lib/rows'
import { fill } from '@/lib/fill'
import { isNarrowed, matches, readCriteria } from '@/lib/pool-filter'
import { isOperator } from '@/lib/session'

export const metadata = { title: 'Pool — bureau panel' }

/**
 * Статусы, которые видно в пуле. Заявка на разборе и приглашение, ещё не
 * принятое, живут в очереди заявок: там у них своё действие, а здесь они
 * были бы строками, с которыми нечего делать.
 */
const LISTED_STATUSES = ['active', 'paused', 'rejected'] as const

/**
 * Сколько строк рисуется за раз.
 *
 * Предел не про экономию, а про то, что страница обязана открыться. База бюро
 * растёт импортом, и на пяти тысячах человек таблица без предела отдавалась
 * две секунды — это уже не список, а документ, который надо ждать. Условия
 * выше сужают выборку до того, что читают глазами; всё остальное ищут ими же,
 * а не прокруткой на тысячу строк.
 */
const SHOWN = 200

export default async function PoolPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (!(await isOperator())) redirect('/ops')

  const rows = await prisma.specialist.findMany({
    where: { status: { in: [...LISTED_STATUSES] } },
    orderBy: [{ status: 'asc' }, { portfolioRating: 'desc' }],
  })

  // Условия — только к списку по именам. Покрытие и дыры считаются по всему
  // пулу: сужать их вместе с таблицей значило бы показывать дыру там, где её
  // закрывает человек, отфильтрованный из виду.
  const criteria = readCriteria(await searchParams, {
    disciplines: DISCIPLINES,
    jurisdictions: JURISDICTIONS,
    statuses: LISTED_STATUSES,
  })

  const listed = rows.filter((row) => {
    const profile = toProfile(row)
    return matches(
      {
        displayName: profile.displayName,
        email: row.email,
        status: row.status,
        disciplines: profile.disciplines,
        jurisdictions: profile.jurisdictions,
      },
      criteria,
    )
  })

  const active = rows.filter((r) => r.status === 'active')
  const pool = active.map(toProfile)

  // Ликвидность пула: без покрытия по дисциплинам мэтчинг не имеет смысла (п.21).
  const coverage = new Map<string, number>()
  for (const profile of pool) {
    for (const discipline of profile.disciplines) {
      coverage.set(discipline, (coverage.get(discipline) ?? 0) + 1)
    }
  }

  const depth = poolCoverage(pool)
  const holes = gaps(pool)
  const disciplines = [...new Set(depth.map((d) => d.discipline))]

  return (
    <section style={{ paddingTop: 'clamp(40px, 7vw, 72px)' }}>
      <div className="shell">
        <Link href="/ops" className="label">
          ← panel
        </Link>
        <h1 style={{ marginTop: 18 }}>Pool</h1>

        <div className="panel" style={{ marginTop: 32 }}>
          <div className="label label-accent">Coverage by discipline</div>
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
            A zero in a discipline means any project that needs it will assemble incomplete.
          </p>
        </div>

        <div className="divider" style={{ marginTop: 48 }} />

        <h2>What we can take on</h2>
        <p className="muted" style={{ marginTop: 12, marginBottom: 24, maxWidth: '62ch' }}>
          The share of project shapes inside the product boundary for which the pool can assemble a team. What is counted is capability, not workload: “everyone is busy today” is not “we cannot do this”. Without signing rights in a country the share is zero however many people there are — a documentation set without a signature has no legal force.
        </p>

        <div className="grid grid-3">
          {JURISDICTIONS.map((j) => {
            const share = readiness(pool, j)

            return (
              <div key={j} style={{ borderTop: '1px solid var(--border-strong)', paddingTop: 14 }}>
                <div
                  className="num"
                  style={{
                    fontSize: '2.2rem',
                    color: share === 0 ? 'var(--fail)' : share === 1 ? 'var(--accent)' : 'var(--text)',
                  }}
                >
                  {Math.round(share * 100)}%
                </div>
                <div className="label">{JURISDICTION_NAMES[j]}</div>
              </div>
            )
          })}
        </div>

        <div className="divider" style={{ marginTop: 48 }} />

        <h2>Depth by role and country</h2>
        <p className="muted" style={{ marginTop: 12, marginBottom: 24, maxWidth: '62ch' }}>
          In brackets — how many of them hold signing rights. Fewer than {MIN_DEPTH} people on a role is not coverage: the role rests on someone's holiday. Selection formally keeps working right up to the day the only suitable person is busy.
        </p>

        <div className="table-scroll panel" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Role</th>
                {JURISDICTIONS.map((j) => (
                  <th key={j}>{JURISDICTION_NAMES[j]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {disciplines.map((d) => (
                <tr key={d}>
                  <td>{DISCIPLINE_LABELS[d]}</td>
                  {JURISDICTIONS.map((j) => {
                    const cell = depth.find((c) => c.discipline === d && c.jurisdiction === j)
                    const value = cell?.depth ?? 0

                    return (
                      <td key={j} className="num">
                        <span
                          className={
                            value === 0 ? 'tag tag-fail' : value < MIN_DEPTH ? 'tag tag-wait' : 'tag'
                          }
                        >
                          {value} ({cell?.signatories ?? 0})
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="divider" style={{ marginTop: 48 }} />

        <h2>Who is missing</h2>

        {holes.length === 0 ? (
          <p className="dim" style={{ marginTop: 20 }}>
            No holes: every role in every country is covered by at least {MIN_DEPTH} people.
          </p>
        ) : (
          <>
            <p className="muted" style={{ marginTop: 12, marginBottom: 24, maxWidth: '62ch' }}>
              Sorted by the number of project shapes the hole covers. This is a hiring list, not a list of grievances: a gap is closed by a person, not by waiting.
            </p>

            <div className="table-scroll panel" style={{ padding: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Country</th>
                    <th>Role</th>
                    <th>Specialisation</th>
                    <th>Project shapes</th>
                    <th>Exactly what</th>
                  </tr>
                </thead>
                <tbody>
                  {holes.slice(0, 30).map((gap, i) => (
                    <tr key={`${gap.jurisdiction}-${gap.role.discipline}-${i}`}>
                      <td>{JURISDICTION_NAMES[gap.jurisdiction]}</td>
                      <td>{DISCIPLINE_LABELS[gap.role.discipline]}</td>
                      <td className="dim" style={{ fontSize: '0.85rem' }}>
                        {gap.role.specializations
                          .map((x) => SPECIALIZATION_LABELS[x])
                          .join(gap.role.mode === 'all' ? ' + ' : ' / ') || '—'}
                      </td>
                      <td className="num dim">{gap.shapes}</td>
                      <td>
                        <span className={gap.severity === 'none' ? 'tag tag-fail' : 'tag tag-wait'}>
                          {gap.severity === 'none' ? 'nobody at all' : 'rests on one person'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {holes.length > 30 && (
              <p className="hint" style={{ marginTop: 12 }}>
                Showing the first 30 of {holes.length}.
              </p>
            )}
          </>
        )}

        <div className="divider" style={{ marginTop: 48 }} />

        <h2>The pool by name</h2>

        {/*
          Обычный GET-запрос: условия видно в адресе, страницу можно послать
          ссылкой, и работает она без единой строки на клиенте.
        */}
        <form method="get" className="panel" style={{ marginTop: 24 }}>
          <div className="grid grid-2" style={{ gap: 16 }}>
            <div className="field">
              <label htmlFor="q">Name or address</label>
              <input id="q" name="q" defaultValue={criteria.query} placeholder="Popović" />
            </div>

            <div className="field">
              <label htmlFor="discipline">Discipline</label>
              <select id="discipline" name="discipline" defaultValue={criteria.discipline}>
                <option value="">Any</option>
                {DISCIPLINES.map((d) => (
                  <option key={d} value={d}>
                    {DISCIPLINE_LABELS[d]}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="country">Country</label>
              <select id="country" name="country" defaultValue={criteria.jurisdiction}>
                <option value="">Any</option>
                {JURISDICTIONS.map((j) => (
                  <option key={j} value={j}>
                    {JURISDICTION_NAMES[j]}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="status">Status</label>
              <select id="status" name="status" defaultValue={criteria.status}>
                <option value="">Any</option>
                {LISTED_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {SPECIALIST_STATUS_LABELS[s] ?? s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="row" style={{ gap: 12, marginTop: 16 }}>
            <button type="submit" className="btn btn-solid">
              Find
            </button>
            {isNarrowed(criteria) && (
              <Link href="/ops/pool" className="btn btn-quiet">
                Clear
              </Link>
            )}
          </div>

          <p className="hint" style={{ marginTop: 14, marginBottom: 0 }}>
            {listed.length === rows.length
              ? fill('{total} in the pool.', { total: rows.length })
              : fill('{shown} of {total} match.', { shown: listed.length, total: rows.length })}{' '}
            Country here means where a person works, not where they can sign — signing rights are on
            the profile.
          </p>
        </form>

        {listed.length === 0 ? (
          <p className="dim" style={{ marginTop: 32 }}>
            Nobody matches. The pool is not empty — these conditions are.
          </p>
        ) : (
        <div className="table-scroll panel" style={{ marginTop: 24, padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Specialist</th>
                <th>Disciplines</th>
                <th>Portfolio</th>
                <th>Delivered</th>
                <th>On time</th>
                <th>First time</th>
                <th>Capacity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {listed.slice(0, SHOWN).map((row) => {
                const profile = toProfile(row)
                const metrics = deliveryMetrics(profile.delivery)

                return (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/ops/pool/${row.id}`}>{profile.displayName}</Link>
                    </td>
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
                    <td className="num dim">{profile.weeklyCapacityHours} h</td>
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
        )}

        {listed.length > SHOWN && (
          <p className="hint" style={{ marginTop: 12 }}>
            {fill('The first {shown} of {total}. Narrow by the conditions above to see the rest.', {
              shown: SHOWN,
              total: listed.length,
            })}
          </p>
        )}
      </div>
    </section>
  )
}
