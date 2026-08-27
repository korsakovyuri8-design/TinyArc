import Link from 'next/link'
import { redirect } from 'next/navigation'
import { DISCIPLINE_LABELS, DOC_STAGE_LABELS, PROJECT_STATUS_LABELS, TICKET_STATUS_LABELS, TYPOLOGY_LABELS, OUTCOME_LABELS } from '@/lib/labels'
import { JURISDICTION_NAMES, type Discipline, type DocStage, type Jurisdiction, type Typology } from '@/engine/taxonomy'
import { BreakdownRow } from '@/components/Breakdown'
import { prisma } from '@/lib/db'
import { latestRun } from '@/lib/services/matching'
import { currentProjectId } from '@/lib/session'

export const metadata = { title: 'Кабинет проекта — TinyArc Cloud Bureau' }

export default async function ProjectPage() {
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

  const run = await latestRun(project.id)
  const team = run?.slots ?? []

  return (
    <section style={{ paddingTop: 'clamp(40px, 7vw, 72px)' }}>
      <div className="shell">
        <span className="eyebrow">Кабинет проекта</span>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h1 style={{ maxWidth: '18ch' }}>{project.title}</h1>
          <span className="tag tag-accent">{PROJECT_STATUS_LABELS[project.status] ?? project.status}</span>
        </div>

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
          <div className="panel" style={{ borderColor: 'var(--fail)', marginTop: 40 }}>
            <div className="label" style={{ color: 'var(--fail)' }}>
              {OUTCOME_LABELS[run.outcome] ?? run.outcome}
            </div>
            <p style={{ marginTop: 12, marginBottom: 0 }}>{run.notes}</p>
          </div>
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
