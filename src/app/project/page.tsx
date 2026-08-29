import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ARTIFACT_KIND_LABELS,
  DISCIPLINE_LABELS,
  DOC_STAGE_LABELS,
  PROJECT_STATUS_LABELS,
  SPECIALIZATION_LABELS,
  TICKET_STATUS_LABELS,
  TYPOLOGY_LABELS,
} from '@/lib/labels'
import {
  DOC_STAGES,
  DOC_STAGE_ORDER,
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
import { invoicesOf } from '@/lib/services/billing'
import { fileCount, packageOf } from '@/lib/services/package'
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

  const [run, direction, thread, pendingStages, approved, invoices] = await Promise.all([
    latestRun(project.id),
    chosenDirection(project.id),
    threadOf(project.id),
    stagesAwaitingClient(project.id),
    approvedStages(project.id),
    invoicesOf(project.id),
  ])

  const unpaid = new Set(invoices.filter((i) => i.status === 'issued').map((i) => i.stage))

  const documents = await packageOf(project.id)

  // Следующая стадия за той, до которой проект вёлся. Нужна только на
  // закрытии: предлагать её раньше — торопить человека, который ещё не увидел
  // результат.
  const nextStage = DOC_STAGES.find(
    (s) => DOC_STAGE_ORDER[s] === DOC_STAGE_ORDER[project.targetStage as DocStage] + 1,
  )
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

        {project.status === 'delivered' && (
          <div className="panel panel-accent" style={{ marginTop: 40 }}>
            <div className="label label-accent">Проект закрыт</div>
            <h3 style={{ marginTop: 12 }}>Комплект у вас</h3>
            <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
              Все стадии выпущены и подтверждены вами. Файлы ниже — то, за чем вы приходили.
              Доступ по ключу остаётся: кабинет не закрывается вместе с проектом, и вернуться
              к документации можно когда угодно.
              {nextStage && (
                <>
                  {' '}
                  Следующий шаг за этой границей —{' '}
                  <strong>{DOC_STAGE_LABELS[nextStage]}</strong>. Если он нужен, напишите
                  бюро: это отдельная работа и отдельный состав.
                </>
              )}
            </p>
          </div>
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
                      {/*
                        Причина простоя названа своим именем. «Ждёт предыдущей
                        стадии» на неоплаченной стадии — это неправда, из-за
                        которой человек ждёт нас, пока мы ждём его.
                      */}
                      {share === 1
                        ? 'Стадия закрыта'
                        : inStage.some((t) => t.status !== 'blocked')
                          ? 'Идёт работа'
                          : unpaid.has(stage)
                            ? 'Ждёт оплаты'
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

        {fileCount(documents) > 0 && (
          <>
            <div className="divider" style={{ marginTop: 48 }} />

            <h2>Комплект документации</h2>
            <p className="muted" style={{ marginTop: 12, marginBottom: 24, maxWidth: '60ch' }}>
              Собирается по мере закрытия стадий, а не выдаётся разом в конце: вы заплатили за
              стадию — вы получаете её файлы, когда она закрыта. Сгенерированные изображения
              сюда не входят ни на одной стадии, это материал работы, а не документация.
            </p>

            <div className="stack" style={{ gap: 28 }}>
              {documents.map((group) => (
                <div key={group.stage}>
                  <div className="row" style={{ gap: 10, alignItems: 'baseline' }}>
                    <h3 style={{ margin: 0 }}>
                      {DOC_STAGE_LABELS[group.stage as DocStage] ?? group.stage}
                    </h3>
                    <span className={group.approved ? 'tag tag-pass' : 'tag tag-wait'}>
                      {group.approved ? 'подтверждена вами' : 'ждёт вашего подтверждения'}
                    </span>
                  </div>

                  <div className="stack" style={{ gap: 8, marginTop: 14 }}>
                    {group.files.map((file, i) => (
                      <div
                        key={`${file.name}-${i}`}
                        className="row"
                        style={{ gap: 12, alignItems: 'baseline' }}
                      >
                        {file.url ? (
                          <a href={file.url} target="_blank" rel="noreferrer noopener">
                            {file.name}
                          </a>
                        ) : (
                          <span>{file.name}</span>
                        )}
                        <span className="dim" style={{ fontSize: '0.82rem' }}>
                          {DISCIPLINE_LABELS[file.discipline] ?? file.discipline} ·{' '}
                          {ARTIFACT_KIND_LABELS[file.kind] ?? file.kind}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {invoices.length > 0 && (
          <>
            <div className="divider" style={{ marginTop: 48 }} />

            <h2>Счета</h2>
            <p className="muted" style={{ marginTop: 12, marginBottom: 24, maxWidth: '62ch' }}>
              Стадия оплачивается до начала работы по ней. Команда — живые люди, и их время
              начинается в тот момент, когда открывается задача; начинать стадию в долг бюро не
              вправе. Цена названа целиком заранее и не пересчитывается по ходу: под каждым
              счётом видно, из чего он сложился.
            </p>

            <div className="stack" style={{ gap: 16 }}>
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className={invoice.status === 'issued' ? 'panel panel-accent' : 'panel'}
                >
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="label label-accent">{DOC_STAGE_LABELS[invoice.stage]}</span>
                    <span className="tag">
                      {invoice.status === 'paid'
                        ? 'Оплачен'
                        : invoice.status === 'void'
                          ? 'Отозван'
                          : 'Ждёт оплаты'}
                    </span>
                  </div>

                  <div className="num" style={{ fontSize: '2rem', marginTop: 12 }}>
                    {invoice.amount.toLocaleString('ru-RU')} {invoice.currency}
                  </div>

                  {invoice.basis && (
                    <p className="dim" style={{ marginTop: 10, fontSize: '0.85rem' }}>
                      {invoice.basis.atFloor ? (
                        <>
                          Нижняя граница чека за эту стадию — {invoice.basis.floor}{' '}
                          {invoice.currency}. По площади вышло бы меньше, но посадка на участок,
                          согласования и координация команды на маленьком объекте стоят почти
                          столько же, сколько на большом.
                        </>
                      ) : (
                        <>
                          {invoice.basis.areaSqm} м² × {invoice.basis.ratePerSqm} {invoice.currency}
                          /м²
                          {invoice.basis.typologyFactor !== 1 &&
                            ` × ${invoice.basis.typologyFactor} за общие системы дома`}
                          {invoice.basis.jurisdictionFactor !== 1 &&
                            ` × ${invoice.basis.jurisdictionFactor} по уровню цен страны`}
                        </>
                      )}
                    </p>
                  )}

                  {invoice.status === 'issued' && (
                    <p className="hint" style={{ marginTop: 12, marginBottom: 0 }}>
                      Реквизиты пришлёт бюро. Отметку об оплате ставит оно же, увидев
                      поступление: приёма платежей на сайте нет, и делать вид, что есть, значило
                      бы обещать сверку, которой не существует.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

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
