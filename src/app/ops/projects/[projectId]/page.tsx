import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import {
  JURISDICTION_NAMES,
  type Discipline,
  type DocStage,
  type Jurisdiction,
  type Typology,
} from '@/engine/taxonomy'
import { prisma } from '@/lib/db'
import {
  DISCIPLINE_LABELS,
  DOC_STAGE_LABELS,
  OUTCOME_LABELS,
  PROJECT_STATUS_LABELS,
  TICKET_STATUS_LABELS,
  TYPOLOGY_LABELS,
} from '@/lib/labels'
import { latestRun } from '@/lib/services/matching'
import { isOperator } from '@/lib/session'
import { acceptTicket, bureauComment, rerunAssembly, returnTicket, setTicketSpec } from '../../actions'
import { OpsAction } from '../../OpsForms'

export const metadata = { title: 'Проект — панель бюро' }

export default async function OpsProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  if (!(await isOperator())) redirect('/ops')

  const { projectId } = await params

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      tickets: {
        orderBy: { createdAt: 'asc' },
        include: {
          specialist: { select: { displayName: true } },
          comments: { orderBy: { createdAt: 'asc' } },
          dependsOn: { include: { prerequisite: { select: { discipline: true, status: true } } } },
        },
      },
    },
  })

  if (!project) notFound()

  const run = await latestRun(project.id)

  return (
    <section style={{ paddingTop: 'clamp(40px, 7vw, 72px)' }}>
      <div className="shell">
        <Link href="/ops/projects" className="label">
          ← проекты
        </Link>

        <div className="row" style={{ justifyContent: 'space-between', marginTop: 18 }}>
          <h1>{project.title}</h1>
          <span className="tag tag-accent">
            {PROJECT_STATUS_LABELS[project.status] ?? project.status}
          </span>
        </div>

        <p className="dim" style={{ marginTop: 10 }}>
          {TYPOLOGY_LABELS[project.typology as Typology]} ·{' '}
          {JURISDICTION_NAMES[project.jurisdiction as Jurisdiction]} · {project.storeys} эт. ·{' '}
          {project.areaSqm} м² · до стадии «{DOC_STAGE_LABELS[project.targetStage as DocStage]}»
        </p>

        {project.briefNotes && (
          <div className="panel" style={{ marginTop: 24 }}>
            <div className="label">Бриф клиента</div>
            <p style={{ marginTop: 10, marginBottom: 0, whiteSpace: 'pre-wrap' }}>
              {project.briefNotes}
            </p>
          </div>
        )}

        {/* --- Прогон -------------------------------------------------------- */}
        <div className="divider" style={{ marginTop: 40 }} />
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2>Прогон сборки</h2>
            {run && (
              <p className="dim" style={{ marginTop: 10 }}>
                {OUTCOME_LABELS[run.outcome] ?? run.outcome} · пул {run.pooledCount} → прошли{' '}
                {run.survivedCount} · {run.createdAt.toLocaleString('ru-RU')}
              </p>
            )}
          </div>
          <OpsAction action={rerunAssembly} hidden={{ projectId: project.id }} label="Пересобрать" />
        </div>

        {run?.notes && <p className="note note-fail" style={{ marginTop: 16 }}>{run.notes}</p>}

        {run && run.slots.length > 0 && (
          <div className="table-scroll panel" style={{ marginTop: 24, padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Дисциплина</th>
                  <th>Специалист</th>
                  <th>Quality</th>
                  <th>Availability</th>
                  <th>Балл</th>
                </tr>
              </thead>
              <tbody>
                {run.slots.map((slot) => {
                  const candidate = run.candidates.find(
                    (c) => c.specialistId === slot.specialistId && c.discipline === slot.discipline,
                  )

                  return (
                    <tr key={slot.id}>
                      <td>{DISCIPLINE_LABELS[slot.discipline as Discipline]}</td>
                      <td>
                        {slot.specialist.displayName}
                        {slot.isSignatory && (
                          <span className="tag tag-accent" style={{ marginLeft: 10 }}>
                            подпись
                          </span>
                        )}
                      </td>
                      <td className="num dim">{candidate?.quality.toFixed(2) ?? '—'}</td>
                      <td className="num dim">{candidate?.availability.toFixed(2) ?? '—'}</td>
                      <td className="num" style={{ color: 'var(--accent)' }}>
                        {slot.score.toFixed(2)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* --- Тикеты -------------------------------------------------------- */}
        {project.tickets.length > 0 && (
          <>
            <div className="divider" style={{ marginTop: 44 }} />
            <h2>Тикеты</h2>
            <p className="muted" style={{ marginTop: 12, marginBottom: 28 }}>
              Постановку пишет бюро. Гейты открывают тикеты сами — руками статус не ставится.
            </p>

            <div className="stack" style={{ gap: 24 }}>
              {project.tickets.map((ticket) => (
                <div key={ticket.id} className="panel">
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="label label-accent">
                      {DOC_STAGE_LABELS[ticket.stage as DocStage]} ·{' '}
                      {DISCIPLINE_LABELS[ticket.discipline as Discipline]}
                    </span>
                    <span className="tag">
                      {TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}
                    </span>
                  </div>

                  <h3 style={{ marginTop: 12 }}>{ticket.title}</h3>
                  <p className="dim" style={{ marginTop: 6, fontSize: '0.85rem' }}>
                    {ticket.specialist?.displayName ?? 'не назначен'}
                    {ticket.dueAt && ` · срок ${ticket.dueAt.toLocaleDateString('ru-RU')}`}
                    {ticket.revisionRounds > 0 && ` · кругов правок: ${ticket.revisionRounds}`}
                    {ticket.status === 'blocked' &&
                      ` · ждёт: ${ticket.dependsOn
                        .filter((d) => d.prerequisite.status !== 'accepted')
                        .map((d) => DISCIPLINE_LABELS[d.prerequisite.discipline as Discipline])
                        .join(', ')}`}
                  </p>

                  <div style={{ marginTop: 20 }}>
                    <OpsAction
                      action={setTicketSpec}
                      hidden={{ ticketId: ticket.id }}
                      label="Сохранить постановку"
                    >
                      <div className="field">
                        <label htmlFor={`spec-${ticket.id}`}>Постановка задачи</label>
                        <textarea
                          id={`spec-${ticket.id}`}
                          name="spec"
                          defaultValue={ticket.spec}
                          style={{ minHeight: 90 }}
                        />
                      </div>
                    </OpsAction>
                  </div>

                  {ticket.comments.length > 0 && (
                    <div style={{ marginTop: 22 }}>
                      <div className="label">Переписка в тикете</div>
                      <div className="stack" style={{ marginTop: 12, gap: 10 }}>
                        {ticket.comments.map((c) => (
                          <div
                            key={c.id}
                            style={{
                              borderLeft:
                                c.authorRole === 'bureau'
                                  ? '2px solid var(--accent)'
                                  : '2px solid var(--border-strong)',
                              paddingLeft: 12,
                            }}
                          >
                            <span className="label">
                              {c.authorRole === 'bureau' ? 'Бюро' : 'Специалист'} ·{' '}
                              {c.createdAt.toLocaleDateString('ru-RU')}
                            </span>
                            <p style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>
                              {c.body}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {ticket.status !== 'blocked' && (
                    <div style={{ marginTop: 22 }}>
                      <OpsAction
                        action={bureauComment}
                        hidden={{ ticketId: ticket.id }}
                        label="Написать в тикет"
                      >
                        <div className="field">
                          <label htmlFor={`body-${ticket.id}`}>Комментарий бюро</label>
                          <textarea
                            id={`body-${ticket.id}`}
                            name="body"
                            style={{ minHeight: 70 }}
                          />
                        </div>
                      </OpsAction>
                    </div>
                  )}

                  {ticket.status === 'submitted' && (
                    <div className="grid grid-2" style={{ marginTop: 24, gap: 20 }}>
                      <OpsAction
                        action={acceptTicket}
                        hidden={{ ticketId: ticket.id }}
                        label="Принять"
                        solid
                      />
                      <OpsAction
                        action={returnTicket}
                        hidden={{ ticketId: ticket.id }}
                        label="Вернуть на круг"
                      >
                        <div className="field">
                          <label htmlFor={`note-${ticket.id}`}>Что именно не так</label>
                          <textarea
                            id={`note-${ticket.id}`}
                            name="note"
                            style={{ minHeight: 70 }}
                          />
                        </div>
                      </OpsAction>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
