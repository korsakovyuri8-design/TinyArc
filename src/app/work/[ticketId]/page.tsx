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

export const metadata = { title: 'Тикет — TinyArc Cloud Bureau' }

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
          ← к доске работ
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
            <span className="tag tag-accent">запрос смежника</span>
            {ticket.requestedFrom && (
              <span className="dim" style={{ fontSize: '0.85rem' }}>
                от дисциплины «{DISCIPLINE_LABELS[ticket.requestedFrom.discipline as Discipline]}»
              </span>
            )}
          </div>
        )}

        <h1 style={{ marginTop: 14, fontSize: 'clamp(1.8rem, 4vw, 2.6rem)' }}>{ticket.title}</h1>
        <p className="dim" style={{ marginTop: 10 }}>
          {ticket.project.title} · срок {ticket.slaHours} ч
          {ticket.dueAt && ` · до ${ticket.dueAt.toLocaleString('ru-RU')}`}
          {ticket.revisionRounds > 0 && ` · кругов правок: ${ticket.revisionRounds}`}
        </p>

        {ticket.conflictRaisedAt && (
          <div className="panel" style={{ marginTop: 24, borderColor: 'var(--fail)' }}>
            <div className="label" style={{ color: 'var(--fail)' }}>
              Конфликт передан арбитру
            </div>
            <p style={{ marginTop: 10, marginBottom: 0 }}>{ticket.conflictNote}</p>
            <p className="hint" style={{ marginTop: 10 }}>
              Работа по тикету стоит, пока бюро не вынесет решение.
            </p>
          </div>
        )}

        {blocked ? (
          <div className="panel" style={{ marginTop: 32 }}>
            <div className="label">Тикет ещё закрыт гейтом</div>
            <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
              Ждём приёмки:{' '}
              {ticket.dependsOn
                .filter((d) => d.prerequisite.status !== 'accepted')
                .map((d) => DISCIPLINE_LABELS[d.prerequisite.discipline as Discipline])
                .join(', ') || '—'}
              . Постановка и входные файлы появятся здесь, когда тикет откроется.
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
              <div className="label">Постановка</div>
              <p style={{ marginTop: 12, marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                {ticket.spec || 'Бюро ещё не дописало постановку — задайте вопрос в комментарии.'}
              </p>
            </div>

            {inbound.length > 0 && (
              <div className="panel" style={{ marginTop: 20 }}>
                <div className="label label-accent">Входные файлы</div>
                <p className="hint" style={{ marginTop: 8 }}>
                  То, что сдали предшественники по графу. Автор указан дисциплиной.
                </p>
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
                Смежники на проекте: {roles.map((r) => DISCIPLINE_LABELS[r]).join(', ')}. Их
                контактов в системе нет — всё через бюро.
              </p>
            )}

            {canClaim && (
              <div style={{ marginTop: 28 }}>
                <ClaimWork ticketId={ticket.id} />
                <p className="hint" style={{ marginTop: 10 }}>
                  Время до принятия задачи — это метрика. Тикет, открытый и не взятый, видит
                  цифровой менеджер и напоминает.
                </p>
              </div>
            )}

            {ticket.artifacts.length > 0 && (
              <div className="panel" style={{ marginTop: 24 }}>
                <div className="label">Ваши файлы по тикету</div>
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
                          сгенерировано
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
                <div className="label label-accent">Изображение</div>
                <p className="hint" style={{ marginTop: 8, marginBottom: 16 }}>
                  Черновой материал для работы. В записях он помечен как сгенерированный —
                  ответственность за сданное остаётся на вас.
                </p>
                <RenderForm
                  ticketId={ticket.id}
                  hint={[
                    ticket.project.title,
                    direction ? `Направление: ${direction.title}. ${direction.summary}` : '',
                  ]
                    .filter(Boolean)
                    .join('. ')}
                />
              </>
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
                    borderLeft: c.isConflict
                      ? '2px solid var(--fail)'
                      : c.authorRole === 'bureau'
                        ? '2px solid var(--accent)'
                        : '2px solid var(--border-strong)',
                  }}
                >
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="label">
                      {c.authorRole === 'bureau' ? 'Бюро' : 'Вы'}
                      {c.isConflict && ' · конфликт'}
                    </span>
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

            {ticket.requests.length > 0 && (
              <div className="panel" style={{ marginTop: 24 }}>
                <div className="label">Ваши запросы смежникам</div>
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
                <div className="label label-accent">Нужно что-то от смежной дисциплины</div>
                <p className="hint" style={{ marginTop: 8, marginBottom: 16 }}>
                  Это не спор и не переписка. Запрос станет тикетом для нужной дисциплины —
                  с исполнителем, сроком и приёмкой, как всякая другая работа.
                </p>
                <RequestForm ticketId={ticket.id} disciplines={roles} />
              </>
            )}

            {!ticket.conflictRaisedAt && ticket.status !== 'accepted' && (
              <>
                <div className="divider" />
                <div className="label" style={{ color: 'var(--fail)' }}>
                  Если договориться нельзя
                </div>
                <p className="hint" style={{ marginTop: 8, marginBottom: 16 }}>
                  Арбитраж останавливает работу по тикету. Для рабочего вопроса используйте
                  запрос выше.
                </p>
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
              Если не сможете вести
            </div>
            <p className="hint" style={{ marginTop: 8, marginBottom: 16, maxWidth: '58ch' }}>
              Болезнь, чужой срок, недооценённый объём — это бывает, и молчание здесь хуже
              отказа. Сказать заранее значит дать проекту найти замену, пока срок ещё не
              горит.
            </p>
            <LeaveForm projectId={ticket.projectId} />
          </>
        )}
      </div>
    </section>
  )
}
