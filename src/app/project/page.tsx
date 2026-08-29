import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  DISCIPLINE_LABELS,
  DOC_STAGE_LABELS,
  PROJECT_STATUS_LABELS,
  SPECIALIZATION_LABELS,
  TICKET_STATUS_LABELS,
  TYPOLOGY_LABELS,
} from '@/lib/labels'
import {
  JURISDICTION_NAMES,
  stagesUpTo,
  type Discipline,
  type DocStage,
  type Jurisdiction,
  type Specialization,
  type Typology,
} from '@/engine/taxonomy'
import { SPECIALIZATIONS } from '@/engine/taxonomy'
import type { AssemblyGap } from '@/engine/types'
import { parseList } from '@/lib/rows'
import { BreakdownRow } from '@/components/Breakdown'
import { ChosenDirection } from '@/components/ChosenDirection'
import { chosenDirection } from '@/lib/services/direction'
import { prisma } from '@/lib/db'
import { latestRun } from '@/lib/services/matching'
import { threadOf } from '@/lib/services/dialogue'
import { approvedStages, stagesAwaitingClient } from '@/lib/services/approval'
import { ClientDialogue, StageApproval } from './ClientDialogue'
import { clientExplanation, parseGap } from '@/lib/gap'
import { currentProjectId } from '@/lib/session'

export const metadata = { title: 'Кабинет проекта — TinyArc Cloud Bureau' }

