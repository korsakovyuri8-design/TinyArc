import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  RULE_LAYERS,
  RULE_SUBJECTS,
  STALE_AFTER_DAYS,
  type RuleLayer,
} from '@/engine/compliance'
import { JURISDICTIONS, JURISDICTION_NAMES, type Jurisdiction } from '@/engine/taxonomy'
import { HEADER, MAX_RULE_ROWS } from '@/lib/norms/parse'
import { RULE_LAYER_LABELS, RULE_SUBJECT_LABELS } from '@/lib/labels'
import { RULES_SHOWN, listRules, municipalitiesWithRules } from '@/lib/services/norms'
import { fill } from '@/lib/fill'
import { isOperator } from '@/lib/session'
import { OpsAction } from '../OpsForms'
import { addNorm, checkNorm, previewNorms, removeNorm, runNorms } from '../actions'

export const metadata = { title: 'Norms — bureau panel' }

export default async function NormsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (!(await isOperator())) redirect('/ops')

  const params = await searchParams
  const one = (key: string): string => {
    const value = params[key]
    return (Array.isArray(value) ? value[0] : value)?.trim() ?? ''
  }

  const jurisdiction = JURISDICTIONS.includes(one('country') as never) ? one('country') : ''
  const layer = RULE_LAYERS.includes(one('layer') as never) ? one('layer') : ''
  const staleOnly = one('stale') === '1'
  const now = new Date()

  const [{ rows, total, stale }, municipalities] = await Promise.all([
    listRules({ jurisdiction, layer, staleOnly }, now),
    municipalitiesWithRules(),
  ])

  return (
    <section style={{ paddingTop: 'clamp(40px, 7vw, 72px)' }}>
      <div className="shell">
        <span className="eyebrow">Bureau panel</span>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h1>Norms</h1>
          <Link href="/ops" className="btn btn-quiet">
            ← panel
          </Link>
        </div>

        <p className="muted" style={{ marginTop: 14, maxWidth: '64ch' }}>Every rule carries its source: document, article, the date it takes effect and the date we last checked it against the original. That is not paperwork. A rule with no source cannot be defended in front of an authority and cannot be re-checked when the norm changes — and it will change.</p>

        <p className="hint" style={{ marginTop: 12, maxWidth: '64ch' }}>
          {fill(
            'A rule is never edited in place. A norm does not get corrected, it gets replaced — and the replacement has its own effective date. A set issued last month was computed against last month’s rule, and overwriting the value would destroy the answer to “what did we compute against”. Add the new edition as a new rule; the engine picks between them by date and by how narrow the scope is. Checking against the source is a separate act: it moves the check date and nothing else, and a rule goes unverified {days} days after it.',
            { days: STALE_AFTER_DAYS },
          )}
        </p>

        <div className="grid grid-3" style={{ marginTop: 32 }}>
          <Stat value={String(total)} label="rules stored" />
          <Stat value={String(rows.length)} label="shown" note={total > RULES_SHOWN ? 'narrow with the filters' : 'all of them'} />
          <Stat
            value={String(stale)}
            label="not checked in a year"
            warn={stale > 0}
            note={stale > 0 ? 'they still apply, but nobody has confirmed them' : 'the corpus is current'}
          />
        </div>

        <form method="get" className="panel" style={{ marginTop: 28 }}>
          <div className="grid grid-3" style={{ gap: 16 }}>
            <div className="field">
              <label htmlFor="country">Country</label>
              <select id="country" name="country" defaultValue={jurisdiction}>
                <option value="">Any</option>
                {JURISDICTIONS.map((value) => (
                  <option key={value} value={value}>
                    {JURISDICTION_NAMES[value as Jurisdiction]}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="layer">Layer</label>
              <select id="layer" name="layer" defaultValue={layer}>
                <option value="">Any</option>
                {RULE_LAYERS.map((value) => (
                  <option key={value} value={value}>
                    {RULE_LAYER_LABELS[value] ?? value}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="stale">Checked</label>
              <select id="stale" name="stale" defaultValue={staleOnly ? '1' : ''}>
                <option value="">Any</option>
                <option value="1">Unverified only</option>
              </select>
            </div>
          </div>

          <button type="submit" className="btn btn-quiet" style={{ marginTop: 16 }}>
            Narrow
          </button>
        </form>

        <div className="divider" style={{ marginTop: 44 }} />

        <h2>Add a corpus</h2>
        <p className="muted" style={{ marginTop: 12, marginBottom: 20, maxWidth: '62ch' }}>
          {fill(
            'Paste a table with exactly these columns, up to {rows} rows at a time. Nothing is guessed here — unlike the specialist import, where a wrong column costs one uncalled specialist. A norm read out of the wrong column travels into a documentation set under our signature and surfaces as a refusal six months later.',
            { rows: MAX_RULE_ROWS },
          )}
        </p>

        <pre
          className="panel dim"
          style={{ padding: 16, overflowX: 'auto', fontSize: '0.78rem', marginBottom: 20 }}
        >
          {HEADER}
        </pre>

        <div className="panel">
          <OpsAction action={previewNorms} label="Check the table">
            <textarea
              id="norm-preview"
              name="table"
              rows={6}
              placeholder={HEADER}
              style={{ marginBottom: 10, fontFamily: 'var(--mono)', fontSize: '0.8rem' }}
            />
          </OpsAction>
        </div>

        <div className="panel" style={{ marginTop: 16 }}>
          <OpsAction action={runNorms} label="Add them" solid>
            <textarea
              id="norm-run"
              name="table"
              rows={6}
              placeholder={HEADER}
              style={{ marginBottom: 10, fontFamily: 'var(--mono)', fontSize: '0.8rem' }}
            />
          </OpsAction>
        </div>

        <div className="divider" style={{ marginTop: 44 }} />

        <h2>Add one rule</h2>
        <p className="muted" style={{ marginTop: 12, marginBottom: 20, maxWidth: '62ch' }}>Zoning has to name a municipality: there is no such thing as a country-level setback. A rule written at country level would apply silently in every town whose own plan says otherwise. The engineering layers do generalise — Eurocodes with national annexes, EPBD, EN — and are written once.</p>

        <div className="panel">
          <OpsAction action={addNorm} label="Add the rule" solid>
            <div className="grid grid-3" style={{ gap: 16, marginBottom: 14 }}>
              <div className="field">
                <label htmlFor="layer-new">Layer</label>
                <select id="layer-new" name="layer" defaultValue="zoning">
                  {RULE_LAYERS.map((value) => (
                    <option key={value} value={value}>
                      {RULE_LAYER_LABELS[value] ?? value}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="jurisdiction-new">Country</label>
                <select id="jurisdiction-new" name="jurisdiction" defaultValue="ME">
                  {JURISDICTIONS.map((value) => (
                    <option key={value} value={value}>
                      {JURISDICTION_NAMES[value as Jurisdiction]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="municipality-new">Municipality</label>
                <input
                  id="municipality-new"
                  name="municipality"
                  list="known-municipalities"
                  placeholder="Tivat"
                />
                <datalist id="known-municipalities">
                  {municipalities.map((value) => (
                    <option key={value} value={value} />
                  ))}
                </datalist>
              </div>

              <div className="field">
                <label htmlFor="zone-new">Zone</label>
                <input id="zone-new" name="zone" placeholder="optional" />
              </div>

              <div className="field">
                <label htmlFor="subject-new">Subject</label>
                <select id="subject-new" name="subject" defaultValue="height_m">
                  {RULE_SUBJECTS.map((value) => (
                    <option key={value} value={value}>
                      {RULE_SUBJECT_LABELS[value] ?? value}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="operator-new">Operator</label>
                <select id="operator-new" name="operator" defaultValue="max">
                  <option value="max">max — not more than</option>
                  <option value="min">min — not less than</option>
                </select>
              </div>

              <div className="field">
                <label htmlFor="value-new">Value</label>
                <input id="value-new" name="value" placeholder="10.5" />
              </div>

              <div className="field">
                <label htmlFor="effectiveFrom-new">Effective from</label>
                <input id="effectiveFrom-new" name="effectiveFrom" placeholder="2024-01-01" />
              </div>

              <div className="field">
                <label htmlFor="checkedAt-new">Checked on</label>
                <input id="checkedAt-new" name="checkedAt" placeholder="2026-09-05" />
              </div>
            </div>

            <div className="grid grid-2" style={{ gap: 16, marginBottom: 14 }}>
              <div className="field">
                <label htmlFor="document-new">Document</label>
                <input id="document-new" name="document" placeholder="Prostorno-urbanistički plan" />
              </div>

              <div className="field">
                <label htmlFor="article-new">Article</label>
                <input id="article-new" name="article" placeholder="čl. 42" />
              </div>
            </div>

            <div className="field" style={{ marginBottom: 14 }}>
              <label htmlFor="url-new">Source URL</label>
              <input id="url-new" name="url" placeholder="https://" />
            </div>
          </OpsAction>
        </div>

        <div className="divider" style={{ marginTop: 44 }} />

        <h2>The corpus</h2>

        {rows.length === 0 ? (
          <div className="note" style={{ marginTop: 20 }}>No rules stored for this filter. An empty corpus is shown to the client as “we hold no rules here”, never as “everything checks out”: silence here reads as permission and costs a refusal six months later.</div>
        ) : (
          <div className="stack" style={{ gap: 14, marginTop: 20 }}>
            {rows.map((rule) => (
              <div
                key={rule.id}
                className="panel"
                style={{ borderColor: rule.stale ? 'var(--fail)' : undefined }}
              >
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div>
                    <span className="label label-accent">
                      {RULE_SUBJECT_LABELS[rule.subject] ?? rule.subject}
                    </span>
                    <span className="num" style={{ marginLeft: 12 }}>
                      {rule.operator} {rule.value}
                    </span>
                  </div>
                  <span className={rule.stale ? 'tag tag-fail' : 'tag tag-pass'}>
                    {rule.stale ? 'unverified' : 'checked'}
                  </span>
                </div>

                <div className="dim" style={{ fontSize: '0.82rem', marginTop: 8 }}>
                  {RULE_LAYER_LABELS[rule.layer as RuleLayer] ?? rule.layer} ·{' '}
                  {JURISDICTION_NAMES[rule.jurisdiction] ?? rule.jurisdiction}
                  {rule.municipality && ` · ${rule.municipality}`}
                  {rule.zone && ` · ${rule.zone}`}
                </div>

                <div className="dim" style={{ fontSize: '0.82rem', marginTop: 8 }}>
                  {rule.url ? (
                    <a href={rule.url} target="_blank" rel="noreferrer noopener">
                      {rule.document}
                    </a>
                  ) : (
                    rule.document
                  )}
                  {' · '}
                  {rule.article} · in force from {rule.effectiveFrom.toISOString().slice(0, 10)} ·
                  checked {rule.checkedAt.toISOString().slice(0, 10)}
                </div>

                <div className="row" style={{ gap: 20, marginTop: 14, alignItems: 'flex-start' }}>
                  <OpsAction
                    action={checkNorm}
                    hidden={{ ruleId: rule.id }}
                    label="Checked against the source today"
                  />
                  <OpsAction action={removeNorm} hidden={{ ruleId: rule.id }} label="Remove" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function Stat({
  value,
  label,
  note,
  warn,
}: {
  value: string
  label: string
  note?: string
  warn?: boolean
}) {
  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
      <div className="num" style={{ fontSize: '1.6rem', color: warn ? 'var(--fail)' : undefined }}>
        {value}
      </div>
      <div className="label" style={{ marginTop: 6 }}>
        {label}
      </div>
      {note && (
        <div className="dim" style={{ fontSize: '0.8rem', marginTop: 4 }}>
          {note}
        </div>
      )}
    </div>
  )
}
