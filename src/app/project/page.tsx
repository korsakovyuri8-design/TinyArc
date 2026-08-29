import { Link } from '@/components/Link'
import { translator } from '@/lib/i18n'
import { pageMetadata } from '@/lib/i18n/metadata'
import { localeHref } from '@/lib/i18n/redirect'
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
import { artifactHref, isOurs } from '@/lib/artifacts'
import { invoicesOf } from '@/lib/services/billing'
import { company } from '@/lib/legal'
import { fileCount, packageOf } from '@/lib/services/package'
import { ClientDialogue, StageApproval } from './ClientDialogue'
import { clientExplanation, parseGap } from '@/lib/gap'
import { currentProjectId } from '@/lib/session'

export const generateMetadata = () => pageMetadata('Кабинет проекта')

export default async function ProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ issued?: string }>
}) {
  const { locale, t } = await translator()
  const { issued } = await searchParams
  const projectId = await currentProjectId()
  if (!projectId) redirect(await localeHref('/enter'))

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      tickets: {
        orderBy: { createdAt: 'asc' },
        include: { specialist: { select: { displayName: true } } },
      },
    },
  })

  if (!project) redirect(await localeHref('/enter'))

  const [run, direction, thread, pendingStages, approved, invoices] = await Promise.all([
    latestRun(project.id),
    chosenDirection(project.id),
    threadOf(project.id),
    stagesAwaitingClient(project.id),
    approvedStages(project.id),
    invoicesOf(project.id),
  ])

  const unpaid = new Set(invoices.filter((i) => i.status === 'issued').map((i) => i.stage))

  // Реквизиты и наименование берутся из настроек: см. src/lib/legal.ts.
  const details = company()
  const payTo = [details.name, details.bank].filter(Boolean).join('\n')

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
        <span className="eyebrow">{t('Кабинет проекта')}</span>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h1 style={{ maxWidth: '18ch' }}>{project.title}</h1>
          <span className="tag tag-accent">{t(PROJECT_STATUS_LABELS[project.status] ?? project.status)}</span>
        </div>

        {issued === '1' && (
          <div className="panel panel-accent" style={{ marginTop: 32 }}>
            <div className="label label-accent">{t('Сохраните ключ доступа')}</div>
            <p
              className="num"
              style={{ fontSize: '1.4rem', color: 'var(--accent)', margin: '14px 0' }}
            >
              {project.clientKey}
            </p>
            <p className="muted" style={{ marginBottom: 0 }}>
              {t('Ключ заменяет пароль: по нему вы вернётесь в кабинет с любого устройства. Копия ушла на N — но если письмо не дойдёт, останется только этот экран.').replace(
                'N',
                project.clientEmail,
              )}
            </p>
          </div>
        )}

        <div className="grid grid-3" style={{ marginTop: 36 }}>
          <Fact label={t('Типология')} value={t(TYPOLOGY_LABELS[project.typology as Typology])} />
          <Fact label={t('Этажей / площадь')} value={`${project.storeys} · ${project.areaSqm} ${t('м²')}`} />
          <Fact label={t('Страна')} value={t(JURISDICTION_NAMES[project.jurisdiction as Jurisdiction])} />
          <Fact label={t('Стадия документации')} value={t(DOC_STAGE_LABELS[project.targetStage as DocStage])} />
          <Fact label={t('Ключ доступа')} value={project.clientKey} mono />
          <Fact
            label={t('Пул → прошли гейты')}
            value={run ? `${run.pooledCount} → ${run.survivedCount}` : '—'}
            mono
          />
        </div>

        {project.status === 'rejected' && (
          <div className="panel" style={{ borderColor: 'var(--fail)', marginTop: 40 }}>
            <div className="label" style={{ color: 'var(--fail)' }}>{t('Проект не берётся')}</div>
            <p style={{ marginTop: 12, marginBottom: 0 }}>{project.rejectionReason}</p>
          </div>
        )}

        {run && run.outcome !== 'ok' && project.status !== 'rejected' && (
          <IncompleteRun
            outcome={run.outcome}
            gap={parseGap(run.gapJson)}
            jurisdiction={project.jurisdiction as Jurisdiction}
            t={t}
          />
        )}

        {project.status === 'delivered' && (
          <div className="panel panel-accent" style={{ marginTop: 40 }}>
            <div className="label label-accent">{t('Проект закрыт')}</div>
            <h3 style={{ marginTop: 12 }}>{t('Комплект у вас')}</h3>
            <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
              {t('Все стадии выпущены и подтверждены вами. Файлы ниже — то, за чем вы приходили. Доступ по ключу остаётся: кабинет не закрывается вместе с проектом, и вернуться к документации можно когда угодно.')}
              {nextStage && (
                <>
                  {' '}
                  Следующий шаг за этой границей —{' '}
                  <strong>{t(DOC_STAGE_LABELS[nextStage])}</strong>. Если он нужен, напишите
                  бюро: это отдельная работа и отдельный состав.
                </>
              )}
            </p>
          </div>
        )}

        {direction ? (
          <div style={{ marginTop: 40 }}>
            <ChosenDirection direction={direction} audience="client" t={t} />
          </div>
        ) : (
          project.status !== 'rejected' && (
            <div className="note" style={{ marginTop: 40 }}>
              {t('Направление проекта ещё не выбрано.')}{' '}
              <Link locale={locale} href="/project/direction">{t('Выбрать →')}</Link>
            </div>
          )
        )}

        {project.tickets.length > 0 && (
          <>
            <div className="divider" style={{ marginTop: 48 }} />
            <h2>{t('Где сейчас проект')}</h2>
            <p className="muted" style={{ marginTop: 12, marginBottom: 28 }}>{t('Стадия закрывается, когда приняты все её задачи. Пропустить стадию нельзя: гейт просто не откроет следующую.')}</p>

            <div className="grid grid-2">
              {stagesUpTo(project.targetStage as DocStage).map((stage) => {
                const inStage = project.tickets.filter((t) => t.stage === stage)
                const done = inStage.filter((t) => t.status === 'accepted').length
                const share = inStage.length === 0 ? 0 : done / inStage.length

                return (
                  <div key={stage} className="panel">
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span className="label label-accent">{t(DOC_STAGE_LABELS[stage])}</span>
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
                        ? t('Стадия закрыта')
                        : inStage.some((t) => t.status !== 'blocked')
                          ? t('Идёт работа')
                          : unpaid.has(stage)
                            ? t('Ждёт оплаты')
                            : t('Ждёт предыдущей стадии')}
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
            <h2>{t('Ваша Tiny Team')}</h2>
            <p className="muted" style={{ marginTop: 12 }}>{t('Состав собран движком. Ниже — разбор балла по каждому: рейтинг портфолио, вклад метрик поставки, соответствие проекту, фактор доступности.')}</p>

            <div className="grid grid-2" style={{ marginTop: 28 }}>
              {team.map((slot) => {
                const candidate = run.candidates.find(
                  (c) => c.specialistId === slot.specialistId && c.discipline === slot.discipline,
                )

                return (
                  <div key={slot.id} className="panel">
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span className="label label-accent">
                        {t(DISCIPLINE_LABELS[slot.discipline as Discipline])}
                      </span>
                      {slot.isSignatory && <span className="tag tag-accent">{t('подпись')}</span>}
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
                            .map((x) => t(SPECIALIZATION_LABELS[x]))
                            .join(slot.roleMode === 'all' ? ' + ' : ' / ')}
                        </div>
                      )
                    })()}
                    <h3 style={{ marginTop: 10, marginBottom: 16 }}>{slot.specialist.displayName}</h3>
                    {candidate && (
                      <BreakdownRow
                        t={t}
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
            <h2>{t('Выпуск')}</h2>
            <p className="muted" style={{ marginTop: 12, marginBottom: 28 }}>{t('Тикет открывается, только когда приняты те, от которых он зависит. Специалисты между собой не переписываются — вся работа идёт через бюро.')}</p>

            <div className="table-scroll panel" style={{ padding: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>{t('Стадия')}</th>
                    <th>{t('Задача')}</th>
                    <th>{t('Дисциплина')}</th>
                    <th>{t('Исполнитель')}</th>
                    <th>{t('Состояние')}</th>
                  </tr>
                </thead>
                <tbody>
                  {project.tickets.map((ticket) => (
                    <tr key={ticket.id}>
                      <td className="dim">{t(DOC_STAGE_LABELS[ticket.stage as DocStage])}</td>
                      <td>{t(ticket.title)}</td>
                      <td className="dim">{t(DISCIPLINE_LABELS[ticket.discipline as Discipline])}</td>
                      <td className="dim">{ticket.specialist?.displayName ?? '—'}</td>
                      <td>
                        <span className={`tag ${statusTone(ticket.status)}`}>
                          {t(TICKET_STATUS_LABELS[ticket.status] ?? ticket.status)}
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
          <Link locale={locale} href="/algorithm" className="btn btn-quiet">{t('Как считался отбор')}</Link>
        </div>

        {fileCount(documents) > 0 && (
          <>
            <div className="divider" style={{ marginTop: 48 }} />

            <h2>{t('Комплект документации')}</h2>
            <p className="muted" style={{ marginTop: 12, marginBottom: 24, maxWidth: '60ch' }}>{t('Собирается по мере закрытия стадий, а не выдаётся разом в конце: вы заплатили за стадию — вы получаете её файлы, когда она закрыта. Сгенерированные изображения сюда не входят ни на одной стадии, это материал работы, а не документация.')}</p>

            <div className="stack" style={{ gap: 28 }}>
              {documents.map((group) => (
                <div key={group.stage}>
                  <div className="row" style={{ gap: 10, alignItems: 'baseline' }}>
                    <h3 style={{ margin: 0 }}>
                      {t(DOC_STAGE_LABELS[group.stage as DocStage] ?? group.stage)}
                    </h3>
                    <span className={group.approved ? 'tag tag-pass' : 'tag tag-wait'}>
                      {group.approved ? t('подтверждена вами') : t('ждёт вашего подтверждения')}
                    </span>
                  </div>

                  <div className="stack" style={{ gap: 8, marginTop: 14 }}>
                    {group.files.map((file) => (
                      <div
                        key={file.id}
                        className="row"
                        style={{ gap: 12, alignItems: 'baseline' }}
                      >
                        {artifactHref(file) ? (
                          <a
                            href={artifactHref(file)}
                            {...(isOurs(file)
                              ? {}
                              : { target: '_blank', rel: 'noreferrer noopener' })}
                          >
                            {file.name}
                          </a>
                        ) : (
                          <span>{file.name}</span>
                        )}
                        <span className="dim" style={{ fontSize: '0.82rem' }}>
                          {t(DISCIPLINE_LABELS[file.discipline] ?? file.discipline)} ·{' '}
                          {t(ARTIFACT_KIND_LABELS[file.kind] ?? file.kind)}
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

            <h2>{t('Счета')}</h2>
            <p className="muted" style={{ marginTop: 12, marginBottom: 24, maxWidth: '62ch' }}>{t('Стадия оплачивается до начала работы по ней. Команда — живые люди, и их время начинается в тот момент, когда открывается задача; начинать стадию в долг бюро не вправе. Цена названа целиком заранее и не пересчитывается по ходу: под каждым счётом видно, из чего он сложился.')}</p>

            <div className="stack" style={{ gap: 16 }}>
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className={invoice.status === 'issued' ? 'panel panel-accent' : 'panel'}
                >
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="label label-accent">{t(DOC_STAGE_LABELS[invoice.stage])}</span>
                    <span className="tag">
                      {invoice.status === 'paid'
                        ? t('Оплачен')
                        : invoice.status === 'void'
                          ? t('Отозван')
                          : t('Ждёт оплаты')}
                    </span>
                  </div>

                  <div className="num" style={{ fontSize: '2rem', marginTop: 12 }}>
                    {invoice.amount.toLocaleString('ru-RU')} {invoice.currency}
                  </div>

                  {invoice.basis && (
                    <p className="dim" style={{ marginTop: 10, fontSize: '0.85rem' }}>
                      {invoice.basis.atFloor ? (
                        <>
                          {t('Нижняя граница чека за эту стадию — F C. По площади вышло бы меньше, но посадка на участок, согласования и координация команды на маленьком объекте стоят почти столько же, сколько на большом.')
                            .replace('F', String(invoice.basis.floor))
                            .replace('C', invoice.currency)}
                        </>
                      ) : (
                        <>
                          {invoice.basis.areaSqm} {t('м²')} × {invoice.basis.ratePerSqm}{' '}
                          {invoice.currency}/{t('м²')}
                          {invoice.basis.typologyFactor !== 1 &&
                            ` × ${invoice.basis.typologyFactor} ${t('за общие системы дома')}`}
                          {invoice.basis.jurisdictionFactor !== 1 &&
                            ` × ${invoice.basis.jurisdictionFactor} ${t('по уровню цен страны')}`}
                        </>
                      )}
                    </p>
                  )}

                  {invoice.status === 'issued' && (
                    <>
                      {payTo ? (
                        <div style={{ marginTop: 16 }}>
                          <div className="label">{t('Куда платить')}</div>
                          <p
                            className="dim"
                            style={{
                              marginTop: 8,
                              marginBottom: 0,
                              fontSize: '0.85rem',
                              whiteSpace: 'pre-line',
                            }}
                          >
                            {payTo}
                          </p>
                        </div>
                      ) : (
                        // Реквизитов нет — так и сказано. «Мы свяжемся» на счёте
                        // означает, что заплатить сейчас нельзя, и написать это
                        // прямо честнее, чем оставить человека гадать.
                        <p className="hint" style={{ marginTop: 12, marginBottom: 0 }}>{t('Реквизиты для оплаты ещё не опубликованы — бюро пришлёт их письмом.')}</p>
                      )}

                      <p className="hint" style={{ marginTop: 12, marginBottom: 0 }}>{t('Отметку об оплате ставит бюро, увидев поступление: приёма платежей на сайте нет, и делать вид, что есть, значило бы обещать сверку, которой не существует.')}</p>
                    </>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {pendingStages.length > 0 && (
          <>
            <div className="divider" style={{ marginTop: 48 }} />

            <h2>{t('Ждёт вашего подтверждения')}</h2>
            <p className="muted" style={{ marginTop: 12, marginBottom: 24, maxWidth: '60ch' }}>{t('Бюро приняло все задачи этой стадии — это значит «сделано как заказано». Подтверждение с вашей стороны значит другое: «заказано было именно это». Пока его нет, следующая стадия не начинается.')}</p>

            <div className="stack" style={{ gap: 24 }}>
              {pendingStages.map((stage) => (
                <div key={stage} className="panel panel-accent">
                  <div className="label label-accent">
                    {t(DOC_STAGE_LABELS[stage as DocStage] ?? stage)}
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <StageApproval
                      locale={locale}
                      stage={stage}
                      title={t(DOC_STAGE_LABELS[stage as DocStage] ?? stage)}
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
            <h2>{t('Вы подтвердили')}</h2>
            <div className="row" style={{ gap: 10, marginTop: 16 }}>
              {approved.map((s) => (
                <span key={s} className="tag tag-pass">
                  {t(DOC_STAGE_LABELS[s as DocStage] ?? s)}
                </span>
              ))}
            </div>
            <p className="hint" style={{ marginTop: 14, maxWidth: '60ch' }}>{t('Команда работает по подтверждённому. Если что-то нужно изменить задним числом — напишите бюро: переделка на поздней стадии стоит дороже, и решать, как её провести, будем вместе.')}</p>
          </>
        )}

        <div className="divider" style={{ marginTop: 48 }} />

        <h2>{t('Разговор с бюро')}</h2>
        <p className="muted" style={{ marginTop: 12, marginBottom: 24, maxWidth: '60ch' }}>{t('Сроки, участок, изменившиеся обстоятельства — всё это сюда. Бюро отвечает перед вами за проект целиком, и вопрос по проекту — это вопрос к нему.')}</p>

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
          <ClientDialogue locale={locale} />
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
  t,
}: {
  outcome: string
  gap: AssemblyGap | null
  jurisdiction: Jurisdiction
  /** Переводчик приходит сверху: это не страница, а её часть. */
  t: (text: string) => string
}) {
  if (outcome === 'no_signatory') {
    return (
      <div className="panel" style={{ borderColor: 'var(--fail)', marginTop: 40 }}>
        <div className="label" style={{ color: 'var(--fail)' }}>{t('Команда пока не собрана')}</div>
        <p style={{ marginTop: 12, marginBottom: 0 }}>
          {t(
            'Специалисты под ваш проект есть, но ни у кого из них нет права подписи в стране «N». Пакет документации без местной подписи не имеет силы — его не примут в органах, и браться за проект без неё значит продать вам бумагу. Бюро ищет подписанта; ключ доступа у вас, по нему вы вернётесь в проект.',
          ).replace('N', t(JURISDICTION_NAMES[jurisdiction] ?? jurisdiction))}
        </p>
      </div>
    )
  }

  if (!gap) {
    return (
      <div className="panel" style={{ borderColor: 'var(--fail)', marginTop: 40 }}>
        <div className="label" style={{ color: 'var(--fail)' }}>{t('Команда пока не собрана')}</div>
        <p style={{ marginTop: 12, marginBottom: 0 }}>{t('Состав под ваш проект не сошёлся. Бюро разбирается; ключ доступа у вас, по нему вы вернётесь в проект.')}</p>
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
