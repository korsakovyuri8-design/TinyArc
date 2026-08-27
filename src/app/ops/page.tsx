import Link from 'next/link'
import { prisma } from '@/lib/db'
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

  const [pending, active, projects, openTickets, submitted] = await Promise.all([
    prisma.specialist.count({ where: { status: 'pending' } }),
    prisma.specialist.count({ where: { status: 'active' } }),
    prisma.project.count(),
    prisma.ticket.count({ where: { status: 'open' } }),
    prisma.ticket.count({ where: { status: 'submitted' } }),
  ])

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
