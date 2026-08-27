import { asHundred } from '@/engine/score'
import type { ScoreBreakdown } from '@/engine/types'

/**
 * Разбор балла (концепт, п.9).
 *
 * Показывается целиком и всегда: прозрачность здесь — не любезность, а способ
 * не отдавать клиенту право выбирать специалиста самому.
 */
export function BreakdownRow({ breakdown }: { breakdown: ScoreBreakdown }) {
  const historyPercent = Math.round(breakdown.historyWeight * 100)
  const hundred = asHundred(breakdown)

  return (
    <div className="stack" style={{ gap: 8 }}>
      <Line
        label="Портфолио"
        value={breakdown.portfolioRating.toFixed(1)}
        fill={breakdown.portfolioRating / 10}
      />
      {breakdown.historyWeight > 0 ? (
        <Line
          label={`Поставка · вес ${historyPercent}%`}
          value={breakdown.deliveryScore.toFixed(1)}
          fill={breakdown.deliveryScore / 10}
        />
      ) : (
        <div className="dim" style={{ fontSize: '0.78rem' }}>
          Истории поставок нет — Quality это портфолио
        </div>
      )}
      <Line
        label="Соответствие проекту"
        value={breakdown.relevance.toFixed(2)}
        fill={breakdown.relevance}
      />
      <Line
        label="Доступность"
        value={breakdown.availability.toFixed(2)}
        fill={breakdown.availability}
      />
      <div
        style={{
          borderTop: '1px solid var(--border-strong)',
          paddingTop: 8,
          marginTop: 2,
        }}
      >
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="label">
            Skill {hundred.skill.toFixed(0)} × Availability {hundred.availability.toFixed(2)}
          </span>
          <span className="num" style={{ color: 'var(--accent)', fontSize: '1.05rem' }}>
            {hundred.final.toFixed(1)}
          </span>
        </div>
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
          <span className="dim" style={{ fontSize: '0.78rem' }}>
            Совпадение с проектом
          </span>
          <span className="num dim" style={{ fontSize: '0.78rem' }}>
            {hundred.matchPercent}%
          </span>
        </div>
      </div>
    </div>
  )
}

function Line({ label, value, fill }: { label: string; value: string; fill: number }) {
  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
        <span className="dim" style={{ fontSize: '0.78rem' }}>
          {label}
        </span>
        <span className="num dim" style={{ fontSize: '0.78rem' }}>
          {value}
        </span>
      </div>
      <div className="bar bar-dim" style={{ marginTop: 4 }}>
        <span style={{ width: `${Math.min(100, Math.max(0, fill * 100))}%` }} />
      </div>
    </div>
  )
}
