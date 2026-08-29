'use client'

import { useMemo, useState } from 'react'
import { assemble } from '@/engine/assemble'
import { planTickets } from '@/engine/relay'
import {
  CLIMATE_ZONES,
  DOC_STAGES,
  GRID_CONNECTIONS,
  JURISDICTIONS,
  JURISDICTION_NAMES,
  LANGUAGES,
  LANGUAGE_NAMES,
  MATERIAL_SYSTEMS,
  MAX_STOREYS,
  PORTFOLIO_THRESHOLD,
  SOFTWARE,
  TERRAINS,
  TYPOLOGIES,
  requiredRoles,
  type ClimateZone,
  type Discipline,
  type DocStage,
  type GridConnection,
  type Jurisdiction,
  type Language,
  type MaterialSystem,
  type RequiredRole,
  type Software,
  type Terrain,
  type Typology,
} from '@/engine/taxonomy'
import type { GateName, ProjectRequirements } from '@/engine/types'
import { demoActivePool } from '@/lib/demo-pool'
import {
  CLIMATE_LABELS,
  DISCIPLINE_LABELS,
  GATE_LABELS,
  DOC_STAGE_LABELS,
  GRID_LABELS,
  MATERIAL_LABELS,
  SOFTWARE_LABELS,
  SPECIALIZATION_LABELS,
  TERRAIN_LABELS,
  TYPOLOGY_LABELS,
} from '@/lib/labels'
import { BreakdownRow } from './Breakdown'
import { fill } from '@/lib/fill'

const DEFAULT: ProjectRequirements = {
  typology: 'villa',
  storeys: 2,
  areaSqm: 420,
  jurisdiction: 'ME',
  climateZone: 'mediterranean',
  materialSystem: 'concrete',
  regulatoryTrack: 'light',
  targetStage: 'permit',
  terrain: 'flat',
  gridConnection: 'grid',
  software: ['archicad'],
  languages: ['en'],
  requiredHoursPerWeek: 10,
  horizonDays: 45,
  utcOffset: 1,
}

export function AlgorithmDemo() {
  return (
          <Demo />
  )
}

/**
 * Сам прогон. Отдельным компонентом, потому что переводчик берётся из
 * контекста, а провайдер обязан стоять выше того, кто его читает.
 */
