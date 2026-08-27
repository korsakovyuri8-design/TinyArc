'use client'

import { useMemo, useState } from 'react'
import { assemble } from '@/engine/assemble'
import { GATE_LABELS } from '@/engine/filter'
import { planTickets } from '@/engine/relay'
import {
  CLIMATE_ZONES,
  DOC_STAGES,
  JURISDICTIONS,
  JURISDICTION_NAMES,
  LANGUAGES,
  LANGUAGE_NAMES,
  MATERIAL_SYSTEMS,
  MAX_STOREYS,
  PORTFOLIO_THRESHOLD,
  SOFTWARE,
  TYPOLOGIES,
  requiredDisciplines,
  type ClimateZone,
  type Discipline,
  type DocStage,
  type Jurisdiction,
  type Language,
  type MaterialSystem,
  type Software,
  type Typology,
} from '@/engine/taxonomy'
import type { GateName, ProjectRequirements } from '@/engine/types'
import { demoActivePool } from '@/lib/demo-pool'
import {
  CLIMATE_LABELS,
  DISCIPLINE_LABELS,
  DOC_STAGE_LABELS,
  MATERIAL_LABELS,
  SOFTWARE_LABELS,
  TYPOLOGY_LABELS,
} from '@/lib/labels'
import { BreakdownRow } from './Breakdown'

const DEFAULT: ProjectRequirements = {
  typology: 'villa',
  storeys: 2,
  areaSqm: 420,
  jurisdiction: 'ME',
  climateZone: 'mediterranean',
  materialSystem: 'concrete',
  regulatoryTrack: 'light',
  targetStage: 'permit',
  software: ['archicad'],
  languages: ['en'],
  requiredHoursPerWeek: 10,
  horizonDays: 45,
  utcOffset: 1,
}

