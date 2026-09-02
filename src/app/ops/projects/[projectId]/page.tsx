import Link from 'next/link'
import { amount, date, dateTime } from '@/lib/format'
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
import { Compliance } from '@/components/Compliance'
import { checkSite } from '@/lib/services/compliance'
import { buildFor } from '@/lib/services/contractors'
import {
  CONTRACTOR_REJECTION_LABELS,
  MATERIAL_GROUP_LABELS,
  TRADE_LABELS,
} from '@/lib/labels'
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
import { alertsForProject } from '@/lib/services/pm'
import { threadOf } from '@/lib/services/dialogue'
import { ALERT_LABELS, isNudgeKind } from '@/engine/pm'
import { isOperator } from '@/lib/session'
import {
  acceptTicket,
  answerClient,
  bureauComment,
  checkTicketCompleteness,
  draftTicketNudge,
  draftTicketSpec,
  eraseProjectData,
  rerunAssembly,
  runProjectGate,
  setSiteFacts,
  resolveTicketConflict,
  returnTicket,
  setTicketSpec,
  summariseTicketConflict,
} from '../../actions'
import { OpsAction } from '../../OpsForms'

export const metadata = { title: 'Project — bureau panel' }

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

  const [run, direction, alerts, thread, withdrawals, rules, build] = await Promise.all([
    latestRun(project.id),
    chosenDirection(project.id),
    alertsForProject(project.id),
    threadOf(project.id),
    prisma.withdrawal.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'asc' },
      include: { specialist: { select: { displayName: true } } },
    }),
    checkSite(project),
    buildFor(project),
  ])

  const replacedBy = new Map(
    (
      await prisma.specialist.findMany({
        where: { id: { in: withdrawals.map((w) => w.replacedById).filter(Boolean) } },
        select: { id: true, displayName: true },
      })
    ).map((s) => [s.id, s.displayName]),
  )

  // Сигналы, по которым бюро пишет исполнителю. Кнопка напоминания появляется
  // только там, где менеджер уже сказал, что работа встала.
  const nudgeable = new Map(
    alerts.filter((a) => isNudgeKind(a.kind)).map((a) => [a.ticketId, a]),
  )

  return (
    <section style={{ paddingTop: 'clamp(40px, 7vw, 72px)' }}>
      <div className="shell">
        <Link href="/ops/projects" className="label">
          ← projects
        </Link>

        <div className="row" style={{ justifyContent: 'space-between', marginTop: 18 }}>
          <h1>{project.title}</h1>
          <span className="tag tag-accent">
            {PROJECT_STATUS_LABELS[project.status] ?? project.status}
          </span>
        </div>

        <p className="dim" style={{ marginTop: 10 }}>
          {TYPOLOGY_LABELS[project.typology as Typology]} ·{' '}
          {JURISDICTION_NAMES[project.jurisdiction as Jurisdiction]} · {project.storeys} floors ·{' '}
          {project.areaSqm} m² · {TERRAIN_LABELS[project.terrain as Terrain]} ·{' '}
          {GRID_LABELS[project.gridConnection as 'grid' | 'off_grid']} · to stage “
          {DOC_STAGE_LABELS[project.targetStage as DocStage]}»
        </p>

        {/*
          The client and their key. The key is visible here for the same reason an invited specialist's key is: with the stub mailer nothing is sent, and access still has to be handed over. The panel is behind a password.
        */}
        <p className="dim" style={{ marginTop: 8, fontSize: '0.85rem' }}>
          {project.clientName} · {project.clientEmail} · key{' '}
          <span className="num">{project.clientKey}</span>
        </p>

        {project.briefNotes && (
          <div className="panel" style={{ marginTop: 24 }}>
            <div className="label">Client brief</div>
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
            <h2>Assembly run</h2>
            {run && (
              <p className="dim" style={{ marginTop: 10 }}>
                {OUTCOME_LABELS[run.outcome] ?? run.outcome} · pool {run.pooledCount} → passed{' '}
                {run.survivedCount} · {dateTime(run.createdAt)}
              </p>
            )}
          </div>
          <div className="row" style={{ gap: 12 }}>
            {/*
              Гейт зовётся сам после каждой приёмки, подтверждения и оплаты.
              Кнопка — на случай разрыва между переходом состояния и гейтом:
              после него проект стоит молча, всё оплачено и подтверждено, а
              работа никому не выдана.
            */}
            <OpsAction action={runProjectGate} hidden={{ projectId: project.id }} label="Run the gate" />
            <OpsAction action={rerunAssembly} hidden={{ projectId: project.id }} label="Reassemble" />
          </div>
        </div>

        {run?.notes && <p className="note note-fail" style={{ marginTop: 16 }}>{run.notes}</p>}

        {/*
          Участок и объём. Заполняет бюро, потому что пятна застройки, высоты и
          отступов до проекта не существует: они появляются с концепцией. До тех
          пор проверка честно говорит, что ей нечем считать, — и именно этот
          список полей она называет заказчику в кабинете.
        */}
        <div className="panel" style={{ marginTop: 24 }}>
          <div className="label label-accent">Site and massing</div>
          <p className="muted" style={{ marginTop: 10, marginBottom: 18 }}>
            The client gives the first three from their documents. The rest appears with the concept and is entered here — until it is, the rules check says what it is missing. An empty field clears the value.
          </p>

          <OpsAction action={setSiteFacts} hidden={{ projectId: project.id }} label="Save site data" solid>
            <div className="grid grid-3" style={{ marginBottom: 16 }}>
              <SiteField id="municipality" label="Municipality" value={project.municipality} text />
              <SiteField id="zone" label="Zone" value={project.zone} text />
              <SiteField id="plotAreaSqm" label="Plot area, m²" value={project.plotAreaSqm} />
              <SiteField id="footprintSqm" label="Footprint, m²" value={project.footprintSqm} />
              <SiteField id="heightM" label="Height, m" value={project.heightM} step="0.1" />
              <SiteField id="units" label="Units" value={project.units} />
              <SiteField id="setbackFrontM" label="Front setback, m" value={project.setbackFrontM} step="0.1" />
              <SiteField id="setbackSideM" label="Side setback, m" value={project.setbackSideM} step="0.1" />
              <SiteField id="setbackRearM" label="Rear setback, m" value={project.setbackRearM} step="0.1" />
              <SiteField id="parkingSpaces" label="Parking spaces" value={project.parkingSpaces} />
              <SiteField id="greenSqm" label="Green area, m²" value={project.greenSqm} />
            </div>
          </OpsAction>
        </div>

        <Compliance view={rules} audience="bureau" />

        {/*
          Подрядчики и закупка. Список считается тем же движком, что состав
          команды, и по тем же правилам: гейты, балл, трое. Пустая сеть
          показывается пустой — «подрядчиков нет» и «мы их не нашли» разные
          сообщения, и второе бюро должно уметь отличить.
        */}
        <div className="panel" style={{ marginTop: 40 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div className="label label-accent">Build: contractors and materials</div>
            <Link href="/ops/contractors" className="dim" style={{ fontSize: '0.82rem' }}>
              network of {build.networkSize} →
            </Link>
          </div>

          <p className="muted" style={{ marginTop: 12, marginBottom: 18 }}>
            Derived from the project itself: typology, areas, material system, terrain. The client pays for access to the shortlist; a contractor never pays for a place in it.
          </p>

          {build.networkSize === 0 ? (
            <p className="dim" style={{ marginBottom: 0 }}>
              No contractors in this country yet, so there is nothing to shortlist. That is a gap in the network, not a verdict on the project.
            </p>
          ) : (
            <div className="table-scroll" style={{ margin: '0 -22px' }}>
              <table>
                <thead>
                  <tr>
                    <th>Work</th>
                    <th>Shortlist</th>
                    <th>Carry out this work → passed</th>
                    <th>Why the rest did not pass</th>
                  </tr>
                </thead>
                <tbody>
                  {build.lists.map((list) => (
                    <tr key={list.trade}>
                      <td>{TRADE_LABELS[list.trade] ?? list.trade}</td>
                      <td className="dim" style={{ fontSize: '0.85rem' }}>
                        {list.ranked.length === 0
                          ? '—'
                          : list.ranked
                              .map((row) => `${build.names[row.contractorId] ?? row.contractorId} · ${row.score}`)
                              .join(' / ')}
                      </td>
                      {/*
                        Считается от тех, кто эту работу ведёт, а не от всей
                        сети: кровельщик, не прошедший «фундаменты», — другой
                        подрядчик, а не дыра. Сводка отказов читается как
                        список дыр, и врать в ней нельзя.
                      */}
                      <td className="num dim">
                        {list.pooled - list.outOfScope} → {list.passed}
                        {list.passed > list.ranked.length && ` · ${list.ranked.length} shown`}
                      </td>
                      <td className="dim" style={{ fontSize: '0.8rem' }}>
                        {Object.entries(list.rejected)
                          .filter(([, count]) => count > 0)
                          .map(([reason, count]) => `${count} ${CONTRACTOR_REJECTION_LABELS[reason] ?? reason}`)
                          .join(', ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="hint" style={{ marginTop: 18, marginBottom: 0 }}>
            To buy: {build.groups.map((group) => MATERIAL_GROUP_LABELS[group] ?? group).join(', ')}.
            Quantities come with the construction documentation — an approximate bill presented as exact is a dispute at handover.
          </p>
        </div>

        {run && run.slots.length > 0 && (
          <div className="table-scroll panel" style={{ marginTop: 24, padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Discipline</th>
                  <th>Specialist</th>
                  <th>Quality</th>
                  <th>Availability</th>
                  <th>Score</th>
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
                            signatory
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

          {/*
            Право заказчика на удаление данных (п.13). Стоит только на
            закрытом проекте: пока проект идёт, стереть его материалы значит
            остановить работу людей, которые по ним чертят прямо сейчас.
          */}
          {(project.status === 'delivered' || project.status === 'rejected') && (
            <>
              <h2>At the client’s request</h2>
              <p className="muted" style={{ marginTop: 12, marginBottom: 20, maxWidth: '62ch' }}>
                Erasing removes the contacts, the brief, the correspondence, the task briefs
                and the files — from the storage too, not only from the database. Invoices
                remain: keeping them is an obligation of the country of registration, and a
                request does not lift it. This cannot be undone.
              </p>

              {project.dataErasedAt ? (
                <div className="panel" style={{ marginBottom: 36 }}>
                  <div className="label">Erased</div>
                  <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
                    {date(project.dataErasedAt)} — nothing personal is left on this project.
                  </p>
                </div>
              ) : (
                <div
                  className="panel"
                  style={{ marginBottom: 36, borderColor: 'var(--fail)' }}
                >
                  <OpsAction
                    action={eraseProjectData}
                    hidden={{ projectId: project.id }}
                    label="Erase the project data"
                  >
                    <input
                      type="text"
                      name="reason"
                      placeholder="Where the request came from"
                      style={{ marginBottom: 10 }}
                    />
                  </OpsAction>
                </div>
              )}
            </>
          )}

        {/* --- Тикеты -------------------------------------------------------- */}
        {project.tickets.length > 0 && (
          <>
            <div className="divider" style={{ marginTop: 44 }} />
            <div className="panel" style={{ marginBottom: 32 }}>
              <div className="label label-accent">Conversation with the client</div>
              <p className="hint" style={{ marginTop: 8, marginBottom: 16 }}>
                The team does not see this exchange. The bureau turns a client’s request into a task — otherwise the client starts directing the people doing the work, and no one is left answering for the result.
              </p>

              {thread.length === 0 ? (
                <p className="dim" style={{ marginBottom: 16 }}>The client has said nothing yet.</p>
              ) : (
                <div className="stack" style={{ gap: 12, marginBottom: 20 }}>
                  {thread.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        borderLeft:
                          m.authorRole === 'bureau'
                            ? '2px solid var(--accent)'
                            : '2px solid var(--border-strong)',
                        paddingLeft: 12,
                      }}
                    >
                      <span className="label">
                        {m.authorRole === 'bureau' ? 'Bureau' : 'Client'} ·{' '}
                        {dateTime(m.createdAt)}
                        {m.authorRole === 'client' && !m.answeredAt && ' · unanswered'}
                      </span>
                      <p style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>
                        {m.body}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <OpsAction
                action={answerClient}
                hidden={{ projectId: project.id }}
                label="Answer the client"
              >
                <div className="field">
                  <label htmlFor="answer">Answer</label>
                  <textarea id="answer" name="body" style={{ minHeight: 70 }} />
                </div>
              </OpsAction>
            </div>

            {withdrawals.length > 0 && (
              <div className="panel" style={{ marginBottom: 32, borderColor: 'var(--fail)' }}>
                <div className="label" style={{ color: 'var(--fail)' }}>
                  Who left the project
                </div>
                <p className="hint" style={{ marginTop: 8, marginBottom: 16 }}>
                  This is not a rating of people — there is no rating field in the system. It is a fact that shows where a line-up rested on one person.
                </p>
                <div className="stack" style={{ gap: 12 }}>
                  {withdrawals.map((w) => (
                    <div key={w.id}>
                      <div className="row" style={{ gap: 10, alignItems: 'baseline' }}>
                        <strong>{w.specialist.displayName}</strong>
                        <span className="dim" style={{ fontSize: '0.82rem' }}>
                          {DISCIPLINE_LABELS[w.discipline as Discipline] ?? w.discipline} ·{' '}
                          {date(w.createdAt)}
                        </span>
                        <span className={w.replacedById ? 'tag' : 'tag tag-fail'}>
                          {w.replacedById
                            ? `role taken over by ${replacedBy.get(w.replacedById) ?? '—'}`
                            : 'no replacement found'}
                        </span>
                      </div>
                      <p className="muted" style={{ margin: '6px 0 0', fontSize: '0.88rem' }}>
                        {w.reason}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <h2>Tickets</h2>
            <p className="muted" style={{ marginTop: 12, marginBottom: 28 }}>
              The bureau writes the brief. Gates open tickets by themselves — no status is set by hand.
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
                      {ticket.kind === 'request' && <span className="tag tag-accent">request</span>}
                      <span className="tag">
                        {TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}
                      </span>
                    </div>
                  </div>

                  <h3 style={{ marginTop: 12 }}>{ticket.title}</h3>
                  <p className="dim" style={{ marginTop: 6, fontSize: '0.85rem' }}>
                    {ticket.specialist?.displayName ?? 'not assigned'} · SLA {ticket.slaHours} h
                    {ticket.dueAt && ` · due ${dateTime(ticket.dueAt)}`}
                    {ticket.revisionRounds > 0 && ` · revision rounds: ${ticket.revisionRounds}`}
                    {ticket.status === 'blocked' &&
                      ` · waits for: ${ticket.dependsOn
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
                        Conflict Detected · {dateTime(ticket.conflictRaisedAt)}
                      </div>
                      <p style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>{ticket.conflictNote}</p>
                      <p className="hint" style={{ marginBottom: 14 }}>
                        Work on the ticket is on hold. The participants do not settle it between themselves — the bureau rules.
                      </p>

                      <div style={{ marginBottom: 16 }}>
                        <OpsAction
                          action={summariseTicketConflict}
                          hidden={{ ticketId: ticket.id }}
                          label="Reduce to positions"
                        />
                      </div>

                      <OpsAction
                        action={resolveTicketConflict}
                        hidden={{ ticketId: ticket.id }}
                        label="Rule on it"
                        solid
                      >
                        <div className="field">
                          <label htmlFor={`ruling-${ticket.id}`}>The arbiter’s ruling</label>
                          <textarea
                            id={`ruling-${ticket.id}`}
                            name="ruling"
                            style={{ minHeight: 70 }}
                          />
                        </div>
                      </OpsAction>
                    </div>
                  )}

                  {nudgeable.has(ticket.id) && (
                    <div style={{ marginTop: 18 }}>
                      <span className="tag tag-wait">
                        {ALERT_LABELS[nudgeable.get(ticket.id)!.kind]} ·{' '}
                        {Math.round(nudgeable.get(ticket.id)!.hours)} h
                      </span>
                      <div style={{ marginTop: 12 }}>
                        <OpsAction
                          action={draftTicketNudge}
                          hidden={{ ticketId: ticket.id }}
                          label="Draft a nudge"
                        />
                        <p className="hint" style={{ marginTop: 8 }}>
                          The assistant writes a draft. You send it — as a comment in the ticket: there is no other channel to the person doing the work.
                        </p>
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: 20 }}>
                    {ticket.spec.trim().length === 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <OpsAction
                          action={draftTicketSpec}
                          hidden={{ ticketId: ticket.id }}
                          label="Draft the brief"
                        />
                        <p className="hint" style={{ marginTop: 8 }}>
                          The assistant assembles a draft from the facts of the project. It is a starting point to read and correct — the bureau writes the brief.
                        </p>
                      </div>
                    )}

                    <OpsAction
                      action={setTicketSpec}
                      hidden={{ ticketId: ticket.id }}
                      label="Save the brief"
                    >
                      <div className="field">
                        <label htmlFor={`spec-${ticket.id}`}>The task brief</label>
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
                      <div className="label">Ticket thread</div>
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
                              {c.authorRole === 'bureau' ? 'Bureau' : 'Specialist'} ·{' '}
                              {date(c.createdAt)}
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
                        label="Write in the ticket"
                      >
                        <div className="field">
                          <label htmlFor={`body-${ticket.id}`}>Bureau comment</label>
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
                        label="Check against the brief"
                      />
                      <p className="hint" style={{ marginTop: 8 }}>
                        The assistant names discrepancies from the file list. You look at the contents yourself — you are the one accepting.
                      </p>
                    </div>
                  )}

                  {ticket.status === 'submitted' && (
                    <div className="grid grid-2" style={{ marginTop: 20, gap: 20 }}>
                      <OpsAction
                        action={acceptTicket}
                        hidden={{ ticketId: ticket.id }}
                        label="Accept"
                        solid
                      />
                      <OpsAction
                        action={returnTicket}
                        hidden={{ ticketId: ticket.id }}
                        label="Send back for revision"
                      >
                        <div className="field">
                          <label htmlFor={`note-${ticket.id}`}>What exactly is wrong</label>
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

/**
 * Поле участка.
 *
 * Пустое значение показывается пустым, а не нулём: ноль здесь — это утверждение
 * («отступ ноль метров»), а пустота — отсутствие сведений, и путать их нельзя
 * ровно по той же причине, по которой их не путает движок.
 */
function SiteField({
  id,
  label,
  value,
  text,
  step,
}: {
  id: string
  label: string
  value: string | number | null
  text?: boolean
  step?: string
}) {
  return (
    <div className="field">
      <label htmlFor={`site-${id}`}>{label}</label>
      <input
        id={`site-${id}`}
        name={id}
        type={text ? 'text' : 'number'}
        min={text ? undefined : 0}
        step={step}
        defaultValue={value ?? ''}
      />
    </div>
  )
}
