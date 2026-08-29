import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { teammateRoles } from '@/engine/relay'
import type { Discipline, DocStage } from '@/engine/taxonomy'
import { artifactHref, isOurs } from '@/lib/artifacts'
import { prisma } from '@/lib/db'
import {
  ARTIFACT_KIND_LABELS,
  DISCIPLINE_LABELS,
  DOC_STAGE_LABELS,
  TICKET_STATUS_LABELS,
} from '@/lib/labels'
import { ChosenDirection } from '@/components/ChosenDirection'
import { chosenDirection } from '@/lib/services/direction'
import { inboundArtifacts } from '@/lib/services/relay'
import { currentSpecialist } from '@/lib/session'
import { pageMetadata } from '@/lib/metadata'
import { fill } from '@/lib/fill'
import { dateTime, date as formatDate } from '@/lib/format'
import {
  ArtifactForm,
  ClaimWork,
  CommentForm,
  ConflictForm,
  RenderForm,
  LeaveForm,
  RequestForm,
  SubmitWork,
} from './TicketActions'

export const metadata = pageMetadata('Ticket')

export default async function TicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params
  const specialist = await currentSpecialist()
  if (!specialist) redirect('/enter')

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      project: { select: { id: true, title: true } },
      comments: { orderBy: { createdAt: 'asc' } },
      artifacts: { orderBy: { createdAt: 'asc' } },
      dependsOn: { include: { prerequisite: { select: { discipline: true, status: true } } } },
      // Запросы, отправленные из этого тикета, и их состояние.
      requests: { select: { id: true, title: true, discipline: true, status: true } },
      requestedFrom: { select: { discipline: true } },
    },
  })

  // Чужой тикет неотличим от несуществующего: знать, что он есть, тоже незачем.
  if (!ticket || ticket.specialistId !== specialist.id) notFound()

  const [slots, inbound, direction] = await Promise.all([
    prisma.teamSlot.findMany({
      where: { projectId: ticket.projectId },
      select: { discipline: true, specialistId: true },
    }),
    inboundArtifacts(ticket.id),
    chosenDirection(ticket.projectId),
  ])

  // Соседи по команде — роли, не люди (п.11).
  const roles = teammateRoles(
    slots.map((s) => ({ specialist: { id: s.specialistId }, discipline: s.discipline as Discipline })),
    specialist.id,
  )

  const blocked = ticket.status === 'blocked'
  const canClaim = ticket.status === 'open'
  const canSubmit = ticket.status === 'in_progress' || ticket.status === 'revision'
  const working = canSubmit || ticket.status === 'submitted'

  return (
    <section style={{ paddingTop: 'clamp(40px, 7vw, 72px)' }}>
      <div className="shell" style={{ maxWidth: 860 }}>
        <Link href="/work" className="label">
          ← back to the work board
        </Link>

        <div className="row" style={{ justifyContent: 'space-between', marginTop: 20 }}>
          <span className="label label-accent">
            {DOC_STAGE_LABELS[ticket.stage as DocStage]} ·{' '}
            {DISCIPLINE_LABELS[ticket.discipline as Discipline]}
          </span>
          <span className="tag">{TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}</span>
        </div>

        {ticket.kind === 'request' && (
          <div className="row" style={{ marginTop: 12, gap: 10 }}>
            <span className="tag tag-accent">request from an adjacent discipline</span>
            {ticket.requestedFrom && (
              <span className="dim" style={{ fontSize: '0.85rem' }}>
                {fill('from “{discipline}”', {
                  discipline: DISCIPLINE_LABELS[ticket.requestedFrom.discipline as Discipline],
                })}
              </span>
            )}
          </div>
        )}

        <h1 style={{ marginTop: 14, fontSize: 'clamp(1.8rem, 4vw, 2.6rem)' }}>{ticket.title}</h1>
        <p className="dim" style={{ marginTop: 10 }}>
          {ticket.project.title} · {fill('{hours} h to deliver', { hours: ticket.slaHours })}
          {ticket.dueAt && ` · ${fill('due {due}', { due: dateTime(ticket.dueAt) })}`}
          {ticket.revisionRounds > 0 &&
            ` · ${fill('revision rounds: {rounds}', { rounds: ticket.revisionRounds })}`}
        </p>

        {ticket.conflictRaisedAt && (
          <div className="panel" style={{ marginTop: 24, borderColor: 'var(--fail)' }}>
            <div className="label" style={{ color: 'var(--fail)' }}>
              The conflict went to the arbiter
            </div>
            <p style={{ marginTop: 10, marginBottom: 0 }}>{ticket.conflictNote}</p>
            <p className="hint" style={{ marginTop: 10 }}>
              Work on the ticket is on hold until the bureau rules.
            </p>
          </div>
        )}

        {blocked ? (
          <div className="panel" style={{ marginTop: 32 }}>
            <div className="label">The ticket is still closed by a gate</div>
            <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
              Waiting on acceptance of:{' '}
              {ticket.dependsOn
                .filter((d) => d.prerequisite.status !== 'accepted')
                .map((d) => DISCIPLINE_LABELS[d.prerequisite.discipline as Discipline])
                .join(', ') || '—'}
              . The brief and the input files appear here when the ticket opens.
            </p>
          </div>
        ) : (
          <>
            {direction && (
              <div style={{ marginTop: 32 }}>
                <ChosenDirection direction={direction} audience="team" />
              </div>
            )}

            <div className="panel" style={{ marginTop: 24 }}>
              <div className="label">The brief</div>
              <p style={{ marginTop: 12, marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                {ticket.spec ||
                  'The bureau has not finished the brief — ask in a comment.'}
              </p>
            </div>

            {inbound.length > 0 && (
              <div className="panel" style={{ marginTop: 20 }}>
                <div className="label label-accent">Input files</div>
                <p className="hint" style={{ marginTop: 8 }}>What your predecessors in the graph handed in. The author is named by discipline.</p>
                <ul className="clean" style={{ marginTop: 12 }}>
                  {inbound.map((file) => (
                    <li key={file.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <a
                        href={artifactHref(file)}
                        {...(isOurs(file) ? {} : { target: '_blank', rel: 'noreferrer noopener' })}
                      >
                        {file.name}
                      </a>
                      <span className="dim" style={{ fontSize: '0.8rem', marginLeft: 10 }}>
                        {ARTIFACT_KIND_LABELS[file.kind] ?? file.kind} ·{' '}
                        {DISCIPLINE_LABELS[file.fromDiscipline as Discipline]}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {roles.length > 0 && (
              <p className="hint" style={{ marginTop: 16 }}>
                {fill('Adjacent roles on the project: {roles}.', {
                  roles: roles.map((r) => DISCIPLINE_LABELS[r]).join(', '),
                })}{' '}
                The system holds no contacts for them — everything goes through the bureau.
              </p>
            )}

            {canClaim && (
              <div style={{ marginTop: 28 }}>
                <ClaimWork ticketId={ticket.id} />
                <p className="hint" style={{ marginTop: 10 }}>Time to pick a task up is a metric. A ticket left open and untaken is seen by the digital manager, and it will remind you.</p>
              </div>
            )}

            {ticket.artifacts.length > 0 && (
              <div className="panel" style={{ marginTop: 24 }}>
                <div className="label">Your files on this ticket</div>
                <ul className="clean" style={{ marginTop: 12 }}>
                  {ticket.artifacts.map((file) => (
                    <li key={file.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <a
                        href={artifactHref(file)}
                        {...(isOurs(file) ? {} : { target: '_blank', rel: 'noreferrer noopener' })}
                      >
                        {file.name}
                      </a>
                      <span className="dim" style={{ fontSize: '0.8rem', marginLeft: 10 }}>
                        {ARTIFACT_KIND_LABELS[file.kind] ?? file.kind}
                      </span>
                      {file.source.startsWith('generated') && (
                        <span className="tag" style={{ marginLeft: 10 }}>
                          generated
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {working && (
              <div style={{ marginTop: 28 }}>
                <ArtifactForm ticketId={ticket.id} />
              </div>
            )}

            {working && (
              <>
                <div className="divider" />
                <div className="label label-accent">Image</div>
                <p className="hint" style={{ marginTop: 8, marginBottom: 16 }}>Draft material to work from. The records mark it as generated — responsibility for what you hand in stays yours.</p>
                <RenderForm
                  ticketId={ticket.id}
                 
                  hint={[
                    ticket.project.title,
                    direction
                      ? fill('Direction: {title}. {summary}', {
                          title: direction.title,
                          summary: direction.summary,
                        })
                      : '',
                  ]
                    .filter(Boolean)
                    .join('. ')}
                />
              </>
            )}

            <div className="divider" />

            <div className="label label-accent">Comments</div>
            <div className="stack" style={{ marginTop: 16, gap: 16 }}>
              {ticket.comments.length === 0 && <p className="dim">Nothing yet.</p>}
              {ticket.comments.map((c) => (
                <div
                  key={c.id}
                  className="panel"
                  style={{
                    padding: 16,
                    borderLeft: c.isConflict
                      ? '2px solid var(--fail)'
                      : c.authorRole === 'bureau'
                        ? '2px solid var(--accent)'
                        : '2px solid var(--border-strong)',
                  }}
                >
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="label">
                      {c.authorRole === 'bureau' ? 'Bureau' : 'You'}
                      {c.isConflict && ' · conflict'}
                    </span>
                    <span className="label">{formatDate(c.createdAt)}</span>
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
                <p className="hint" style={{ marginTop: 10 }}>The bureau does the accepting. Accepted on time and first time — Quality goes up.</p>
              </>
            )}

            {ticket.status === 'submitted' && (
              <div className="note" style={{ marginTop: 28 }}>The work is handed in and waits for the bureau to accept it.</div>
            )}

            {ticket.status === 'accepted' && (
              <div className="note" style={{ marginTop: 28 }}>The ticket is accepted. The gate opens the tasks that depend on it by itself.</div>
            )}

            {ticket.requests.length > 0 && (
              <div className="panel" style={{ marginTop: 24 }}>
                <div className="label">Your requests to adjacent disciplines</div>
                <ul className="clean" style={{ marginTop: 12 }}>
                  {ticket.requests.map((request) => (
                    <li
                      key={request.id}
                      className="row"
                      style={{ justifyContent: 'space-between', padding: '8px 0', gap: 12 }}
                    >
                      <span style={{ fontSize: '0.9rem' }}>
                        {request.title}
                        <span className="dim" style={{ marginLeft: 8, fontSize: '0.8rem' }}>
                          {DISCIPLINE_LABELS[request.discipline as Discipline]}
                        </span>
                      </span>
                      <span className={`tag ${request.status === 'accepted' ? 'tag-pass' : ''}`}>
                        {TICKET_STATUS_LABELS[request.status] ?? request.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {ticket.status !== 'accepted' && roles.length > 0 && (
              <>
                <div className="divider" />
                <div className="label label-accent">Need something from an adjacent discipline</div>
                <p className="hint" style={{ marginTop: 8, marginBottom: 16 }}>This is neither an argument nor a conversation. The request becomes a ticket for that discipline — with someone on it, a deadline and acceptance, like any other work.</p>
                <RequestForm ticketId={ticket.id} disciplines={roles} />
              </>
            )}

            {!ticket.conflictRaisedAt && ticket.status !== 'accepted' && (
              <>
                <div className="divider" />
                <div className="label" style={{ color: 'var(--fail)' }}>
                  If agreement is not possible
                </div>
                <p className="hint" style={{ marginTop: 8, marginBottom: 16 }}>Arbitration stops work on the ticket. For a working question use the request above.</p>
                <ConflictForm ticketId={ticket.id} />
              </>
            )}

          </>
        )}

        {/*
          Выход из роли живёт вне ветки статуса намеренно.
          Он про роль, а не про задачу, и доступен в том числе на
          заблокированном тикете — а это ровно то состояние, в котором человек
          и понимает, что не потянет: работа ещё не началась, зависимости не
          пришли, и сказать об этом надо сейчас, а не когда срок загорится.
        */}
        {ticket.status !== 'accepted' && (
          <>
            <div className="divider" style={{ marginTop: 40 }} />
            <div className="label" style={{ color: 'var(--fail)' }}>
              If you cannot carry it
            </div>
            <p className="hint" style={{ marginTop: 8, marginBottom: 16, maxWidth: '58ch' }}>Illness, someone else’s deadline, an underestimated scope — it happens, and silence here is worse than declining. Saying it early lets the project find a replacement while the deadline is not yet burning.</p>
            <LeaveForm projectId={ticket.projectId} />
          </>
        )}
      </div>
    </section>
  )
}