export default async function ProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ issued?: string }>
}) {
  const { issued } = await searchParams
  const projectId = await currentProjectId()
  if (!projectId) redirect('/enter')

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      tickets: {
        orderBy: { createdAt: 'asc' },
        include: { specialist: { select: { displayName: true } } },
      },
    },
  })

  if (!project) redirect('/enter')

  const [run, direction, thread, pendingStages, approved] = await Promise.all([
    latestRun(project.id),
    chosenDirection(project.id),
    threadOf(project.id),
    stagesAwaitingClient(project.id),
    approvedStages(project.id),
  ])
  const team = run?.slots ?? []

  return (
    <section style={{ paddingTop: 'clamp(40px, 7vw, 72px)' }}>
      <div className="shell">
        <span className="eyebrow">Кабинет проекта</span>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h1 style={{ maxWidth: '18ch' }}>{project.title}</h1>
          <span className="tag tag-accent">{PROJECT_STATUS_LABELS[project.status] ?? project.status}</span>
        </div>

        {issued === '1' && (
          <div className="panel panel-accent" style={{ marginTop: 32 }}>
            <div className="label label-accent">Сохраните ключ доступа</div>
            <p
              className="num"
              style={{ fontSize: '1.4rem', color: 'var(--accent)', margin: '14px 0' }}
            >
              {project.clientKey}
            </p>
            <p className="muted" style={{ marginBottom: 0 }}>
              Ключ заменяет пароль: по нему вы вернётесь в кабинет с любого устройства. Копия
              ушла на {project.clientEmail} — но если письмо не дойдёт, останется только этот
              экран.
            </p>
          </div>
        )}

        <div className="grid grid-3" style={{ marginTop: 36 }}>
          <Fact label="Типология" value={TYPOLOGY_LABELS[project.typology as Typology]} />
          <Fact label="Этажей / площадь" value={`${project.storeys} · ${project.areaSqm} м²`} />
          <Fact label="Страна" value={JURISDICTION_NAMES[project.jurisdiction as Jurisdiction]} />
          <Fact label="Стадия документации" value={DOC_STAGE_LABELS[project.targetStage as DocStage]} />
          <Fact label="Ключ доступа" value={project.clientKey} mono />
          <Fact
            label="Пул → прошли гейты"
            value={run ? `${run.pooledCount} → ${run.survivedCount}` : '—'}
            mono
          />
        </div>

        {project.status === 'rejected' && (
          <div className="panel" style={{ borderColor: 'var(--fail)', marginTop: 40 }}>
            <div className="label" style={{ color: 'var(--fail)' }}>
              Проект не берётся
            </div>
            <p style={{ marginTop: 12, marginBottom: 0 }}>{project.rejectionReason}</p>
          </div>
        )}

        {run && run.outcome !== 'ok' && project.status !== 'rejected' && (
          <IncompleteRun
            outcome={run.outcome}
            gap={parseGap(run.gapJson)}
            jurisdiction={project.jurisdiction as Jurisdiction}
          />
        )}

        {direction ? (
          <div style={{ marginTop: 40 }}>
            <ChosenDirection direction={direction} audience="client" />
          </div>
        ) : (
          project.status !== 'rejected' && (
            <div className="note" style={{ marginTop: 40 }}>
              Направление проекта ещё не выбрано.{' '}
              <Link href="/project/direction">Выбрать →</Link>
            </div>
          )
        )}

        {project.tickets.length > 0 && (
          <>
            <div className="divider" style={{ marginTop: 48 }} />
            <h2>Где сейчас проект</h2>
            <p className="muted" style={{ marginTop: 12, marginBottom: 28 }}>
              Стадия закрывается, когда приняты все её задачи. Пропустить стадию нельзя: гейт
              просто не откроет следующую.
            </p>

            <div className="grid grid-2">
              {stagesUpTo(project.targetStage as DocStage).map((stage) => {
                const inStage = project.tickets.filter((t) => t.stage === stage)
                const done = inStage.filter((t) => t.status === 'accepted').length
                const share = inStage.length === 0 ? 0 : done / inStage.length

                return (
                  <div key={stage} className="panel">
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span className="label label-accent">{DOC_STAGE_LABELS[stage]}</span>
                      <span className="num dim">
                        {done} / {inStage.length}
                      </span>
                    </div>
                    <div className="bar" style={{ marginTop: 12 }}>
                      <span style={{ width: `${share * 100}%` }} />
                    </div>
                    <div className="dim" style={{ marginTop: 10, fontSize: '0.82rem' }}>
                      {share === 1
                        ? 'Стадия закрыта'
                        : inStage.some((t) => t.status !== 'blocked')
                          ? 'Идёт работа'
                          : 'Ждёт предыдущей стадии'}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {run && team.length > 0 && (
          <>
            <div className="divider" style={{ marginTop: 48 }} />
            <h2>Ваша Tiny Team</h2>
            <p className="muted" style={{ marginTop: 12 }}>
              Состав собран движком. Ниже — разбор балла по каждому: рейтинг портфолио, вклад
              метрик поставки, соответствие проекту, фактор доступности.
            </p>

            <div className="grid grid-2" style={{ marginTop: 28 }}>
              {team.map((slot) => {
                const candidate = run.candidates.find(
                  (c) => c.specialistId === slot.specialistId && c.discipline === slot.discipline,
                )

                return (
                  <div key={slot.id} className="panel">
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span className="label label-accent">
                        {DISCIPLINE_LABELS[slot.discipline as Discipline]}
                      </span>
                      {slot.isSignatory && <span className="tag tag-accent">подпись</span>}
                    </div>
                    {(() => {
                      const need = parseList<Specialization>(
                        slot.roleSpecializationsJson,
                        SPECIALIZATIONS,
                      )
                      if (need.length === 0) return null

                      return (
                        <div className="dim" style={{ fontSize: '0.8rem', marginTop: 6 }}>
                          {need
                            .map((x) => SPECIALIZATION_LABELS[x])
                            .join(slot.roleMode === 'all' ? ' + ' : ' / ')}
                        </div>
                      )
                    })()}
                    <h3 style={{ marginTop: 10, marginBottom: 16 }}>{slot.specialist.displayName}</h3>
                    {candidate && (
                      <BreakdownRow
                        breakdown={{
                          portfolioRating: candidate.portfolioRating,
                          deliveryScore: candidate.deliveryScore,
                          historyWeight: candidate.historyWeight,
                          relevance: candidate.relevance,
                          quality: candidate.quality,
                          availability: candidate.availability,
                          score: candidate.score,
                        }}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {project.tickets.length > 0 && (
          <>
            <div className="divider" style={{ marginTop: 48 }} />
            <h2>Выпуск</h2>
            <p className="muted" style={{ marginTop: 12, marginBottom: 28 }}>
              Тикет открывается, только когда приняты те, от которых он зависит. Специалисты
              между собой не переписываются — вся работа идёт через бюро.
            </p>

            <div className="table-scroll panel" style={{ padding: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Стадия</th>
                    <th>Задача</th>
                    <th>Дисциплина</th>
                    <th>Исполнитель</th>
                    <th>Состояние</th>
                  </tr>
                </thead>
                <tbody>
                  {project.tickets.map((ticket) => (
                    <tr key={ticket.id}>
                      <td className="dim">{DOC_STAGE_LABELS[ticket.stage as DocStage]}</td>
                      <td>{ticket.title}</td>
                      <td className="dim">{DISCIPLINE_LABELS[ticket.discipline as Discipline]}</td>
                      <td className="dim">{ticket.specialist?.displayName ?? '—'}</td>
                      <td>
                        <span className={`tag ${statusTone(ticket.status)}`}>
                          {TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="divider" style={{ marginTop: 48 }} />
        <div className="row" style={{ gap: 16 }}>
          <Link href="/algorithm" className="btn btn-quiet">
            Как считался отбор
          </Link>
        </div>

        {pendingStages.length > 0 && (
          <>
            <div className="divider" style={{ marginTop: 48 }} />

            <h2>Ждёт вашего подтверждения</h2>
            <p className="muted" style={{ marginTop: 12, marginBottom: 24, maxWidth: '60ch' }}>
              Бюро приняло все задачи этой стадии — это значит «сделано как заказано».
              Подтверждение с вашей стороны значит другое: «заказано было именно это».
              Пока его нет, следующая стадия не начинается.
            </p>

            <div className="stack" style={{ gap: 24 }}>
              {pendingStages.map((stage) => (
                <div key={stage} className="panel panel-accent">
                  <div className="label label-accent">
                    {DOC_STAGE_LABELS[stage as DocStage] ?? stage}
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <StageApproval
                      stage={stage}
                      title={DOC_STAGE_LABELS[stage as DocStage] ?? stage}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {approved.length > 0 && (
          <>
            <div className="divider" style={{ marginTop: 48 }} />

            {/*
              Заметный блок, а не подпись мелким.
              После подтверждения форма исчезает вместе со своим сообщением —
              человек нажал и остался без ответа. Подтверждённое и есть ответ,
              и увидеть его он должен сразу, а не искать глазами.
            */}
            <h2>Вы подтвердили</h2>
            <div className="row" style={{ gap: 10, marginTop: 16 }}>
              {approved.map((s) => (
                <span key={s} className="tag tag-pass">
                  {DOC_STAGE_LABELS[s as DocStage] ?? s}
                </span>
              ))}
            </div>
            <p className="hint" style={{ marginTop: 14, maxWidth: '60ch' }}>
              Команда работает по подтверждённому. Если что-то нужно изменить задним числом —
              напишите бюро: переделка на поздней стадии стоит дороже, и решать, как её
              провести, будем вместе.
            </p>
          </>
        )}

        <div className="divider" style={{ marginTop: 48 }} />

        <h2>Разговор с бюро</h2>
        <p className="muted" style={{ marginTop: 12, marginBottom: 24, maxWidth: '60ch' }}>
          Сроки, участок, изменившиеся обстоятельства — всё это сюда. Бюро отвечает перед вами
          за проект целиком, и вопрос по проекту — это вопрос к нему.
        </p>

        {thread.length > 0 && (
          <div className="stack" style={{ gap: 14, marginBottom: 32 }}>
            {thread.map((m) => (
              <div
                key={m.id}
                style={{
                  borderLeft:
                    m.authorRole === 'bureau'
                      ? '2px solid var(--accent)'
                      : '2px solid var(--border-strong)',
                  paddingLeft: 14,
                }}
              >
                <span className="label">
                  {m.authorRole === 'bureau' ? 'Бюро' : 'Вы'} ·{' '}
                  {m.createdAt.toLocaleString('ru-RU')}
                </span>
                <p style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>{m.body}</p>
              </div>
            ))}
          </div>
        )}

        <div className="panel">
          <ClientDialogue />
        </div>
      </div>
    </section>
  )
}

function statusTone(status: string): string {
  if (status === 'accepted') return 'tag-pass'
  if (status === 'revision') return 'tag-fail'
  if (status === 'blocked') return ''
  return 'tag-wait'
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
      <div className="label">{label}</div>
      <div className={mono ? 'num' : ''} style={{ marginTop: 6 }}>
        {value}
      </div>
    </div>
  )
}

/**
 * Что видит заказчик, когда команда не собралась.
 *
 * Это самый вероятный экран первых недель: пул ещё тонкий, а брифы уже идут.
 * Раньше здесь стояла записка движка с именами словарей — «дисциплина "mep" со
 * специализацией mep_hvac» — и ни одного слова о том, что будет дальше.
 *
 * Нехватка подписи выделена отдельно: людей мы нашли, но пакет без локальной
 * подписи не имеет силы, и это не та новость, которую можно смешивать с
 * «никого нет».
 */
function IncompleteRun({
  outcome,
  gap,
  jurisdiction,
}: {
  outcome: string
  gap: AssemblyGap | null
  jurisdiction: Jurisdiction
}) {
  if (outcome === 'no_signatory') {
    return (
      <div className="panel" style={{ borderColor: 'var(--fail)', marginTop: 40 }}>
        <div className="label" style={{ color: 'var(--fail)' }}>
          Команда пока не собрана
        </div>
        <p style={{ marginTop: 12, marginBottom: 0 }}>
          Специалисты под ваш проект есть, но ни у кого из них нет права подписи в стране
          «{JURISDICTION_NAMES[jurisdiction] ?? jurisdiction}». Пакет документации без местной
          подписи не имеет силы — его не примут в органах, и браться за проект без неё значит
          продать вам бумагу. Бюро ищет подписанта; ключ доступа у вас, по нему вы вернётесь
          в проект.
        </p>
      </div>
    )
  }

  if (!gap) {
    return (
      <div className="panel" style={{ borderColor: 'var(--fail)', marginTop: 40 }}>
        <div className="label" style={{ color: 'var(--fail)' }}>
          Команда пока не собрана
        </div>
        <p style={{ marginTop: 12, marginBottom: 0 }}>
          Состав под ваш проект не сошёлся. Бюро разбирается; ключ доступа у вас, по нему вы
          вернётесь в проект.
        </p>
      </div>
    )
  }

  const { headline, body } = clientExplanation(gap, jurisdiction)

  return (
    <div className="panel" style={{ borderColor: 'var(--fail)', marginTop: 40 }}>
      <div className="label" style={{ color: 'var(--fail)' }}>
        {headline}
      </div>
      <p style={{ marginTop: 12, marginBottom: 0 }}>{body}</p>
    </div>
  )
}
