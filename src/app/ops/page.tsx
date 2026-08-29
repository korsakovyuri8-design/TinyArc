import Link from 'next/link'
import { ALERT_ACTIONS, ALERT_LABELS, alertAudience, projectHeat } from '@/engine/pm'
import type { Discipline } from '@/engine/taxonomy'
import { prisma } from '@/lib/db'
import { DISCIPLINE_LABELS } from '@/lib/labels'
import { alertsForBureau } from '@/lib/services/pm'
import { lostProjects } from '@/lib/services/demand'
import { ANSWER_SLA_HOURS, waitingQuestions } from '@/lib/services/dialogue'
import { roleName } from '@/lib/gap'
import { JURISDICTION_NAMES } from '@/engine/taxonomy'
import { isOperator } from '@/lib/session'
import { planBureauQueue } from './actions'
import { OpsAction, OpsSignIn } from './OpsForms'

export const metadata = { title: 'Панель бюро — TinyArc Cloud Bureau' }

export default async function OpsPage() {
  if (!(await isOperator())) {
    return (
      <section style={{ paddingTop: 'clamp(48px, 8vw, 96px)' }}>
        <div className="shell" style={{ maxWidth: 460 }}>
          <span className="eyebrow">Панель бюро</span>
          <h1>Вход</h1>
          <p className="muted" style={{ marginTop: 16 }}>
            Панель закрывает разбор заявок, постановку задач и приёмку. Права назначить
            специалиста в команду она не даёт никому — такого поля нет в схеме.
          </p>
          <div style={{ marginTop: 32 }}>
            <OpsSignIn />
          </div>
        </div>
      </section>
    )
  }

  const [pending, active, projects, openTickets, submitted, alerts] = await Promise.all([
    prisma.specialist.count({ where: { status: 'pending' } }),
    prisma.specialist.count({ where: { status: 'active' } }),
    prisma.project.count(),
    prisma.ticket.count({ where: { status: 'open' } }),
    prisma.ticket.count({ where: { status: 'submitted' } }),
    alertsForBureau(),
  ])

  const [lost, questions] = await Promise.all([lostProjects(), waitingQuestions()])

  const conflicts = alerts.filter((a) => a.kind === 'conflict')
  const heat = projectHeat(alerts)
  const titles = new Map(alerts.map((a) => [a.projectId, a.projectTitle]))

  return (
    <section style={{ paddingTop: 'clamp(40px, 7vw, 72px)' }}>
      <div className="shell">
        <span className="eyebrow">Панель бюро</span>
        <h1>Что сейчас на столе</h1>

        <div className="grid grid-3" style={{ marginTop: 40 }}>
          <Tile value={pending} label="заявок на разборе" href="/ops/applications" accent={pending > 0} />
          <Tile value={active} label="в пуле" href="/ops/pool" />
          <Tile value={projects} label="проектов" href="/ops/projects" />
          <Tile value={submitted} label="ждут приёмки" href="/ops/projects" accent={submitted > 0} />
          <Tile value={openTickets} label="тикетов в работе" href="/ops/projects" />
        </div>

        <div className="divider" style={{ marginTop: 48 }} />

        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2>Цифровой менеджер</h2>
          {conflicts.length > 0 && (
            <span className="tag tag-fail">Conflict Detected · {conflicts.length}</span>
          )}
        </div>
        <p className="muted" style={{ marginTop: 12, marginBottom: 24 }}>
          Он следит и сигналит — не чертит и не считает нагрузки. Чертежи делают люди, которых
          подобрал алгоритм; задача менеджера — чтобы эстафета не вставала.
        </p>

        {alerts.length === 0 ? (
          <p className="dim">Тихо: сроки в порядке, всё взято в работу, приёмка не копится.</p>
        ) : (
          <>
            {heat.length > 1 && (
              <div className="stack" style={{ gap: 8, marginBottom: 24 }}>
                <div className="label">Где встало</div>
                {heat.map((h) => (
                  <div key={h.projectId} className="row" style={{ gap: 12, alignItems: 'baseline' }}>
                    <Link href={`/ops/projects/${h.projectId}`}>{titles.get(h.projectId)}</Link>
                    <span className="dim" style={{ fontSize: '0.85rem' }}>
                      {ALERT_LABELS[h.worst].toLowerCase()} · сигналов {h.total} · {Math.round(h.hours)} ч
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginBottom: 24 }}>
              <OpsAction action={planBureauQueue} label="Разобрать очередь" />
              <p className="hint" style={{ marginTop: 8 }}>
                Помощник переведёт очередь в список действий на сегодня. Порядок срочности
                считает движок — помощник его не пересчитывает.
              </p>
            </div>
          </>
        )}

        {alerts.length > 0 && (
          <div className="table-scroll panel" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Сигнал</th>
                  <th>Задача</th>
                  <th>Проект</th>
                  <th>Часов</th>
                  <th>Кому</th>
                  <th>Что делать</th>
                </tr>
              </thead>
              <tbody>
                {alerts.slice(0, 20).map((alert) => (
                  <tr key={`${alert.ticketId}-${alert.kind}`}>
                    <td>
                      <span
                        className={`tag ${alert.kind === 'conflict' || alert.kind === 'overdue' ? 'tag-fail' : 'tag-wait'}`}
                      >
                        {ALERT_LABELS[alert.kind]}
                      </span>
                    </td>
                    <td>
                      <Link href={`/ops/projects/${alert.projectId}`}>{alert.title}</Link>
                      <br />
                      <span className="dim" style={{ fontSize: '0.8rem' }}>
                        {DISCIPLINE_LABELS[alert.discipline as Discipline] ?? alert.discipline}
                      </span>
                    </td>
                    <td className="dim">{alert.projectTitle}</td>
                    <td className="num dim">{Math.round(alert.hours)}</td>
                    <td className="dim">
                      {alertAudience(alert.kind) === 'bureau' ? 'бюро' : 'специалисту'}
                    </td>
                    <td className="dim">{ALERT_ACTIONS[alert.kind]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="divider" style={{ marginTop: 48 }} />

        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2>Заказчики ждут ответа</h2>
          {questions.length > 0 && (
            <span className="tag tag-fail">{questions.length}</span>
          )}
        </div>
        <p className="muted" style={{ marginTop: 12, marginBottom: 24, maxWidth: '62ch' }}>
          Единственный канал, который есть у заказчика, и его контрагент — мы. Молчание здесь
          читается не как занятость, а как то, что проектом никто не занимается.
        </p>

        {questions.length === 0 ? (
          <p className="dim">Вопросов без ответа нет.</p>
        ) : (
          <div className="stack" style={{ gap: 16 }}>
            {questions.map((q) => (
              <div
                key={q.projectId}
                className="panel"
                style={{ borderColor: q.hours > ANSWER_SLA_HOURS ? 'var(--fail)' : undefined }}
              >
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <Link href={`/ops/projects/${q.projectId}`}>{q.projectTitle}</Link>
                  <span className={q.hours > ANSWER_SLA_HOURS ? 'tag tag-fail' : 'tag tag-wait'}>
                    {Math.round(q.hours)} ч
                    {q.count > 1 && ` · сообщений ${q.count}`}
                  </span>
                </div>
                <p style={{ marginTop: 12, marginBottom: 0, whiteSpace: 'pre-wrap' }}>{q.body}</p>
              </div>
            ))}
          </div>
        )}

        <div className="divider" style={{ marginTop: 48 }} />

        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2>Не смогли взять</h2>
          {lost.length > 0 && <span className="tag tag-fail">{lost.length}</span>}
        </div>
        <p className="muted" style={{ marginTop: 12, marginBottom: 24, maxWidth: '62ch' }}>
          Брифы, под которые состав не собрался. Это не список ошибок, а список найма — и
          самый дорогой, какой есть: не «кого бы нанять вообще», а за какой заказ нам уже
          заплатили бы, будь у нас этот человек.
        </p>

        {lost.length === 0 ? (
          <p className="dim">Все брифы, дошедшие до прогона, собрались.</p>
        ) : (
          <div className="table-scroll panel" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Проект</th>
                  <th>Страна</th>
                  <th>Кого не хватило</th>
                  <th>Ждёт</th>
                </tr>
              </thead>
              <tbody>
                {lost.map((row) => (
                  <tr key={row.projectId}>
                    <td>{row.title}</td>
                    <td className="dim">{JURISDICTION_NAMES[row.jurisdiction] ?? row.jurisdiction}</td>
                    <td>
                      {row.outcome === 'no_signatory' ? (
                        <span className="tag tag-fail">некому подписать</span>
                      ) : row.gap ? (
                        <span className="dim" style={{ fontSize: '0.85rem' }}>
                          {roleName(row.gap)}
                          {row.gap.candidates > 0 && ` · кандидатов ${row.gap.candidates}`}
                        </span>
                      ) : (
                        <span className="dim">состав не сошёлся</span>
                      )}
                    </td>
                    <td className="num dim">
                      {Math.max(0, Math.floor((Date.now() - row.since.getTime()) / 86_400_000))} дн.
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="divider" style={{ marginTop: 48 }} />

        <div className="stack" style={{ gap: 10 }}>
          <Link href="/ops/applications">Заявки специалистов →</Link>
          <Link href="/ops/import">Импорт базы специалистов →</Link>
          <Link href="/ops/pool">Пул и метрики →</Link>
          <Link href="/ops/projects">Проекты и прогоны →</Link>
        </div>
      </div>
    </section>
  )
}

function Tile({
  value,
  label,
  href,
  accent,
}: {
  value: number
  label: string
  href: string
  accent?: boolean
}) {
  return (
    <Link
      href={href}
      className="panel"
      style={{ display: 'block', color: 'var(--text)', borderColor: accent ? 'var(--accent)' : undefined }}
    >
      <div className="num" style={{ fontSize: '2.4rem', color: accent ? 'var(--accent)' : 'var(--text)' }}>
        {value}
      </div>
      <div className="label">{label}</div>
    </Link>
  )
}
