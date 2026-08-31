import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  JURISDICTIONS,
  JURISDICTION_NAMES,
  type Jurisdiction,
  type Typology,
} from '@/engine/taxonomy'
import { fill } from '@/lib/fill'
import { prisma } from '@/lib/db'
import { PROJECT_STATUS_LABELS, TYPOLOGY_LABELS } from '@/lib/labels'
import { isOperator } from '@/lib/session'

export const metadata = { title: 'Projects — bureau panel' }

/** Статусы проекта, по которым имеет смысл сужать. */
const STATUSES = ['draft', 'assembled', 'delivering', 'delivered', 'rejected'] as const

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (!(await isOperator())) redirect('/ops')

  const params = await searchParams
  const one = (key: string): string => {
    const value = params[key]
    return (Array.isArray(value) ? value[0] : value)?.trim() ?? ''
  }

  const query = one('q')
  const status = STATUSES.includes(one('status') as never) ? one('status') : ''
  const country = JURISDICTIONS.includes(one('country') as never) ? one('country') : ''
  const narrowed = Boolean(query || status || country)

  const all = await prisma.project.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { tickets: true } },
      tickets: { where: { status: 'submitted' }, select: { id: true } },
    },
  })

  /*
   * Условия применяются в памяти, а не запросом. Причина одна и она не в
   * лени: `contains` у prisma на SQLite и на Postgres смотрит на регистр
   * по-разному, и поиск вёл бы себя на стенде не так, как в бою. Расхождение
   * между разработкой и боем дороже лишнего прохода по списку, у которого
   * верхняя граница — проекты одного бюро.
   */
  const needle = query.toLowerCase()
  const projects = all.filter((project) => {
    if (status && project.status !== status) return false
    if (country && project.jurisdiction !== country) return false
    if (!needle) return true

    // Ключ заказчика ищется наравне с именем: с ним оператор приходит из
    // письма или из разговора, где больше не за что зацепиться.
    return `${project.title} ${project.clientName} ${project.clientEmail} ${project.clientKey}`
      .toLowerCase()
      .includes(needle)
  })

  return (
    <section style={{ paddingTop: 'clamp(40px, 7vw, 72px)' }}>
      <div className="shell">
        <Link href="/ops" className="label">
          ← panel
        </Link>
        <h1 style={{ marginTop: 18 }}>Projects</h1>

        <form method="get" className="panel" style={{ marginTop: 24 }}>
          <div className="grid grid-2" style={{ gap: 16 }}>
            <div className="field">
              <label htmlFor="q">Project, client or key</label>
              <input id="q" name="q" defaultValue={query} placeholder="Tivat" />
            </div>

            <div className="field">
              <label htmlFor="status">Status</label>
              <select id="status" name="status" defaultValue={status}>
                <option value="">Any</option>
                {STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {PROJECT_STATUS_LABELS[value] ?? value}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="country">Country</label>
              <select id="country" name="country" defaultValue={country}>
                <option value="">Any</option>
                {JURISDICTIONS.map((value) => (
                  <option key={value} value={value}>
                    {JURISDICTION_NAMES[value]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="row" style={{ gap: 12, marginTop: 16 }}>
            <button type="submit" className="btn btn-solid">
              Find
            </button>
            {narrowed && (
              <Link href="/ops/projects" className="btn btn-quiet">
                Clear
              </Link>
            )}
          </div>

          <p className="hint" style={{ marginTop: 14, marginBottom: 0 }}>
            {projects.length === all.length
              ? fill('{total} projects.', { total: all.length })
              : fill('{shown} of {total} match.', { shown: projects.length, total: all.length })}{' '}
            The client’s key is searched too — it is what you have when they write in.
          </p>
        </form>

        {all.length === 0 ? (
          <p className="dim" style={{ marginTop: 36 }}>
            No briefs yet.
          </p>
        ) : projects.length === 0 ? (
          <p className="dim" style={{ marginTop: 36 }}>
            Nothing matches. There are projects — these conditions are the empty part.
          </p>
        ) : (
          <div className="table-scroll panel" style={{ marginTop: 32, padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Typology</th>
                  <th>Country</th>
                  <th>Tickets</th>
                  <th>Await acceptance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id}>
                    <td>
                      <Link href={`/ops/projects/${project.id}`}>{project.title}</Link>
                      <br />
                      <span className="dim" style={{ fontSize: '0.8rem' }}>
                        {project.clientName}
                      </span>
                    </td>
                    <td className="dim">{TYPOLOGY_LABELS[project.typology as Typology]}</td>
                    <td className="dim">{JURISDICTION_NAMES[project.jurisdiction as Jurisdiction]}</td>
                    <td className="num dim">{project._count.tickets}</td>
                    <td className="num" style={{ color: project.tickets.length > 0 ? 'var(--accent)' : undefined }}>
                      {project.tickets.length}
                    </td>
                    <td>
                      <span className="tag">
                        {PROJECT_STATUS_LABELS[project.status] ?? project.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
