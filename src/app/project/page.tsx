import Link from 'next/link'
import { fill } from '@/lib/fill'
import { pageMetadata } from '@/lib/metadata'
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

export const metadata = pageMetadata('Project workspace')

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
        <span className="eyebrow">Project workspace</span>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h1 style={{ maxWidth: '18ch' }}>{project.title}</h1>
          <span className="tag tag-accent">{PROJECT_STATUS_LABELS[project.status] ?? project.status}</span>
        </div>

        {issued === '1' && (
          <div className="panel panel-accent" style={{ marginTop: 32 }}>
            <div className="label label-accent">Save your access key</div>
            <p
              className="num"
              style={{ fontSize: '1.4rem', color: 'var(--accent)', margin: '14px 0' }}
            >
              {project.clientKey}
            </p>
            <p className="muted" style={{ marginBottom: 0 }}>
              {fill(
                'The key replaces a password: it gets you back into this workspace from any device. A copy went to {email} — but if that email never arrives, this screen is all there is.',
                { email: project.clientEmail },
              )}
            </p>
          </div>
        )}

        <div className="grid grid-3" style={{ marginTop: 36 }}>
          <Fact label="Typology" value={TYPOLOGY_LABELS[project.typology as Typology]} />
          <Fact label="Storeys / area" value={`${project.storeys} · ${project.areaSqm} m²`} />
          <Fact label="Country" value={JURISDICTION_NAMES[project.jurisdiction as Jurisdiction]} />
          <Fact label="Documentation stage" value={DOC_STAGE_LABELS[project.targetStage as DocStage]} />
          <Fact label="Access key" value={project.clientKey} mono />
          <Fact
            label="Pool → passed the gates"
            value={run ? `${run.pooledCount} → ${run.survivedCount}` : '—'}
            mono
          />
        </div>

        {project.status === 'rejected' && (
          <div className="panel" style={{ borderColor: 'var(--fail)', marginTop: 40 }}>
            <div className="label" style={{ color: 'var(--fail)' }}>We are not taking this project</div>
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
            <div className="label label-accent">Project closed</div>
            <h3 style={{ marginTop: 12 }}>The set is yours</h3>
            <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
              Every stage has been issued and confirmed by you. The files below are what you came for. Your key keeps working: the workspace does not close with the project, and you can come back to the documentation whenever you need it.
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
              No design direction has been chosen yet.{' '}
              <Link href="/project/direction">Choose →</Link>
            </div>
          )
        )}

        {project.tickets.length > 0 && (
          <>
            <div className="divider" style={{ marginTop: 48 }} />
            <h2>Where the project stands</h2>
            <p className="muted" style={{ marginTop: 12, marginBottom: 28 }}>A stage closes once every task in it is accepted. Stages cannot be skipped: the gate simply will not open the next one.</p>

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
                        ? 'Stage closed'
                        : inStage.some((t) => t.status !== 'blocked')
                          ? 'In progress'
                          : unpaid.has(stage)
                            ? 'Awaiting payment'
                            : 'Waiting on the previous stage'}
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
            <h2>Your Tiny Team</h2>
            <p className="muted" style={{ marginTop: 12 }}>The engine assembled this team. Below is the full score breakdown for each member: portfolio rating, the weight of delivery metrics, fit to the project, availability factor.</p>

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
                      {slot.isSignatory && <span className="tag tag-accent">signatory</span>}
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
            <h2>Production</h2>
            <p className="muted" style={{ marginTop: 12, marginBottom: 28 }}>A ticket opens only once the tickets it depends on are accepted. Specialists do not correspond with each other — all work goes through the bureau.</p>

            <div className="table-scroll panel" style={{ padding: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Stage</th>
                    <th>Task</th>
                    <th>Discipline</th>
                    <th>Assignee</th>
                    <th>State</th>
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
          <Link href="/algorithm" className="btn btn-quiet">How the selection was computed</Link>
        </div>

        {fileCount(documents) > 0 && (
          <>
            <div className="divider" style={{ marginTop: 48 }} />

            <h2>Documentation set</h2>
            <p className="muted" style={{ marginTop: 12, marginBottom: 24, maxWidth: '60ch' }}>It builds up as stages close rather than arriving all at once at the end: you paid for a stage, you get its files when that stage closes. Generated images never form part of it at any stage — they are working material, not documentation.</p>

            <div className="stack" style={{ gap: 28 }}>
              {documents.map((group) => (
                <div key={group.stage}>
                  <div className="row" style={{ gap: 10, alignItems: 'baseline' }}>
                    <h3 style={{ margin: 0 }}>
                      {DOC_STAGE_LABELS[group.stage as DocStage] ?? group.stage}
                    </h3>
                    <span className={group.approved ? 'tag tag-pass' : 'tag tag-wait'}>
                      {group.approved ? 'confirmed by you' : 'awaiting your confirmation'}
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

            <h2>Invoices</h2>
            <p className="muted" style={{ marginTop: 12, marginBottom: 24, maxWidth: '62ch' }}>A stage is paid for before work on it begins. The team are real people, and their time starts the moment a task opens; the bureau is not entitled to begin a stage on credit. The price is stated in full up front and is not recalculated along the way: under every invoice you can see what it is made of.</p>

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
                        ? 'Paid'
                        : invoice.status === 'void'
                          ? 'Voided'
                          : 'Awaiting payment'}
                    </span>
                  </div>

                  <div className="num" style={{ fontSize: '2rem', marginTop: 12 }}>
                    {invoice.amount.toLocaleString('ru-RU')} {invoice.currency}
                  </div>

                  {invoice.basis && (
                    <p className="dim" style={{ marginTop: 10, fontSize: '0.85rem' }}>
                      {invoice.basis.atFloor ? (
                        <>
                          {fill(
                            'The floor price for this stage is {floor} {currency}. By area it would come out lower, but siting, approvals and team coordination on a small building cost almost as much as on a large one.',
                            { floor: invoice.basis.floor, currency: invoice.currency },
                          )}
                        </>
                      ) : (
                        <>
                          {invoice.basis.areaSqm} m² × {invoice.basis.ratePerSqm}{' '}
                          {invoice.currency}/m²
                          {invoice.basis.typologyFactor !== 1 &&
                            ` × ${invoice.basis.typologyFactor} for shared building systems`}
                          {invoice.basis.jurisdictionFactor !== 1 &&
                            ` × ${invoice.basis.jurisdictionFactor} for the country’s price level`}
                        </>
                      )}
                    </p>
                  )}

                  {invoice.status === 'issued' && (
                    <>
                      {payTo ? (
                        <div style={{ marginTop: 16 }}>
                          <div className="label">Where to pay</div>
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
                        <p className="hint" style={{ marginTop: 12, marginBottom: 0 }}>Payment details have not been published yet — the bureau will send them by email.</p>
                      )}

                      <p className="hint" style={{ marginTop: 12, marginBottom: 0 }}>The bureau marks an invoice paid once it sees the money arrive: there is no payment processing on this site, and pretending otherwise would promise a reconciliation that does not exist.</p>
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

            <h2>Awaiting your confirmation</h2>
            <p className="muted" style={{ marginTop: 12, marginBottom: 24, maxWidth: '60ch' }}>The bureau has accepted every task in this stage — that means “done as specified”. Your confirmation means something else: “this is what was specified”. Until it arrives, the next stage does not start.</p>

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
            <h2>You have confirmed</h2>
            <div className="row" style={{ gap: 10, marginTop: 16 }}>
              {approved.map((s) => (
                <span key={s} className="tag tag-pass">
                  {DOC_STAGE_LABELS[s as DocStage] ?? s}
                </span>
              ))}
            </div>
            <p className="hint" style={{ marginTop: 14, maxWidth: '60ch' }}>The team is working to what you confirmed. If something has to change after the fact, write to the bureau: rework at a later stage costs more, and how to handle it is a decision we make together.</p>
          </>
        )}

        <div className="divider" style={{ marginTop: 48 }} />

        <h2>Talking to the bureau</h2>
        <p className="muted" style={{ marginTop: 12, marginBottom: 24, maxWidth: '60ch' }}>Deadlines, the site, changed circumstances — all of it goes here. The bureau answers to you for the project as a whole, and a question about the project is a question for the bureau.</p>

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
                  {m.authorRole === 'bureau' ? 'Bureau' : 'You'} ·{' '}
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
  /** Переводчик приходит сверху: это не страница, а её часть. */
}) {
  if (outcome === 'no_signatory') {
    return (
      <div className="panel" style={{ borderColor: 'var(--fail)', marginTop: 40 }}>
        <div className="label" style={{ color: 'var(--fail)' }}>The team is not assembled yet</div>
        <p style={{ marginTop: 12, marginBottom: 0 }}>
          {fill(
            
              'There are specialists for your project, but none of them holds signing rights in {country}. A documentation set without a local signature has no force — the authorities will not accept it, and taking the project on without one would mean selling you paper. The bureau is looking for a signatory; you have your key and can come back to the project with it.',
            { country: JURISDICTION_NAMES[jurisdiction] ?? jurisdiction },
          )}
        </p>
      </div>
    )
  }

  if (!gap) {
    return (
      <div className="panel" style={{ borderColor: 'var(--fail)', marginTop: 40 }}>
        <div className="label" style={{ color: 'var(--fail)' }}>The team is not assembled yet</div>
        <p style={{ marginTop: 12, marginBottom: 0 }}>A team for your project did not come together. The bureau is looking into it; you have your key and can come back to the project with it.</p>
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
