import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { directionsOf } from '@/lib/services/direction'
import { currentProjectId } from '@/lib/session'
import { DirectionPicker } from './DirectionPicker'

export const metadata = { title: 'Project direction — TinyArc Cloud Bureau' }

export default async function DirectionPage({
  searchParams,
}: {
  searchParams: Promise<{ issued?: string }>
}) {
  const { issued } = await searchParams
  const projectId = await currentProjectId()
  if (!projectId) redirect('/enter')

  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) redirect('/enter')

  const directions = await directionsOf(projectId)

  return (
    <section style={{ paddingTop: 'clamp(40px, 7vw, 72px)' }}>
      <div className="shell">
        <span className="eyebrow">Direction</span>
        <h1 style={{ maxWidth: '20ch' }}>How the building relates to the site</h1>

        <p className="lead" style={{ marginTop: 22, maxWidth: '58ch' }}>
          The variants follow from your brief: typology, terrain and material system. Nothing inapplicable appears here — terracing, for instance, shows up only on a slope.
        </p>

        <p className="note" style={{ marginTop: 22 }}>
          This is neither a design nor a promise. The choice fixes the direction for the team to move in and settles nothing about structure, areas or codes. The team may show that what you chose is impossible on this site — that is the work going normally, not an agreement being broken.
        </p>

        {issued === '1' && (
          <div className="panel panel-accent" style={{ marginTop: 28 }}>
            <div className="label label-accent">Access key</div>
            <p className="num" style={{ fontSize: '1.3rem', color: 'var(--accent)', margin: '12px 0' }}>
              {project.clientKey}
            </p>
            <p className="muted" style={{ marginBottom: 0, fontSize: '0.9rem' }}>
              Сохраните: по нему вы вернётесь в кабинет с любого устройства. Копия ушла на{' '}
              {project.clientEmail}.
            </p>
          </div>
        )}

        {directions.length === 0 ? (
          <div className="panel" style={{ marginTop: 40 }}>
            <div className="label">No directions</div>
            <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
              {project.status === 'rejected'
                ? 'The project is outside the product boundary — there is nothing to choose a direction for.'
                : 'The variants are not prepared yet.'}
            </p>
            <p style={{ marginTop: 16, marginBottom: 0 }}>
              <Link href="/project">To the project cabinet →</Link>
            </p>
          </div>
        ) : (
          <div style={{ marginTop: 40 }}>
            <DirectionPicker
              directions={directions.map((d) => ({
                key: d.key,
                title: d.title,
                summary: d.summary,
                tradeoff: d.tradeoff,
                imageUrl: d.imageUrl,
                source: d.source,
                chosen: d.chosen,
              }))}
            />
          </div>
        )}

        <div className="divider" style={{ marginTop: 48 }} />
        <Link href="/project" className="dim">
          Skip and go to the cabinet — a direction can be chosen later
        </Link>
      </div>
    </section>
  )
}
