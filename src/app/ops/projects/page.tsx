import Link from 'next/link'
import { redirect } from 'next/navigation'
import { JURISDICTION_NAMES, type Jurisdiction, type Typology } from '@/engine/taxonomy'
import { prisma } from '@/lib/db'
import { PROJECT_STATUS_LABELS, TYPOLOGY_LABELS } from '@/lib/labels'
import { isOperator } from '@/lib/session'

export const metadata = { title: 'Projects — bureau panel' }

export default async function ProjectsPage() {
  if (!(await isOperator())) redirect('/ops')

  const projects = await prisma.project.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { tickets: true } },
      tickets: { where: { status: 'submitted' }, select: { id: true } },
    },
  })

  return (
    <section style={{ paddingTop: 'clamp(40px, 7vw, 72px)' }}>
      <div className="shell">
        <Link href="/ops" className="label">
          ← panel
        </Link>
        <h1 style={{ marginTop: 18 }}>Projects</h1>

        {projects.length === 0 ? (
          <p className="dim" style={{ marginTop: 36 }}>
            No briefs yet.
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
