import { localeHref } from '@/lib/i18n/redirect'
import { Link } from '@/components/Link'
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
import { translator } from '@/lib/i18n'
import { pageMetadata } from '@/lib/i18n/metadata'
import { fill } from '@/lib/i18n/fill'
import { dateTime, date as formatDate } from '@/lib/i18n/format'
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

export const generateMetadata = () => pageMetadata('Тикет')

export default async function TicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params
  const { locale, t } = await translator()
  const specialist = await currentSpecialist()
  if (!specialist) redirect(await localeHref('/enter'))

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
        <Link locale={locale} href="/work" className="label">
          {t('← к доске работ')}
        </Link>

        <div className="row" style={{ justifyContent: 'space-between', marginTop: 20 }}>
          <span className="label label-accent">
            {t(DOC_STAGE_LABELS[ticket.stage as DocStage])} ·{' '}
            {t(DISCIPLINE_LABELS[ticket.discipline as Discipline])}
          </span>
          <span className="tag">{t(TICKET_STATUS_LABELS[ticket.status] ?? ticket.status)}</span>
        </div>

        {ticket.kind === 'request' && (
          <div className="row" style={{ marginTop: 12, gap: 10 }}>
            <span className="tag tag-accent">{t('запрос смежника')}</span>
            {ticket.requestedFrom && (
              <span className="dim" style={{ fontSize: '0.85rem' }}>
                {fill(t('от дисциплины «{discipline}»'), {
                  discipline: t(DISCIPLINE_LABELS[ticket.requestedFrom.discipline as Discipline]),
                })}
              </span>
            )}
          </div>
        )}

        <h1 style={{ marginTop: 14, fontSize: 'clamp(1.8rem, 4vw, 2.6rem)' }}>{t(ticket.title)}</h1>
        <p className="dim" style={{ marginTop: 10 }}>
          {ticket.project.title} · {fill(t('срок {hours} ч'), { hours: ticket.slaHours })}
          {ticket.dueAt && ` · ${fill(t('до {due}'), { due: dateTime(ticket.dueAt, locale) })}`}
          {ticket.revisionRounds > 0 &&
            ` · ${fill(t('кругов правок: {rounds}'), { rounds: ticket.revisionRounds })}`}
        </p>

        {ticket.conflictRaisedAt && (
          <div className="panel" style={{ marginTop: 24, borderColor: 'var(--fail)' }}>
            <div className="label" style={{ color: 'var(--fail)' }}>
              {t('Конфликт передан арбитру')}
            </div>
            <p style={{ marginTop: 10, marginBottom: 0 }}>{ticket.conflictNote}</p>
            <p className="hint" style={{ marginTop: 10 }}>
              {t('Работа по тикету стоит, пока бюро не вынесет решение.')}
            </p>
          </div>
        )}

        {blocked ? (
          <div className="panel" style={{ marginTop: 32 }}>
            <div className="label">{t('Тикет ещё закрыт гейтом')}</div>
            <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
              {t('Ждём приёмки:')}{' '}
              {ticket.dependsOn
                .filter((d) => d.prerequisite.status !== 'accepted')
                .map((d) => t(DISCIPLINE_LABELS[d.prerequisite.discipline as Discipline]))
                .join(', ') || '—'}
              . {t('Постановка и входные файлы появятся здесь, когда тикет откроется.')}
            </p>
          </div>
        ) : (
          <>
            {direction && (
              <div style={{ marginTop: 32 }}>
                <ChosenDirection direction={direction} audience="team" t={t} />
              </div>
            )}

            <div className="panel" style={{ marginTop: 24 }}>
              <div className="label">{t('Постановка')}</div>
              <p style={{ marginTop: 12, marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                {ticket.spec ||
                  t('Бюро ещё не дописало постановку — задайте вопрос в комментарии.')}
              </p>
            </div>

            {inbound.length > 0 && (
              <div className="panel" style={{ marginTop: 20 }}>
                <div className="label label-accent">{t('Входные файлы')}</div>
                <p className="hint" style={{ marginTop: 8 }}>{t('То, что сдали предшественники по графу. Автор указан дисциплиной.')}</p>
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
                        {t(ARTIFACT_KIND_LABELS[file.kind] ?? file.kind)} ·{' '}
                        {t(DISCIPLINE_LABELS[file.fromDiscipline as Discipline])}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {roles.length > 0 && (
              <p className="hint" style={{ marginTop: 16 }}>
                {fill(t('Смежники на проекте: {roles}.'), {
                  roles: roles.map((r) => t(DISCIPLINE_LABELS[r])).join(', '),
                })}{' '}
                {t('Их контактов в системе нет — всё через бюро.')}
              </p>
            )}

            {canClaim && (
              <div style={{ marginTop: 28 }}>
                <ClaimWork ticketId={ticket.id} locale={locale} />
                <p className="hint" style={{ marginTop: 10 }}>{t('Время до принятия задачи — это метрика. Тикет, открытый и не взятый, видит цифровой менеджер и напоминает.')}</p>
              </div>
            )}

            {ticket.artifacts.length > 0 && (
              <div className="panel" style={{ marginTop: 24 }}>
                <div className="label">{t('Ваши файлы по тикету')}</div>
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
                        {t(ARTIFACT_KIND_LABELS[file.kind] ?? file.kind)}
                      </span>
                      {file.source.startsWith('generated') && (
                        <span className="tag" style={{ marginLeft: 10 }}>
                          {t('сгенерировано')}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {working && (
              <div style={{ marginTop: 28 }}>
                <ArtifactForm ticketId={ticket.id} locale={locale} />
              </div>
            )}

            {working && (
              <>
                <div className="divider" />
                <div className="label label-accent">{t('Изображение')}</div>
                <p className="hint" style={{ marginTop: 8, marginBottom: 16 }}>{t('Черновой материал для работы. В записях он помечен как сгенерированный — ответственность за сданное остаётся на вас.')}</p>
                <RenderForm
                  ticketId={ticket.id}
                  locale={locale}
                  hint={[
                    ticket.project.title,
                    direction
                      ? fill(t('Направление: {title}. {summary}'), {
                          title: t(direction.title),
                          summary: t(direction.summary),
                        })
                      : '',
                  ]
                    .filter(Boolean)
                    .join('. ')}
                />
              </>
            )}

            <div className="divider" />

            <div className="label label-accent">{t('Комментарии')}</div>
            <div className="stack" style={{ marginTop: 16, gap: 16 }}>
              {ticket.comments.length === 0 && <p className="dim">{t('Пока пусто.')}</p>}
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
                      {c.authorRole === 'bureau' ? t('Бюро') : t('Вы')}
                      {c.isConflict && ` · ${t('конфликт')}`}
                    </span>
                    <span className="label">{formatDate(c.createdAt, locale)}</span>
                  </div>
                  <p style={{ marginTop: 10, marginBottom: 0, whiteSpace: 'pre-wrap' }}>{c.body}</p>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 28 }}>
              <CommentForm ticketId={ticket.id} locale={locale} />
            </div>

            {canSubmit && (
              <>
                <div className="divider" />
                <SubmitWork ticketId={ticket.id} locale={locale} />
                <p className="hint" style={{ marginTop: 10 }}>{t('Приёмку делает бюро. Принято в срок и с первого раза — Quality растёт.')}</p>
              </>
            )}

            {ticket.status === 'submitted' && (
              <div className="note" style={{ marginTop: 28 }}>{t('Работа предъявлена и ждёт приёмки бюро.')}</div>
            )}

            {ticket.status === 'accepted' && (
              <div className="note" style={{ marginTop: 28 }}>{t('Тикет принят. Зависящие от него задачи гейт откроет сам.')}</div>
            )}

            {ticket.requests.length > 0 && (
              <div className="panel" style={{ marginTop: 24 }}>
                <div className="label">{t('Ваши запросы смежникам')}</div>
                <ul className="clean" style={{ marginTop: 12 }}>
                  {ticket.requests.map((request) => (
                    <li
                      key={request.id}
                      className="row"
                      style={{ justifyContent: 'space-between', padding: '8px 0', gap: 12 }}
                    >
                      <span style={{ fontSize: '0.9rem' }}>
                        {t(request.title)}
                        <span className="dim" style={{ marginLeft: 8, fontSize: '0.8rem' }}>
                          {t(DISCIPLINE_LABELS[request.discipline as Discipline])}
                        </span>
                      </span>
                      <span className={`tag ${request.status === 'accepted' ? 'tag-pass' : ''}`}>
                        {t(TICKET_STATUS_LABELS[request.status] ?? request.status)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {ticket.status !== 'accepted' && roles.length > 0 && (
              <>
                <div className="divider" />
                <div className="label label-accent">{t('Нужно что-то от смежной дисциплины')}</div>
                <p className="hint" style={{ marginTop: 8, marginBottom: 16 }}>{t('Это не спор и не переписка. Запрос станет тикетом для нужной дисциплины — с исполнителем, сроком и приёмкой, как всякая другая работа.')}</p>
                <RequestForm ticketId={ticket.id} disciplines={roles} locale={locale} />
              </>
            )}

            {!ticket.conflictRaisedAt && ticket.status !== 'accepted' && (
              <>
                <div className="divider" />
                <div className="label" style={{ color: 'var(--fail)' }}>
                  {t('Если договориться нельзя')}
                </div>
                <p className="hint" style={{ marginTop: 8, marginBottom: 16 }}>{t('Арбитраж останавливает работу по тикету. Для рабочего вопроса используйте запрос выше.')}</p>
                <ConflictForm ticketId={ticket.id} locale={locale} />
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
              {t('Если не сможете вести')}
            </div>
            <p className="hint" style={{ marginTop: 8, marginBottom: 16, maxWidth: '58ch' }}>{t('Болезнь, чужой срок, недооценённый объём — это бывает, и молчание здесь хуже отказа. Сказать заранее значит дать проекту найти замену, пока срок ещё не горит.')}</p>
            <LeaveForm projectId={ticket.projectId} locale={locale} />
          </>
        )}
      </div>
    </section>
  )
}
