import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import {
  JURISDICTION_NAMES,
  type Discipline,
  type DocStage,
  type Jurisdiction,
  type Specialization,
  type Terrain,
  type Typology,
} from '@/engine/taxonomy'
import { prisma } from '@/lib/db'
import {
  DISCIPLINE_LABELS,
  DOC_STAGE_LABELS,
  GRID_LABELS,
  OUTCOME_LABELS,
  PROJECT_STATUS_LABELS,
  SPECIALIZATION_LABELS,
  TERRAIN_LABELS,
  TICKET_STATUS_LABELS,
  TYPOLOGY_LABELS,
} from '@/lib/labels'
import { parseList } from '@/lib/rows'
import { SPECIALIZATIONS } from '@/engine/taxonomy'
import { ChosenDirection } from '@/components/ChosenDirection'
import { chosenDirection } from '@/lib/services/direction'
import { latestRun } from '@/lib/services/matching'
import { isOperator } from '@/lib/session'
import {
  acceptTicket,
  bureauComment,
  checkTicketCompleteness,
  draftTicketSpec,
  rerunAssembly,
  resolveTicketConflict,
  returnTicket,
  setTicketSpec,
  summariseTicketConflict,
} from '../../actions'
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

  const [run, direction] = await Promise.all([
    latestRun(project.id),
    chosenDirection(project.id),
  ])

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
          {project.areaSqm} м² · {TERRAIN_LABELS[project.terrain as Terrain]} ·{' '}
          {GRID_LABELS[project.gridConnection as 'grid' | 'off_grid']} · до стадии «
          {DOC_STAGE_LABELS[project.targetStage as DocStage]}»
        </p>

        {project.briefNotes && (
          <div className="panel" style={{ marginTop: 24 }}>
            <div className="label">Бриф клиента</div>
            <p style={{ marginTop: 10, marginBottom: 0, whiteSpace: 'pre-wrap' }}>
              {project.briefNotes}
            </p>
          </div>
        )}

        {direction && (
          <div style={{ marginTop: 32 }}>
            <ChosenDirection direction={direction} audience="team" />
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
                      <td>
                        {DISCIPLINE_LABELS[slot.discipline as Discipline]}
                        {(() => {
                          const need = parseList<Specialization>(
                            slot.roleSpecializationsJson,
                            SPECIALIZATIONS,
                          )
                          if (need.length === 0) return null

                          return (
                            <>
                              <br />
                              <span className="dim" style={{ fontSize: '0.78rem' }}>
                                {need
                                  .map((x) => SPECIALIZATION_LABELS[x])
                                  .join(slot.roleMode === 'all' ? ' + ' : ' / ')}
                              </span>
                            </>
                          )
                        })()}
                      </td>
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
                    <div className="row" style={{ gap: 8 }}>
                      {ticket.kind === 'request' && <span className="tag tag-accent">запрос</span>}
                      <span className="tag">
                        {TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}
                      </span>
                    </div>
                  </div>

                  <h3 style={{ marginTop: 12 }}>{ticket.title}</h3>
                  <p className="dim" style={{ marginTop: 6, fontSize: '0.85rem' }}>
                    {ticket.specialist?.displayName ?? 'не назначен'} · SLA {ticket.slaHours} ч
                    {ticket.dueAt && ` · до ${ticket.dueAt.toLocaleString('ru-RU')}`}
                    {ticket.revisionRounds > 0 && ` · кругов правок: ${ticket.revisionRounds}`}
                    {ticket.status === 'blocked' &&
                      ` · ждёт: ${ticket.dependsOn
                        .filter((d) => d.prerequisite.status !== 'accepted')
                        .map((d) => DISCIPLINE_LABELS[d.prerequisite.discipline as Discipline])
                        .join(', ')}`}
                  </p>

                  {ticket.conflictRaisedAt && (
                    <div
                      className="panel"
                      style={{ marginTop: 18, borderColor: 'var(--fail)', padding: 18 }}
                    >
                      <div className="label" style={{ color: 'var(--fail)' }}>
                        Conflict Detected · {ticket.conflictRaisedAt.toLocaleString('ru-RU')}
                      </div>
                      <p style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>{ticket.conflictNote}</p>
                      <p className="hint" style={{ marginBottom: 14 }}>
                        Работа по тикету стоит. Между собой участники не договариваются — решает
                        бюро.
                      </p>

                      <div style={{ marginBottom: 16 }}>
                        <OpsAction
                          action={summariseTicketConflict}
                          hidden={{ ticketId: ticket.id }}
                          label="Свести к позициям"
                        />
                      </div>

                      <OpsAction
                        action={resolveTicketConflict}
                        hidden={{ ticketId: ticket.id }}
                        label="Вынести решение"
                        solid
                      >
                        <div className="field">
                          <label htmlFor={`ruling-${ticket.id}`}>Решение арбитра</label>
                          <textarea
                            id={`ruling-${ticket.id}`}
                            name="ruling"
                            style={{ minHeight: 70 }}
                          />
                        </div>
                      </OpsAction>
                    </div>
                  )}

                  <div style={{ marginTop: 20 }}>
                    {ticket.spec.trim().length === 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <OpsAction
                          action={draftTicketSpec}
                          hidden={{ ticketId: ticket.id }}
                          label="Черновик постановки"
                        />
                        <p className="hint" style={{ marginTop: 8 }}>
                          Помощник соберёт черновик из фактов проекта. Это заготовка, которую
                          надо прочитать и поправить, — постановку пишет бюро.
                        </p>
                      </div>
                    )}

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
                    <div style={{ marginTop: 24 }}>
                      <OpsAction
                        action={checkTicketCompleteness}
                        hidden={{ ticketId: ticket.id }}
                        label="Сверить с постановкой"
                      />
                      <p className="hint" style={{ marginTop: 8 }}>
                        Помощник называет расхождения по списку файлов. Содержимое смотрите
                        сами — принимаете вы.
                      </p>
                    </div>
                  )}

                  {ticket.status === 'submitted' && (
                    <div className="grid grid-2" style={{ marginTop: 20, gap: 20 }}>
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
