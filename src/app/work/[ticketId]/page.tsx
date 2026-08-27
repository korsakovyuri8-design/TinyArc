import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { teammateRoles } from '@/engine/relay'
import type { Discipline, DocStage } from '@/engine/taxonomy'
import { prisma } from '@/lib/db'
import { DISCIPLINE_LABELS, DOC_STAGE_LABELS, TICKET_STATUS_LABELS } from '@/lib/labels'
import { currentSpecialist } from '@/lib/session'
import { CommentForm, SubmitWork } from './TicketActions'

export const metadata = { title: 'Тикет — TinyArc Cloud Bureau' }

export default async function TicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params
  const specialist = await currentSpecialist()
  if (!specialist) redirect('/enter')

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      project: { select: { id: true, title: true } },
      comments: { orderBy: { createdAt: 'asc' }, include: { specialist: { select: { id: true } } } },
      dependsOn: { include: { prerequisite: { select: { discipline: true, status: true } } } },
    },
  })

  // Чужой тикет неотличим от несуществующего: знать, что он есть, тоже незачем.
  if (!ticket || ticket.specialistId !== specialist.id) notFound()

  const slots = await prisma.teamSlot.findMany({
    where: { projectId: ticket.projectId },
    select: { discipline: true, specialistId: true },
  })

  // Соседи по команде — роли, не люди (п.11).
  const roles = teammateRoles(
    slots.map((s) => ({ specialist: { id: s.specialistId }, discipline: s.discipline as Discipline })),
    specialist.id,
  )

  const blocked = ticket.status === 'blocked'
  const canSubmit = ticket.status === 'open' || ticket.status === 'revision'

  return (
    <section style={{ paddingTop: 'clamp(40px, 7vw, 72px)' }}>
      <div className="shell" style={{ maxWidth: 860 }}>
        <Link href="/work" className="label">
          ← к доске работ
        </Link>

        <div className="row" style={{ justifyContent: 'space-between', marginTop: 20 }}>
          <span className="label label-accent">
            {DOC_STAGE_LABELS[ticket.stage as DocStage]} ·{' '}
            {DISCIPLINE_LABELS[ticket.discipline as Discipline]}
          </span>
          <span className="tag">{TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}</span>
        </div>

        <h1 style={{ marginTop: 14, fontSize: 'clamp(1.8rem, 4vw, 2.6rem)' }}>{ticket.title}</h1>
        <p className="dim" style={{ marginTop: 10 }}>
          {ticket.project.title}
          {ticket.dueAt && ` · срок ${ticket.dueAt.toLocaleDateString('ru-RU')}`}
          {ticket.revisionRounds > 0 && ` · кругов правок: ${ticket.revisionRounds}`}
        </p>

        {blocked ? (
          <div className="panel" style={{ marginTop: 32 }}>
            <div className="label">Тикет ещё закрыт гейтом</div>
            <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
              Ждём приёмки:{' '}
              {ticket.dependsOn
                .filter((d) => d.prerequisite.status !== 'accepted')
                .map((d) => DISCIPLINE_LABELS[d.prerequisite.discipline as Discipline])
                .join(', ') || '—'}
              . Постановка и входные артефакты появятся здесь, когда тикет откроется.
            </p>
          </div>
        ) : (
          <>
            <div className="panel" style={{ marginTop: 32 }}>
              <div className="label">Постановка</div>
              <p style={{ marginTop: 12, marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                {ticket.spec || 'Бюро ещё не дописало постановку — задайте вопрос в комментарии.'}
              </p>
            </div>

            {roles.length > 0 && (
              <p className="hint" style={{ marginTop: 16 }}>
                Смежники на проекте: {roles.map((r) => DISCIPLINE_LABELS[r]).join(', ')}. Их
                контактов в системе нет — всё через бюро.
              </p>
            )}

            <div className="divider" />

            <div className="label label-accent">Комментарии</div>
            <div className="stack" style={{ marginTop: 16, gap: 16 }}>
              {ticket.comments.length === 0 && <p className="dim">Пока пусто.</p>}
              {ticket.comments.map((c) => (
                <div
                  key={c.id}
                  className="panel"
                  style={{
                    padding: 16,
                    borderLeft:
                      c.authorRole === 'bureau'
                        ? '2px solid var(--accent)'
                        : '2px solid var(--border-strong)',
                  }}
                >
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="label">{c.authorRole === 'bureau' ? 'Бюро' : 'Вы'}</span>
                    <span className="label">{c.createdAt.toLocaleDateString('ru-RU')}</span>
                  </div>
                  <p style={{ marginTop: 10, marginBottom: 0, whiteSpace: 'pre-wrap' }}>{c.body}</p>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 28 }}>
              <CommentForm ticketId={ticket.id} />
            </div>

            {canSubmit && (
              <>
                <div className="divider" />
                <SubmitWork ticketId={ticket.id} />
                <p className="hint" style={{ marginTop: 10 }}>
                  Приёмку делает бюро. Принято в срок и с первого раза — Quality растёт.
                </p>
              </>
            )}

            {ticket.status === 'submitted' && (
              <div className="note" style={{ marginTop: 28 }}>
                Работа предъявлена и ждёт приёмки бюро.
              </div>
            )}

            {ticket.status === 'accepted' && (
              <div className="note" style={{ marginTop: 28 }}>
                Тикет принят. Зависящие от него задачи гейт откроет сам.
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