function Demo() {
  const [requirements, setRequirements] = useState<ProjectRequirements>(DEFAULT)
  const pool = useMemo(() => demoActivePool(), [])
  const assembly = useMemo(() => assemble(pool, requirements), [pool, requirements])

  const required = requiredRoles({
    typology: requirements.typology,
    targetStage: requirements.targetStage,
    materialSystem: requirements.materialSystem,
    terrain: requirements.terrain,
    gridConnection: requirements.gridConnection,
  })

  const [focus, setFocus] = useState<Discipline>('architecture')
  const focusedRole = required.find((r) => r.discipline === focus) ?? required[0]
  const focused = focusedRole.discipline

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

  const tickets =
    assembly.outcome === 'ok'
      ? planTickets(requirements.targetStage, assembly.team.map((m) => m.discipline))
      : []

  return (
    <div>
      {/* --- Вход ---------------------------------------------------------- */}
      <div className="panel" style={{ marginBottom: 40 }}>
        <div className="label label-accent">Project requirements</div>

        <div className="grid grid-3" style={{ marginTop: 20, gap: 18 }}>
          <Field label="Typology">
            <select
              value={requirements.typology}
              onChange={(e) => patch({ typology: e.target.value as Typology })}
            >
              {TYPOLOGIES.map((value) => (
                <option key={value} value={value}>
                  {TYPOLOGY_LABELS[value]}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Storeys"
            hint={fill('Product boundary — {n}', { n: MAX_STOREYS })}
          >
            <input
              type="number"
              min={1}
              max={8}
              value={requirements.storeys}
              onChange={(e) => patch({ storeys: Number(e.target.value) })}
            />
          </Field>

          <Field label="Floor area, m²">
            <input
              type="number"
              min={40}
              step={10}
              value={requirements.areaSqm}
              onChange={(e) => patch({ areaSqm: Number(e.target.value) })}
            />
          </Field>

          <Field label="Country">
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

          <Field label="Climate">
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

          <Field label="Material">
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

          <Field label="Documentation stage">
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

          <Field label="Site" hint="A slope calls for grading and drainage">
            <select
              value={requirements.terrain}
              onChange={(e) => patch({ terrain: e.target.value as Terrain })}
            >
              {TERRAINS.map((value) => (
                <option key={value} value={value}>
                  {TERRAIN_LABELS[value]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Utilities">
            <select
              value={requirements.gridConnection}
              onChange={(e) => patch({ gridConnection: e.target.value as GridConnection })}
            >
              {GRID_CONNECTIONS.map((g) => (
                <option key={g} value={g}>
                  {GRID_LABELS[g]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Workload, h/week">
            <input
              type="number"
              min={1}
              max={40}
              value={requirements.requiredHoursPerWeek}
              onChange={(e) => patch({ requiredHoursPerWeek: Number(e.target.value) })}
            />
          </Field>

          <Field label="Start within, days">
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
          <Field label="Project software" hint="An empty list leaves the exchange unrestricted">
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

          <Field label="Client languages">
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
            We are not taking this project
          </div>
          <p style={{ marginTop: 12, marginBottom: 0 }}>{assembly.notes}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-3" style={{ marginBottom: 28 }}>
            <Counter value={assembly.pooledCount} label="in the pool" />
            <Counter value={assembly.survivedCount} label="passed the gates" accent />
            <Counter value={required.length} label="roles on the team" />
          </div>

          <div className="row" style={{ gap: 8, marginBottom: 20 }}>
            {required.map((r) => (
              <button
                key={r.discipline}
                type="button"
                className={r.discipline === focused ? 'btn' : 'btn btn-quiet'}
                style={{ padding: '9px 16px' }}
                onClick={() => setFocus(r.discipline)}
              >
                {DISCIPLINE_LABELS[r.discipline]}
              </button>
            ))}
          </div>

          <div className="panel" style={{ marginBottom: 40 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="label">
                {fill('What cut down “{discipline}”', {
                  discipline: DISCIPLINE_LABELS[focused],
                })}
              </span>
              <span className="num dim">
                {fill('{count} in the discipline', { count: inDiscipline.length })}
              </span>
            </div>
            <div className="stack" style={{ marginTop: 16 }}>
              {[...funnel.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([gate, count]) => (
                  <div key={gate} className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="muted" style={{ fontSize: '0.88rem' }}>
                      {fill(GATE_LABELS[gate], { threshold: PORTFOLIO_THRESHOLD })}
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
                <span className="label label-accent">Left</span>
                <span className="num" style={{ color: 'var(--accent)' }}>
                  {passed.length}
                </span>
              </div>
            </div>
            <p className="hint" style={{ marginTop: 16 }}>
              {describeRole(focusedRole)}{' '}
              {fill(
                'The portfolio threshold is {threshold}/10, and it stands before scoring: a gate, not a term in the sum.',
                { threshold: PORTFOLIO_THRESHOLD },
              )}
            </p>
          </div>

          {/* --- Стадия 2: Score --------------------------------------------- */}
          <Stage index={2} name="Score" internal="Assemble" />

          {passed.length === 0 ? (
            <div className="note note-fail">No one is left in this discipline. The team does not assemble — relax the requirements or widen the pool.</div>
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
                      <span className="tag tag-accent">signing rights</span>
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
                        <th>Role</th>
                        <th>Specialist</th>
                        <th>Software</th>
                        <th style={{ textAlign: 'right' }}>Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assembly.team.map((member) => (
                        <tr key={member.discipline}>
                          <td>
                            {DISCIPLINE_LABELS[member.discipline]}
                            {member.role.specializations.length > 0 && (
                              <>
                                <br />
                                <span className="dim" style={{ fontSize: '0.78rem' }}>
                                  {member.role.specializations
                                    .map((x) => SPECIALIZATION_LABELS[x])
                                    .join(member.role.mode === 'all' ? ' + ' : ' / ')}
                                </span>
                              </>
                            )}
                          </td>
                          <td>
                            {member.specialist.displayName}
                            {member.isSignatory && (
                              <span className="tag tag-accent" style={{ marginLeft: 10 }}>
                                signatory
                              </span>
                            )}
                          </td>
                          <td className="dim">
                            {member.specialist.software
                              .map((s) => SOFTWARE_LABELS[s])
                              .join(', ')}
                          </td>
                          <td className="num" style={{ textAlign: 'right', color: 'var(--accent)' }}>
                            {(member.score * 10).toFixed(1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="panel">
                <div className="label">
                  Ticket graph · Blind Relay Protocol
                </div>
                <p className="hint" style={{ marginTop: 10, marginBottom: 18 }}>A ticket does not open until the ones it depends on are accepted. Direct chats between specialists do not exist.</p>
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
                          {DOC_STAGE_LABELS[ticket.stage]} ·{' '}
                          {DISCIPLINE_LABELS[ticket.discipline]}
                          {ticket.dependsOn.length > 0 && ' · waits for: '}
                          {unique(
                            ticket.dependsOn.map((k) =>
                              DISCIPLINE_LABELS[k.split(':')[1] as Discipline],
                            ),
                          ).join(', ')}
                        </span>
                      </span>
                      <span className="tag">
                        {fill('{hours} h', { hours: ticket.slaHours })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <div className="panel" style={{ borderColor: 'var(--fail)' }}>
              <div className="label" style={{ color: 'var(--fail)' }}>
                The team did not assemble
              </div>
              <p style={{ marginTop: 12, marginBottom: 0 }}>{assembly.notes}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)]
}

function describeRole(role: RequiredRole): string {
  if (role.specializations.length === 0) return 'This role needs no specialisation.'

  const list = role.specializations
    .map((s) => SPECIALIZATION_LABELS[s])
    .join(role.mode === 'all' ? ' + ' : ' or ')

  return fill(
    role.mode === 'all' ? 'The role requires all of it at once: {list}.' : 'The role requires a specialisation: {list}.',
    { list },
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
        internal stage name — {internal}
      </span>
    </div>
  )
}
