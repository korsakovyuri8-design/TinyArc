import Link from 'next/link'
import { redirect } from 'next/navigation'
import { DISCIPLINE_LABELS, DOC_STAGE_LABELS, TICKET_STATUS_LABELS } from '@/lib/labels'
import type { Discipline, DocStage } from '@/engine/taxonomy'
import { ticketsOf } from '@/lib/services/relay'
import { currentSpecialist } from '@/lib/session'
import { pageMetadata } from '@/lib/metadata'
import { dateTime } from '@/lib/format'

export const metadata = pageMetadata('My tasks')

type Ticket = Awaited<ReturnType<typeof ticketsOf>>[number]

export default async function WorkPage({
  searchParams,
}: {
  searchParams: Promise<{ left?: string }>
}) {
  const { left } = await searchParams

  const specialist = await currentSpecialist()
  if (!specialist) redirect('/enter')

  // Приглашённому здесь нечего делать: ни задач, ни метрик у него ещё нет, а
  // нужен от него профиль. Ведём туда, а не показываем пустой экран.
  if (specialist.status === 'invited') redirect('/work/profile/complete')

  const tickets = await ticketsOf(specialist.id)

  // Подтверждение выхода показывается здесь, а не на тикете: после выхода
  // тикет уже не его, и страница ушла бы из-под ног ошибкой доступа.
  const leftNotice =
    left === 'passed'
      ? 'You have left the project. The role went to the next by rank from the same run, and your open tasks on it went with the role.'
      : left === 'orphaned'
        ? 'You have left the project. No replacement was found in the run — the role went back to the bureau, which is looking for someone.'
        : null

  // Канбан: ждёт гейта → открыт → в работе → сдано.
  const columns: { title: string; note: string; tickets: Ticket[] }[] = [
    {
      title: 'Waiting on a gate',
      note: 'Its dependencies are not accepted yet',
      tickets: tickets.filter((ticket) => ticket.status === 'blocked'),
    },
    {
      title: 'To pick up',
      note: 'Open, not yet taken on',
      tickets: tickets.filter((ticket) => ticket.status === 'open'),
    },
    {
      title: 'In progress',
      note: 'Taken on, or back for another round',
      tickets: tickets.filter(
        (ticket) => ticket.status === 'in_progress' || ticket.status === 'revision',
      ),
    },
    {
      title: 'Submitted',
      note: 'Handed in or accepted',
      tickets: tickets.filter(
        (ticket) => ticket.status === 'submitted' || ticket.status === 'accepted',
      ),
    },
  ]

  return (
    <section style={{ paddingTop: 'clamp(40px, 7vw, 72px)' }}>
      <div className="shell">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <span className="eyebrow">Work board</span>
            <h1>{specialist.displayName}</h1>
          </div>
          <Link href="/work/profile" className="btn btn-quiet">
            Profile and metrics
          </Link>
        </div>

        {leftNotice && (
          <div className="panel panel-accent" style={{ marginTop: 28 }}>
            <div className="label label-accent">Your exit is recorded</div>
            <p className="muted" style={{ marginTop: 12, marginBottom: 12 }}>
              {leftNotice}
            </p>
            <p className="hint" style={{ margin: 0 }}>
              This does not touch your score: leaving is not counted as a failure and does not enter selection. But if you left because of workload, correct your free capacity —{' '}
              <Link href="/work/profile">in your profile</Link>.{' '}
              Selection counts on it, and declared hours you do not have will bring you here again.
            </p>
          </div>
        )}

        {tickets.length === 0 ? (
          <div className="panel" style={{ marginTop: 40 }}>
            <div className="label">No tasks yet</div>
            {/*
              Причина названа там, где человек её ищет. Пустая доска без
              объяснения читается как «меня не выбирают», то есть как приговор
              профессии; если дело в доступе, надо сказать про доступ — иначе
              человек будет переделывать портфолио, а мешает не оно.
            */}
            {specialist.subscription === 'none' ? (
              <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>There will be no tasks while access to projects is closed: without it the engine does not consider you. This is about access, not about the quality of your work — neither portfolio nor metrics come into it. What to do is written in your profile.</p>
            ) : (
              <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>Tickets appear when the engine puts you on a project team. There is nothing to apply to — selection runs without your involvement.</p>
            )}
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 20,
              marginTop: 40,
              alignItems: 'start',
            }}
          >
            {columns.map((column) => (
              <div key={column.title}>
                <div
                  className="row"
                  style={{
                    justifyContent: 'space-between',
                    borderBottom: '1px solid var(--border-strong)',
                    paddingBottom: 10,
                  }}
                >
                  <span className="label label-accent">{column.title}</span>
                  <span className="num dim">{column.tickets.length}</span>
                </div>
                <div className="label" style={{ marginTop: 8 }}>
                  {column.note}
                </div>

                <div className="stack" style={{ marginTop: 16, gap: 12 }}>
                  {column.tickets.length === 0 && (
                    <p className="dim" style={{ fontSize: '0.85rem' }}>
                      Empty.
                    </p>
                  )}
                  {column.tickets.map((ticket) => (
                    <Card key={ticket.id} ticket={ticket} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function Card({
  ticket,
}: {
  ticket: Ticket
}) {
  const overdue = ticket.dueAt && ticket.status !== 'accepted' && ticket.dueAt < new Date()

  return (
    <Link
     
      href={`/work/${ticket.id}`}
      className="panel"
      style={{
        display: 'block',
        color: 'var(--text)',
        padding: 16,
        borderColor: ticket.conflictRaisedAt
          ? 'var(--fail)'
          : overdue
            ? 'var(--wait)'
            : undefined,
      }}
    >
      <div className="label">
        {DOC_STAGE_LABELS[ticket.stage as DocStage]} ·{' '}
        {DISCIPLINE_LABELS[ticket.discipline as Discipline]}
      </div>

      <div style={{ marginTop: 10, fontSize: '0.95rem' }}>{ticket.title}</div>

      <div className="dim" style={{ marginTop: 8, fontSize: '0.8rem' }}>
        {ticket.project.title}
        {ticket.waitingOn.length > 0 && (
          <>
            <br />
            Waits for:{' '}
            {ticket.waitingOn.map((d) => DISCIPLINE_LABELS[d as Discipline]).join(', ')}
          </>
        )}
        {ticket.dueAt && ticket.status !== 'accepted' && (
          <>
            <br />
            Due: {dateTime(ticket.dueAt)}
          </>
        )}
      </div>

      <div className="row" style={{ marginTop: 12, gap: 8 }}>
        <span className={`tag ${ticket.status === 'accepted' ? 'tag-pass' : ''}`}>
          {TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}
        </span>
        {ticket.conflictRaisedAt && <span className="tag tag-fail">conflict</span>}
        {overdue && !ticket.conflictRaisedAt && (
          <span className="tag tag-wait">overdue</span>
        )}
      </div>
    </Link>
  )
}
