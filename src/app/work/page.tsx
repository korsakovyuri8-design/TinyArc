import Link from 'next/link'
import { redirect } from 'next/navigation'
import { DISCIPLINE_LABELS, DOC_STAGE_LABELS, TICKET_STATUS_LABELS } from '@/lib/labels'
import type { Discipline, DocStage } from '@/engine/taxonomy'
import { ticketsOf } from '@/lib/services/relay'
import { currentSpecialist } from '@/lib/session'

export const metadata = { title: 'Мои задачи — TinyArc Cloud Bureau' }

export default async function WorkPage() {
  const specialist = await currentSpecialist()
  if (!specialist) redirect('/enter')

  const tickets = await ticketsOf(specialist.id)
  const open = tickets.filter((t) => t.status === 'open' || t.status === 'revision')
  const waiting = tickets.filter((t) => t.status === 'blocked')
  const done = tickets.filter((t) => t.status === 'submitted' || t.status === 'accepted')

  return (
    <section style={{ paddingTop: 'clamp(40px, 7vw, 72px)' }}>
      <div className="shell">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <span className="eyebrow">Доска работ</span>
            <h1>{specialist.displayName}</h1>
          </div>
          <Link href="/work/profile" className="btn btn-quiet">
            Профиль и метрики
          </Link>
        </div>

        {tickets.length === 0 ? (
          <div className="panel" style={{ marginTop: 40 }}>
            <div className="label">Задач пока нет</div>
            <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
              Тикеты появляются, когда движок ставит вас в команду проекта. Откликаться никуда не
              нужно — отбор идёт без вашего участия.
            </p>
          </div>
        ) : (
          <>
            <Group title="В работе" tickets={open} empty="Сейчас открытых тикетов нет." />
            <Group
              title="Ждут зависимости"
              tickets={waiting}
              empty="Ничего не заблокировано."
              muted
            />
            <Group title="Предъявлено и принято" tickets={done} empty="Пока ничего." muted />
          </>
        )}
      </div>
    </section>
  )
}

type Ticket = Awaited<ReturnType<typeof ticketsOf>>[number]

function Group({
  title,
  tickets,
  empty,
  muted,
}: {
  title: string
  tickets: Ticket[]
  empty: string
  muted?: boolean
}) {
  return (
    <div style={{ marginTop: 44 }}>
      <div className="label label-accent">{title}</div>

      {tickets.length === 0 ? (
        <p className="dim" style={{ marginTop: 12 }}>
          {empty}
        </p>
      ) : (
        <div className="grid grid-2" style={{ marginTop: 18 }}>
          {tickets.map((ticket) => (
            <Link
              key={ticket.id}
              href={`/work/${ticket.id}`}
              className="panel"
              style={{
                borderBottom: '1px solid var(--border)',
                opacity: muted ? 0.75 : 1,
                display: 'block',
                color: 'var(--text)',
              }}
            >
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="label">
                  {DOC_STAGE_LABELS[ticket.stage as DocStage]} ·{' '}
                  {DISCIPLINE_LABELS[ticket.discipline as Discipline]}
                </span>
                <span className="tag">{TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}</span>
              </div>

              <h3 style={{ marginTop: 12 }}>{ticket.title}</h3>
              <p className="dim" style={{ marginTop: 8, marginBottom: 0, fontSize: '0.85rem' }}>
                {ticket.project.title}
                {ticket.waitingOn.length > 0 && (
                  <>
                    <br />
                    Ждёт: {ticket.waitingOn.map((d) => DISCIPLINE_LABELS[d as Discipline]).join(', ')}
                  </>
                )}
                {ticket.dueAt && ticket.status !== 'accepted' && (
                  <>
                    <br />
                    Срок: {ticket.dueAt.toLocaleDateString('ru-RU')}
                  </>
                )}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
