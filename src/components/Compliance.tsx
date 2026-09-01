/**
 * Что нормы говорят о проекте.
 *
 * Показывается одинаково заказчику и бюро: правило принадлежит участку, а не
 * чьему-то экрану. Четыре исхода различимы глазом, потому что различие между
 * ними и есть весь смысл: «прошло» и «нечем проверить» — это разные новости,
 * и одинаково зелёными они быть не должны.
 */

import { fill } from '@/lib/fill'
import { RULE_SUBJECT_LABELS, RULE_SUBJECT_UNIT, SITE_INPUT_LABELS } from '@/lib/labels'
import type { Finding } from '@/engine/compliance'

export type ComplianceView = {
  findings: Finding[]
  blocking: Finding[]
  missing: string[]
  covered: boolean
}

/** Число в том виде, в котором его написали в норме. */
function shown(value: number, subject: string): string {
  const unit = RULE_SUBJECT_UNIT[subject] ?? 'count'
  if (unit === 'ratio') return `${Math.round(value * 100)}%`
  if (unit === 'metres') return `${Number(value.toFixed(2))} m`
  return String(Number(value.toFixed(2)))
}

function Tone({ finding }: { finding: Finding }) {
  if (finding.verdict === 'needs_input') return <span className="tag tag-wait">needs input</span>
  if (finding.verdict === 'fail') return <span className="tag tag-fail">over the limit</span>
  return <span className="tag tag-pass">within</span>
}

export function Compliance({ view, audience }: { view: ComplianceView; audience: 'client' | 'bureau' }) {
  /*
   * Пустая база — это не «всё в порядке», и сказано это прямо. Молчание на
   * непокрытом муниципалитете читается как разрешение, а стоит оно отказом
   * органа через полгода.
   */
  if (!view.covered) {
    return (
      <div className="panel" style={{ marginTop: 40 }}>
        <div className="label">Local rules</div>
        <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
          {audience === 'client'
            ? 'We do not yet hold the planning rules for this municipality, so nothing here has been checked against them. That is our gap, not a verdict on your project: the bureau checks it by hand meanwhile.'
            : 'No rules stored for this area. Nothing was checked — this is a gap in the corpus, not a passing project.'}
        </p>
      </div>
    )
  }

  const passed = view.findings.filter((f) => f.verdict === 'pass')
  const stale = view.findings.filter((f) => f.stale)

  return (
    <div className="panel" style={{ marginTop: 40 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div className="label label-accent">Local rules</div>
        <span className="num dim" style={{ fontSize: '0.85rem' }}>
          {fill('{passed} of {total} within', { passed: passed.length, total: view.findings.length })}
        </span>
      </div>

      <p className="muted" style={{ marginTop: 12, marginBottom: 20 }}>
        {audience === 'client'
          ? 'Checked against the planning rules of your municipality. This is where most refusals come from, and it costs nothing to find out now instead of after submission.'
          : 'Computed against the stored rules for this area. Every rule carries its source and the date it was last verified.'}
      </p>

      <div className="table-scroll" style={{ margin: '0 -22px' }}>
        <table>
          <thead>
            <tr>
              <th>Rule</th>
              <th>Limit</th>
              <th>This project</th>
              <th>State</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {view.findings.map((finding) => (
              <tr key={finding.rule.id}>
                <td>{RULE_SUBJECT_LABELS[finding.rule.subject] ?? finding.rule.subject}</td>
                <td className="num dim">
                  {finding.rule.operator === 'max' ? '≤ ' : '≥ '}
                  {shown(finding.rule.value, finding.rule.subject)}
                </td>
                <td className="num">
                  {finding.actual === undefined ? '—' : shown(finding.actual, finding.rule.subject)}
                </td>
                <td>
                  <Tone finding={finding} />
                  {/*
                    Устаревшая сверка помечается рядом с исходом, а не вместо
                    него: правило продолжает считаться, но доверять ему как
                    проверенному нельзя, и человек должен видеть оба факта.
                  */}
                  {finding.stale && (
                    <span className="tag" style={{ marginLeft: 8 }}>
                      not verified
                    </span>
                  )}
                </td>
                <td className="dim" style={{ fontSize: '0.82rem' }}>
                  {finding.rule.source.document} · {finding.rule.source.article}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {view.missing.length > 0 && (
        <p className="hint" style={{ marginTop: 18, marginBottom: 0 }}>
          {fill('To finish the check we need: {what}.', {
            what: view.missing.map((key) => SITE_INPUT_LABELS[key] ?? key).join(', '),
          })}{' '}
          {audience === 'client'
            ? 'Some of it only exists once there is a design — the check completes itself as the project develops.'
            : 'Part of it appears with the concept stage.'}
        </p>
      )}

      {stale.length > 0 && (
        <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
          {fill(
            '{count} rule(s) here have not been re-verified against the source within our window, so they do not block anything. The bureau re-checks them.',
            { count: stale.length },
          )}
        </p>
      )}
    </div>
  )
}
