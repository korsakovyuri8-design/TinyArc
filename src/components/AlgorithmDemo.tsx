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
import { LocaleProvider, useT } from '@/lib/i18n/context'
import { fill } from '@/lib/i18n/fill'
import type { Locale } from '@/lib/i18n/locale'

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

export function AlgorithmDemo({ locale }: { locale: Locale }) {
  return (
    <LocaleProvider locale={locale}>
      <Demo />
    </LocaleProvider>
  )
}

/**
 * Сам прогон. Отдельным компонентом, потому что переводчик берётся из
 * контекста, а провайдер обязан стоять выше того, кто его читает.
 */
function Demo() {
  const t = useT()
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
        <div className="label label-accent">{t('Требования проекта')}</div>

        <div className="grid grid-3" style={{ marginTop: 20, gap: 18 }}>
          <Field label="Типология">
            <select
              value={requirements.typology}
              onChange={(e) => patch({ typology: e.target.value as Typology })}
            >
              {TYPOLOGIES.map((value) => (
                <option key={value} value={value}>
                  {t(TYPOLOGY_LABELS[value])}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Этажей"
            hint={fill(t('Продуктовая граница — {n}'), { n: MAX_STOREYS })}
          >
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
                  {t(JURISDICTION_NAMES[j])}
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
                  {t(CLIMATE_LABELS[c])}
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
                  {t(MATERIAL_LABELS[m])}
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
                  {t(DOC_STAGE_LABELS[s])}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Участок" hint="Склон требует вертикальной планировки">
            <select
              value={requirements.terrain}
              onChange={(e) => patch({ terrain: e.target.value as Terrain })}
            >
              {TERRAINS.map((value) => (
                <option key={value} value={value}>
                  {t(TERRAIN_LABELS[value])}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Сети">
            <select
              value={requirements.gridConnection}
              onChange={(e) => patch({ gridConnection: e.target.value as GridConnection })}
            >
              {GRID_CONNECTIONS.map((g) => (
                <option key={g} value={g}>
                  {t(GRID_LABELS[g])}
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
                  {t(SOFTWARE_LABELS[s])}
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
                  {t(LANGUAGE_NAMES[l as Language])}
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
            {t('Проект не берётся')}
          </div>
          <p style={{ marginTop: 12, marginBottom: 0 }}>{t(assembly.notes)}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-3" style={{ marginBottom: 28 }}>
            <Counter value={assembly.pooledCount} label="в пуле" />
            <Counter value={assembly.survivedCount} label="прошли гейты" accent />
            <Counter value={required.length} label="ролей в команде" />
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
                {t(DISCIPLINE_LABELS[r.discipline])}
              </button>
            ))}
          </div>

          <div className="panel" style={{ marginBottom: 40 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="label">
                {fill(t('Что отсекло дисциплину «{discipline}»'), {
                  discipline: t(DISCIPLINE_LABELS[focused]),
                })}
              </span>
              <span className="num dim">
                {fill(t('{count} в дисциплине'), { count: inDiscipline.length })}
              </span>
            </div>
            <div className="stack" style={{ marginTop: 16 }}>
              {[...funnel.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([gate, count]) => (
                  <div key={gate} className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="muted" style={{ fontSize: '0.88rem' }}>
                      {fill(t(GATE_LABELS[gate]), { threshold: PORTFOLIO_THRESHOLD })}
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
                <span className="label label-accent">{t('Осталось')}</span>
                <span className="num" style={{ color: 'var(--accent)' }}>
                  {passed.length}
                </span>
              </div>
            </div>
            <p className="hint" style={{ marginTop: 16 }}>
              {describeRole(focusedRole, t)}{' '}
              {fill(
                t('Порог по портфолио — {threshold}/10, и он стоит до скоринга: это гейт, а не слагаемое.'),
                { threshold: PORTFOLIO_THRESHOLD },
              )}
            </p>
          </div>

          {/* --- Стадия 2: Score --------------------------------------------- */}
          <Stage index={2} name="Score" internal="Assemble" />

          {passed.length === 0 ? (
            <div className="note note-fail">{t('В этой дисциплине не осталось никого. Команда не собирается — ослабьте требования или расширьте пул.')}</div>
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
                      <span className="tag tag-accent">{t('право подписи')}</span>
                    )}
                  </div>
                  <h3 style={{ marginTop: 8, marginBottom: 14 }}>
                    {candidate.specialist.displayName}
                  </h3>
                  <BreakdownRow breakdown={candidate.breakdown} t={t} />
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
                        <th>{t('Роль')}</th>
                        <th>{t('Специалист')}</th>
                        <th>{t('Софт')}</th>
                        <th style={{ textAlign: 'right' }}>{t('Балл')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assembly.team.map((member) => (
                        <tr key={member.discipline}>
                          <td>
                            {t(DISCIPLINE_LABELS[member.discipline])}
                            {member.role.specializations.length > 0 && (
                              <>
                                <br />
                                <span className="dim" style={{ fontSize: '0.78rem' }}>
                                  {member.role.specializations
                                    .map((x) => t(SPECIALIZATION_LABELS[x]))
                                    .join(member.role.mode === 'all' ? ' + ' : ' / ')}
                                </span>
                              </>
                            )}
                          </td>
                          <td>
                            {member.specialist.displayName}
                            {member.isSignatory && (
                              <span className="tag tag-accent" style={{ marginLeft: 10 }}>
                                {t('подпись')}
                              </span>
                            )}
                          </td>
                          <td className="dim">
                            {member.specialist.software
                              .map((s) => t(SOFTWARE_LABELS[s]))
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
                  {t('Граф тикетов')} · Blind Relay Protocol
                </div>
                <p className="hint" style={{ marginTop: 10, marginBottom: 18 }}>{t('Тикет не открывается, пока не приняты те, от которых он зависит. Прямых чатов между специалистами не существует.')}</p>
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
                        {t(ticket.title)}
                        <br />
                        <span className="dim" style={{ fontSize: '0.8rem' }}>
                          {t(DOC_STAGE_LABELS[ticket.stage])} ·{' '}
                          {t(DISCIPLINE_LABELS[ticket.discipline])}
                          {ticket.dependsOn.length > 0 && ` · ${t('ждёт:')} `}
                          {unique(
                            ticket.dependsOn.map((k) =>
                              t(DISCIPLINE_LABELS[k.split(':')[1] as Discipline]),
                            ),
                          ).join(', ')}
                        </span>
                      </span>
                      <span className="tag">
                        {fill(t('{hours} ч'), { hours: ticket.slaHours })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <div className="panel" style={{ borderColor: 'var(--fail)' }}>
              <div className="label" style={{ color: 'var(--fail)' }}>
                {t('Команда не собрана')}
              </div>
              <p style={{ marginTop: 12, marginBottom: 0 }}>{t(assembly.notes)}</p>
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

function describeRole(role: RequiredRole, t: (text: string) => string): string {
  if (role.specializations.length === 0) return t('Специализация в этой роли не требуется.')

  const list = role.specializations
    .map((s) => t(SPECIALIZATION_LABELS[s]))
    .join(role.mode === 'all' ? ' + ' : ` ${t('или')} `)

  return fill(
    t(role.mode === 'all' ? 'Роль требует всё сразу: {list}.' : 'Роль требует специализацию: {list}.'),
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
  const t = useT()

  return (
    <div className="field" style={{ marginBottom: 0 }}>
      <label>{t(label)}</label>
      {children}
      {hint && <div className="hint">{t(hint)}</div>}
    </div>
  )
}

function Counter({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  const t = useT()

  return (
    <div style={{ borderTop: '1px solid var(--border-strong)', paddingTop: 14 }}>
      <div
        className="num"
        style={{ fontSize: '2rem', color: accent ? 'var(--accent)' : 'var(--text)' }}
      >
        {value}
      </div>
      <div className="label">{t(label)}</div>
    </div>
  )
}

function Stage({ index, name, internal }: { index: number; name: string; internal: string }) {
  const t = useT()

  return (
    <div className="row" style={{ gap: 14, alignItems: 'baseline', margin: '0 0 20px' }}>
      <span className="num" style={{ color: 'var(--accent)' }}>
        {String(index).padStart(2, '0')}
      </span>
      <h3 style={{ fontFamily: 'var(--mono)', letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '0.95rem' }}>
        {name}
      </h3>
      <span className="dim" style={{ fontSize: '0.85rem' }}>
        {t('внутреннее имя стадии —')} {internal}
      </span>
    </div>
  )
}
