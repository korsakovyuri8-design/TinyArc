import Link from 'next/link'
import { fill } from '@/lib/fill'
import { STAGES } from '@/lib/labels'
import { MAX_STOREYS, PORTFOLIO_THRESHOLD, JURISDICTIONS, JURISDICTION_NAMES } from '@/engine/taxonomy'

export default async function Home() {

  return (
    <>
      <section style={{ paddingTop: 'clamp(64px, 12vw, 140px)' }}>
        <div className="shell">
          <span className="eyebrow">AI-native architectural practice</span>
          <h1 style={{ maxWidth: '18ch' }}>The bureau that ends the bureau</h1>
          <p className="lead" style={{ marginTop: 28, maxWidth: '54ch' }}>We do not assist the local architectural practice. We take its place: we take the brief, assemble the team algorithmically and deliver the documentation set.</p>

          <div className="row" style={{ marginTop: 40, gap: 16 }}>
            <Link href="/brief" className="btn btn-solid">Submit a brief</Link>
            <Link href="/algorithm" className="btn">See how the algorithm chooses</Link>
          </div>

          <div className="grid grid-3" style={{ marginTop: 72 }}>
            <Figure value={`${MAX_STOREYS}`} unit="storeys" note="Product boundary: light-regulation zones" />
            <Figure value={`${PORTFOLIO_THRESHOLD}/10`} unit="threshold" note="Below the portfolio threshold a specialist does not pass" />
            <Figure
              value={`${JURISDICTIONS.length}`}
              unit="countries"
              note={JURISDICTIONS.map((j) => JURISDICTION_NAMES[j]).join(' · ')}
            />
          </div>
        </div>
      </section>

      <section>
        <div className="shell">
          <span className="eyebrow">The problem</span>
          <div className="split">
            <div>
              <h2>The local practice is not expertise. It is a shortage of access</h2>
            </div>
            <div>
              <p>The plot owner pays because the practice has people and they do not. Selection runs off a partner’s address book, coordination costs as much as an office, and a specialist’s quality is measured by reputation, by eye.</p>
              <p>We dismantle that shortage: the pool is global, selection is algorithmic, coordination is protocol.</p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="shell">
          <span className="eyebrow">Three stages</span>
          <h2 style={{ marginBottom: 40 }}>Filter · Score · Relay</h2>

          <div className="grid grid-3">
            {STAGES.map((stage, i) => (
              <div key={stage.public} className="panel">
                <div className="label label-accent">
                  {String(i + 1).padStart(2, '0')} / {stage.public}
                </div>
                <h3 style={{ marginTop: 14 }}>{stage.internal}</h3>
                <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
                  {stage.note}
                </p>
              </div>
            ))}
          </div>

          <p style={{ marginTop: 32 }}>
            <Link href="/how-it-works">Each stage in detail →</Link>
          </p>
        </div>
      </section>

      <section>
        <div className="shell">
          <div className="split">
            <div>
              <span className="eyebrow">Selection</span>
              <h2>Quality × Availability</h2>
              <p style={{ marginTop: 20 }}>A product, not a sum. An excellent specialist with no free capacity is useless to a project with a date: a sum would let quality compensate for unavailability, a product will not.</p>
              <p>For every specialist the client sees the full score breakdown: portfolio rating, the weight of delivery metrics, fit to the project, availability factor.</p>
              <Link href="/algorithm" className="btn" style={{ marginTop: 12 }}>Open the demonstration</Link>
            </div>

            <div className="panel panel-raised">
              <div className="label">Twelve dimensions of the taxonomy</div>
              <ul className="clean" style={{ marginTop: 18 }}>
                {[
                  'Discipline',
                  'Typology',
                  'Scale',
                  'Storey count',
                  'Structural system',
                  'Climate zone',
                  'Jurisdiction and signing rights',
                  'Software and IFC exchange level',
                  'Documentation stage',
                  'Regulatory track',
                  'Language with the client and the authorities',
                  'Working mode and capacity',
                ].map((dimension, i) => (
                  <li
                    key={dimension}
                    style={{
                      display: 'flex',
                      gap: 14,
                      padding: '9px 0',
                      borderBottom: i === 11 ? 'none' : '1px solid var(--border)',
                    }}
                  >
                    <span className="num dim">{String(i + 1).padStart(2, '0')}</span>
                    <span>{dimension}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="shell">
          <span className="eyebrow">Blind Relay Protocol</span>
          <div className="split">
            <div>
              <h2>Specialists do not talk to each other</h2>
              <p style={{ marginTop: 20 }}>No direct chats. Comments live on the task ticket and nowhere else. Stage gates follow dependencies: a ticket does not open until the ones it depends on are accepted.</p>
            </div>
            <div className="stack" style={{ gap: 20 }}>
              <Reason
                title="No route around us"
                body="Direct contact between specialists is a ready-made channel for taking the project elsewhere. No channel, no leak."
              />
              <Reason
                title="Clean metrics"
                body="When agreements live in private chats, there is nothing to compute response time or rework share from. The ticket is the only measurable place."
              />
              <Reason
                title="Dependency discipline"
                body="Gates force a record of exactly what was handed on, instead of “we agreed verbally”."
              />
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="shell">
          <div className="split">
            <div>
              <span className="eyebrow">Two ways in</span>
              <h2>Client or specialist</h2>
            </div>
            <div className="grid grid-2">
              <div className="panel panel-accent">
                <div className="label label-accent">Client</div>
                <h3 style={{ marginTop: 12 }}>I own a plot</h3>
                <p className="muted" style={{ marginTop: 10 }}>Describe the project. The engine checks it against the product boundary and assembles the team.</p>
                <Link href="/brief" className="btn btn-solid">Submit a brief</Link>
              </div>
              <div className="panel">
                <div className="label">Specialist</div>
                <h3 style={{ marginTop: 12 }}>I deliver design sections</h3>
                <p className="muted" style={{ marginTop: 10 }}>
                  {fill('An application across twelve dimensions. Portfolio threshold: {threshold}/10.', {
                    threshold: PORTFOLIO_THRESHOLD,
                  })}
                </p>
                <Link href="/specialists" className="btn">Apply</Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

function Figure({ value, unit, note }: { value: string; unit: string; note: string }) {
  return (
    <div style={{ borderTop: '1px solid var(--border-strong)', paddingTop: 18 }}>
      <div className="row" style={{ gap: 10, alignItems: 'baseline' }}>
        <span className="num" style={{ fontSize: '2.4rem', color: 'var(--accent)' }}>
          {value}
        </span>
        <span className="label">{unit}</span>
      </div>
      <p className="dim" style={{ marginTop: 8, marginBottom: 0, fontSize: '0.9rem' }}>
        {note}
      </p>
    </div>
  )
}

function Reason({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <div className="label label-accent">{title}</div>
      <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>
        {body}
      </p>
    </div>
  )
}
