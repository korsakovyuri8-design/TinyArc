import Link from 'next/link'
import { redirect } from 'next/navigation'
import { DISCIPLINE_LABELS, DOC_STAGE_LABELS, TICKET_STATUS_LABELS } from '@/lib/labels'
import type { Discipline, DocStage } from '@/engine/taxonomy'
import { ticketsOf } from '@/lib/services/relay'
import { currentSpecialist } from '@/lib/session'

export const metadata = { title: 'Мои задачи — TinyArc Cloud Bureau' }

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
      ? 'Вы вышли из проекта. Роль передана следующему по рангу из того же прогона, ваши незакрытые задачи по нему перешли к нему же.'
      : left === 'orphaned'
        ? 'Вы вышли из проекта. Замены в прогоне не нашлось — роль вернулась бюро, и оно ищет исполнителя.'
        : null

  // Канбан: ждёт гейта → открыт → в работе → сдано.
  const columns: { title: string; note: string; tickets: Ticket[] }[] = [
    {
      title: 'Ждёт гейта',
      note: 'Зависимости ещё не приняты',
      tickets: tickets.filter((t) => t.status === 'blocked'),
    },
    {
      title: 'К взятию',
      note: 'Открыт, но не взят в работу',
      tickets: tickets.filter((t) => t.status === 'open'),
    },
    {
      title: 'В работе',
      note: 'Взят или вернулся на круг',
      tickets: tickets.filter((t) => t.status === 'in_progress' || t.status === 'revision'),
    },
    {
      title: 'Сдано',
      note: 'Предъявлено или принято',
      tickets: tickets.filter((t) => t.status === 'submitted' || t.status === 'accepted'),
    },
  ]

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

        {leftNotice && (
          <div className="panel panel-accent" style={{ marginTop: 28 }}>
            <div className="label label-accent">Выход оформлен</div>
            <p className="muted" style={{ marginTop: 12, marginBottom: 12 }}>
              {leftNotice}
            </p>
            <p className="hint" style={{ margin: 0 }}>
              На балл это не влияет: выход не считается ошибкой и в отбор не входит. Но если
              вы вышли из-за загрузки, поправьте свободную ёмкость —{' '}
              <Link href="/work/profile">в профиле</Link>. Отбор считает по ней, и заявленные
              часы, которых нет, приведут к тому же ещё раз.
            </p>
          </div>
        )}

        {tickets.length === 0 ? (
          <div className="panel" style={{ marginTop: 40 }}>
            <div className="label">Задач пока нет</div>
            {/*
              Причина названа там, где человек её ищет. Пустая доска без
              объяснения читается как «меня не выбирают», то есть как приговор
              профессии; если дело в доступе, надо сказать про доступ — иначе
              человек будет переделывать портфолио, а мешает не оно.
            */}
            {specialist.subscription === 'none' ? (
              <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
                Задач не будет, пока закрыт доступ к проектам: без него движок вас не
                рассматривает. Это про доступ, а не про качество вашей работы — ни портфолио, ни
                метрики здесь ни при чём. Что делать — написано в профиле.
              </p>
            ) : (
              <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
                Тикеты появляются, когда движок ставит вас в команду проекта. Откликаться никуда
                не нужно — отбор идёт без вашего участия.
              </p>
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
                      Пусто.
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

function Card({ ticket }: { ticket: Ticket }) {
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
            Ждёт: {ticket.waitingOn.map((d) => DISCIPLINE_LABELS[d as Discipline]).join(', ')}
          </>
        )}
        {ticket.dueAt && ticket.status !== 'accepted' && (
          <>
            <br />
            Срок: {ticket.dueAt.toLocaleString('ru-RU')}
          </>
        )}
      </div>

      <div className="row" style={{ marginTop: 12, gap: 8 }}>
        <span className={`tag ${ticket.status === 'accepted' ? 'tag-pass' : ''}`}>
          {TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}
        </span>
        {ticket.conflictRaisedAt && <span className="tag tag-fail">конфликт</span>}
        {overdue && !ticket.conflictRaisedAt && <span className="tag tag-wait">просрочен</span>}
      </div>
    </Link>
  )
}
