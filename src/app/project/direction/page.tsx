import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { directionsOf } from '@/lib/services/direction'
import { currentProjectId } from '@/lib/session'
import { DirectionPicker } from './DirectionPicker'

export const metadata = { title: 'Направление проекта — TinyArc Cloud Bureau' }

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
        <span className="eyebrow">Направление</span>
        <h1 style={{ maxWidth: '20ch' }}>Как здание относится к участку</h1>

        <p className="lead" style={{ marginTop: 22, maxWidth: '58ch' }}>
          Варианты выведены из вашего брифа: типологии, рельефа и материальной системы.
          Неприменимого здесь нет — например, террасирование появляется только на склоне.
        </p>

        <p className="note" style={{ marginTop: 22 }}>
          Это не проект и не обещание. Выбор фиксирует направление, в котором команде
          двигаться, и ничего не определяет по конструкциям, площадям и нормам. Команда может
          показать, что выбранное на этом участке невозможно, — это нормальный ход работы, а
          не нарушение договорённости.
        </p>

        {issued === '1' && (
          <div className="panel panel-accent" style={{ marginTop: 28 }}>
            <div className="label label-accent">Ключ доступа</div>
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
            <div className="label">Направлений нет</div>
            <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
              {project.status === 'rejected'
                ? 'Проект вне продуктовой границы — выбирать облик нечему.'
                : 'Варианты ещё не подготовлены.'}
            </p>
            <p style={{ marginTop: 16, marginBottom: 0 }}>
              <Link href="/project">В кабинет проекта →</Link>
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
          Пропустить и перейти в кабинет — направление можно выбрать позже
        </Link>
      </div>
    </section>
  )
}