export function AlgorithmDemo() {
  const [requirements, setRequirements] = useState<ProjectRequirements>(DEFAULT)
  const pool = useMemo(() => demoActivePool(), [])
  const assembly = useMemo(() => assemble(pool, requirements), [pool, requirements])

  const required = requiredDisciplines(requirements.typology, requirements.targetStage)
  const [focus, setFocus] = useState<Discipline>('architecture')
  const focused = required.includes(focus) ? focus : required[0]

  const inFocus = assembly.candidates.filter((c) => c.discipline === focused)
  const passed = inFocus.filter((c) => c.passed).sort((a, b) => a.rank - b.rank)

  /*
   * Воронка считается по тем, кто в этой дисциплине вообще работает.
   *
   * Иначе она сообщает пустое: конструктор не прошёл гейт архитектуры — это не
   * отсев, это другая профессия. Движку такой порядок проверок не мешает (гейт
   * дисциплины там стоит вторым и работает), а показывать его в воронке незачем.
   */
  const inDiscipline = inFocus.filter((c) => c.specialist.disciplines.includes(focused))

  const funnel = new Map<GateName, number>()
  for (const candidate of inDiscipline) {
    if (candidate.failedGate) funnel.set(candidate.failedGate, (funnel.get(candidate.failedGate) ?? 0) + 1)
  }

  const patch = (next: Partial<ProjectRequirements>) =>
    setRequirements((current) => ({ ...current, ...next }))

  const tickets = assembly.outcome === 'ok' ? planTickets(
    requirements.typology,
    requirements.targetStage,
    assembly.team.map((m) => m.discipline),
  ) : []

  return (
    <div>
      {/* --- Вход ---------------------------------------------------------- */}
      <div className="panel" style={{ marginBottom: 40 }}>
        <div className="label label-accent">Требования проекта</div>

        <div className="grid grid-3" style={{ marginTop: 20, gap: 18 }}>
          <Field label="Типология">
            <select
              value={requirements.typology}
              onChange={(e) => patch({ typology: e.target.value as Typology })}
            >
              {TYPOLOGIES.map((t) => (
                <option key={t} value={t}>
                  {TYPOLOGY_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Этажей" hint={`Продуктовая граница — ${MAX_STOREYS}`}>
            <input
              type="number"
              min={1}
              max={8}
              value={requirements.storeys}
              onChange={(e) => patch({ storeys: Number(e.target.value) })}
            />
          </Field>

          <Field label="Площадь, м²">
            <input
              type="number"
              min={40}
              step={10}
              value={requirements.areaSqm}
              onChange={(e) => patch({ areaSqm: Number(e.target.value) })}
            />
          </Field>

          <Field label="Страна">
            <select
              value={requirements.jurisdiction}
              onChange={(e) => patch({ jurisdiction: e.target.value as Jurisdiction })}
            >
              {JURISDICTIONS.map((j) => (
                <option key={j} value={j}>
                  {JURISDICTION_NAMES[j]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Климат">
            <select
              value={requirements.climateZone}
              onChange={(e) => patch({ climateZone: e.target.value as ClimateZone })}
            >
              {CLIMATE_ZONES.map((c) => (
                <option key={c} value={c}>
                  {CLIMATE_LABELS[c]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Материал">
            <select
              value={requirements.materialSystem}
              onChange={(e) => patch({ materialSystem: e.target.value as MaterialSystem })}
            >
              {MATERIAL_SYSTEMS.map((m) => (
                <option key={m} value={m}>
                  {MATERIAL_LABELS[m]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Стадия документации">
            <select
              value={requirements.targetStage}
              onChange={(e) => patch({ targetStage: e.target.value as DocStage })}
            >
              {DOC_STAGES.map((s) => (
                <option key={s} value={s}>
                  {DOC_STAGE_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Занятость, ч/нед">
            <input
              type="number"
              min={1}
              max={40}
              value={requirements.requiredHoursPerWeek}
              onChange={(e) => patch({ requiredHoursPerWeek: Number(e.target.value) })}
            />
          </Field>

          <Field label="Горизонт, дней">
            <input
              type="number"
              min={7}
              max={180}
              value={requirements.horizonDays}
              onChange={(e) => patch({ horizonDays: Number(e.target.value) })}
            />
          </Field>
        </div>

        <div className="grid grid-2" style={{ marginTop: 8, gap: 18 }}>
          <Field label="Софт проекта" hint="Пустой список — обмен не ограничен">
            <div className="choices">
              {SOFTWARE.map((s) => (
                <label key={s} className="choice">
                  <input
                    type="checkbox"
                    checked={requirements.software.includes(s)}
                    onChange={(e) =>
                      patch({
                        software: e.target.checked
                          ? [...requirements.software, s]
                          : requirements.software.filter((x) => x !== s),
                      })
                    }
                  />
                  {SOFTWARE_LABELS[s]}
                </label>
              ))}
            </div>
          </Field>

          <Field label="Языки клиента">
            <div className="choices">
              {LANGUAGES.map((l) => (
                <label key={l} className="choice">
                  <input
                    type="checkbox"
                    checked={requirements.languages.includes(l)}
                    onChange={(e) =>
                      patch({
                        languages: e.target.checked
                          ? [...requirements.languages, l]
                          : requirements.languages.filter((x) => x !== l),
                      })
                    }
                  />
                  {LANGUAGE_NAMES[l as Language]}
                </label>
              ))}
            </div>
          </Field>
        </div>
      </div>

      {/* --- Стадия 1: Filter ---------------------------------------------- */}
      <Stage index={1} name="Filter" internal="Validate" />

      {assembly.outcome === 'rejected' ? (
        <div className="panel" style={{ borderColor: 'var(--fail)' }}>
          <div className="label" style={{ color: 'var(--fail)' }}>
            Проект не берётся
          </div>
          <p style={{ marginTop: 12, marginBottom: 0 }}>{assembly.notes}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-3" style={{ marginBottom: 28 }}>
            <Counter value={assembly.pooledCount} label="в пуле" />
            <Counter value={assembly.survivedCount} label="прошли гейты" accent />
            <Counter value={required.length} label="дисциплин нужно" />
          </div>

          <div className="row" style={{ gap: 8, marginBottom: 20 }}>
            {required.map((d) => (
              <button
                key={d}
                type="button"
                className={d === focused ? 'btn' : 'btn btn-quiet'}
                style={{ padding: '9px 16px' }}
                onClick={() => setFocus(d)}
              >
                {DISCIPLINE_LABELS[d]}
              </button>
            ))}
          </div>

          <div className="panel" style={{ marginBottom: 40 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="label">
                Что отсекло дисциплину «{DISCIPLINE_LABELS[focused]}»
              </span>
              <span className="num dim">{inDiscipline.length} в дисциплине</span>
            </div>
            <div className="stack" style={{ marginTop: 16 }}>
              {[...funnel.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([gate, count]) => (
                  <div key={gate} className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="muted" style={{ fontSize: '0.88rem' }}>
                      {GATE_LABELS[gate]}
                    </span>
                    <span className="num dim">−{count}</span>
                  </div>
                ))}
              <div
                className="row"
                style={{
                  justifyContent: 'space-between',
                  borderTop: '1px solid var(--border-strong)',
                  paddingTop: 10,
                }}
              >
                <span className="label label-accent">Осталось</span>
                <span className="num" style={{ color: 'var(--accent)' }}>
                  {passed.length}
                </span>
              </div>
            </div>
            <p className="hint" style={{ marginTop: 16 }}>
              Порог по портфолио — {PORTFOLIO_THRESHOLD}/10. Он стоит до скоринга, а не внутри
              него: это гейт, а не слагаемое.
            </p>
          </div>

          {/* --- Стадия 2: Score --------------------------------------------- */}
          <Stage index={2} name="Score" internal="Assemble" />

          {passed.length === 0 ? (
            <div className="note note-fail">
              В этой дисциплине не осталось никого. Команда не собирается — ослабьте требования
              или расширьте пул.
            </div>
          ) : (
            <div className="grid grid-2" style={{ marginBottom: 40 }}>
              {passed.slice(0, 6).map((candidate) => (
                <div
                  key={candidate.specialist.id}
                  className={candidate.rank === 1 ? 'panel panel-accent' : 'panel'}
                >
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="num dim">#{candidate.rank}</span>
                    {candidate.specialist.signsIn.includes(requirements.jurisdiction) && (
                      <span className="tag tag-accent">право подписи</span>
                    )}
                  </div>
                  <h3 style={{ marginTop: 8, marginBottom: 14 }}>
                    {candidate.specialist.displayName}
                  </h3>
                  <BreakdownRow breakdown={candidate.breakdown} />
                </div>
              ))}
            </div>
          )}

          {/* --- Стадия 3: Relay --------------------------------------------- */}
          <Stage index={3} name="Relay" internal="Deliver" />

          {assembly.outcome === 'ok' ? (
            <>
              <div className="panel panel-raised" style={{ marginBottom: 28 }}>
                <div className="label label-accent">Tiny Team</div>
                <div className="table-scroll" style={{ marginTop: 16 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Дисциплина</th>
                        <th>Специалист</th>
                        <th>Софт</th>
                        <th style={{ textAlign: 'right' }}>Балл</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assembly.team.map((member) => (
                        <tr key={member.discipline}>
                          <td>{DISCIPLINE_LABELS[member.discipline]}</td>
                          <td>
                            {member.specialist.displayName}
                            {member.isSignatory && (
                              <span className="tag tag-accent" style={{ marginLeft: 10 }}>
                                подпись
                              </span>
                            )}
                          </td>
                          <td className="dim">
                            {member.specialist.software.map((s) => SOFTWARE_LABELS[s]).join(', ')}
                          </td>
                          <td className="num" style={{ textAlign: 'right', color: 'var(--accent)' }}>
                            {member.score.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="panel">
                <div className="label">Граф тикетов · Blind Relay Protocol</div>
                <p className="hint" style={{ marginTop: 10, marginBottom: 18 }}>
                  Тикет не открывается, пока не приняты те, от которых он зависит. Прямых чатов
                  между специалистами не существует.
                </p>
                <ul className="clean">
                  {tickets.map((ticket, i) => (
                    <li
                      key={ticket.key}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '28px 1fr auto',
                        gap: 14,
                        padding: '11px 0',
                        borderBottom:
                          i === tickets.length - 1 ? 'none' : '1px solid var(--border)',
                        alignItems: 'baseline',
                      }}
                    >
                      <span className="num dim">{String(i + 1).padStart(2, '0')}</span>
                      <span>
                        {ticket.title}
                        <br />
                        <span className="dim" style={{ fontSize: '0.8rem' }}>
                          {DOC_STAGE_LABELS[ticket.stage]} · {DISCIPLINE_LABELS[ticket.discipline]}
                          {ticket.dependsOn.length > 0 && ' · ждёт: '}
                          {ticket.dependsOn
                            .map((k) => DISCIPLINE_LABELS[k.split(':')[1] as Discipline])
                            .join(', ')}
                        </span>
                      </span>
                      <span className="tag">{ticket.slaDays} дн.</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <div className="panel" style={{ borderColor: 'var(--fail)' }}>
              <div className="label" style={{ color: 'var(--fail)' }}>
                Команда не собрана
              </div>
              <p style={{ marginTop: 12, marginBottom: 0 }}>{assembly.notes}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="field" style={{ marginBottom: 0 }}>
      <label>{label}</label>
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  )
}

function Counter({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <div style={{ borderTop: '1px solid var(--border-strong)', paddingTop: 14 }}>
      <div
        className="num"
        style={{ fontSize: '2rem', color: accent ? 'var(--accent)' : 'var(--text)' }}
      >
        {value}
      </div>
      <div className="label">{label}</div>
    </div>
  )
}

function Stage({ index, name, internal }: { index: number; name: string; internal: string }) {
  return (
    <div className="row" style={{ gap: 14, alignItems: 'baseline', margin: '0 0 20px' }}>
      <span className="num" style={{ color: 'var(--accent)' }}>
        {String(index).padStart(2, '0')}
      </span>
      <h3 style={{ fontFamily: 'var(--mono)', letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '0.95rem' }}>
        {name}
      </h3>
      <span className="dim" style={{ fontSize: '0.85rem' }}>
        внутреннее имя стадии — {internal}
      </span>
    </div>
  )
}
