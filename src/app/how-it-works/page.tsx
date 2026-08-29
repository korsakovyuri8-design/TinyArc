import Link from 'next/link'
import { fill } from '@/lib/fill'
import { pageMetadata } from '@/lib/metadata'
import {
  JURISDICTIONS,
  JURISDICTION_NAMES,
  MAX_STOREYS,
  PORTFOLIO_THRESHOLD,
} from '@/engine/taxonomy'

export const generateMetadata = () =>
  pageMetadata(
    'How it works',
    'Three stages: Validate, Assemble, Deliver. The product boundary, selection across twelve dimensions, the Quality × Availability formula, the Blind Relay Protocol and quality metrics.',
  )

export default async function HowItWorks() {

  return (
    <>
      <section style={{ paddingTop: 'clamp(48px, 8vw, 88px)', paddingBottom: 40 }}>
        <div className="shell">
          <span className="eyebrow">Three stages</span>
          <h1 style={{ maxWidth: '14ch' }}>Validate · Assemble · Deliver</h1>
          <p className="lead" style={{ marginTop: 24, maxWidth: '56ch' }}>These are the internal names. On the site the same three stages go by shorter ones — Filter, Score, Relay. Same thing, seen from the other side of the table.</p>
        </div>
      </section>

      <Stage

        number="01"
        internal="Validate"
        publicName="Filter"
        title="The brief becomes requirements; the pool is cut down"
      >
        <p>The brief is parsed into structured requirements: jurisdiction, typology, storeys, area, climate zone, structural system, documentation stage, timing, software.</p>
        <p>
          {fill(
            'The project itself is checked here too. Bureau handles buildings up to {n} storeys in light-regulation zones in three countries: {countries}. A project outside that boundary is declined — not taken on and then dragged along.',
            {
              n: MAX_STOREYS,
              countries: JURISDICTIONS.map((j) => JURISDICTION_NAMES[j]).join(', '),
            },
          )}
        </p>
        <p>
          {fill(
            'The pool then goes through the hard gates: discipline, jurisdiction, storeys, stage, model exchange, language, working-hours overlap. And the portfolio threshold — {threshold}/10, below which a specialist does not pass, however free their week.',
            { threshold: PORTFOLIO_THRESHOLD },
          )}
        </p>
        <p className="note">Every hard criterion shrinks the pool. So only the indispensable ones are hard; the other eight dimensions of the taxonomy rank rather than exclude.</p>
      </Stage>

      <Stage

        number="02"
        internal="Assemble"
        publicName="Score"
        title="Quality × Availability and assembling the Tiny Team"
      >
        <p>Survivors are ranked by the formula <strong>Quality × Availability</strong>.{' '}
          A product, not a sum: a sum would let quality make up for unavailability, a product does not. An excellent specialist with no free capacity is of no use to a project that has a date.
        </p>
        <p>
          <strong>Quality</strong>for a specialist with no history it is the portfolio rating. As soon as closed tickets appear, delivery metrics enter Quality: they displace the portfolio up to a ceiling of 60%. Portfolios age; metrics do not.</p>
        <p>
          <strong>Availability</strong>— free capacity against what is required, time to start on a task, and the working-day overlap across time zones.</p>
        <p>Then the Tiny Team is assembled — the minimum sufficient team, not a full practice roster. The set of disciplines follows from the project: a villa does not need what a mixed-use building needs. Software compatibility is checked — a candidate who breaks model exchange gives way to the next one even with a higher score. And signing rights are checked: without someone who can sign the set in the project’s country, no team is assembled at all.</p>
        <p>
          <Link href="/algorithm">See how this is computed →</Link>
        </p>
      </Stage>

      <Stage

        number="03"
        internal="Deliver"
        publicName="Relay"
        title="Blind Relay Protocol"
      >
        <p>The operating protocol for production. Three rules:</p>
        <ol style={{ maxWidth: 'var(--measure)', paddingLeft: 20 }}>
          <li style={{ marginBottom: 10 }}>No direct chats between specialists. No such channel exists.</li>
          <li style={{ marginBottom: 10 }}>Comments live on the task ticket and nowhere else.</li>
          <li>Stage gates follow dependencies: a ticket does not open until the ones it depends on are accepted.</li>
        </ol>
        <p style={{ marginTop: 20 }}>A specialist sees their own ticket, the input files released by the gate, and the comments on that ticket. They see teammates as roles, not as names and contact details.</p>
        <p className="note">The protocol adds friction where a conventional practice would settle the question in a minute in a meeting room. That is a price we accept: without it there is no protection against being routed around, no measurable metrics and no dependency discipline.</p>
      </Stage>

      <section>
        <div className="shell">
          <span className="eyebrow">Quality</span>
          <h2>Metrics, not reviews</h2>
          <p style={{ marginTop: 20 }}>A specialist’s quality is measured mathematically and computed from ticket events. Neither the client nor an operator has any way to leave a rating — no such field exists.</p>

          <div className="grid grid-2" style={{ marginTop: 32 }}>
            <Metric name="SLA compliance" body="Share of tickets closed on time." />
            <Metric name="First Time Right" body="Share of tickets accepted first time." />
            <Metric name="Response Time" body="Time to the first substantive reply in a ticket." />
            <Metric name="Revision Rate" body="Average number of revision rounds per ticket." />
          </div>

          <p style={{ marginTop: 32 }}>Metrics feed into Quality and so move the odds of joining the next team directly. That is the selection mechanism: a specialist who misses deadlines loses access to projects without a single hearing.</p>
        </div>
      </section>

      <section>
        <div className="shell">
          <div className="row" style={{ gap: 16 }}>
            <Link href="/brief" className="btn btn-solid">Submit a brief</Link>
            <Link href="/specialists" className="btn btn-quiet">Join the pool</Link>
          </div>
        </div>
      </section>
    </>
  )
}

function Stage({
  number,
  internal,
  publicName,
  title,
  children,
}: {
  number: string
  internal: string
  publicName: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="shell">
        <div className="split">
          <div>
            <div className="row" style={{ gap: 12, alignItems: 'baseline' }}>
              <span className="num" style={{ fontSize: '2.6rem', color: 'var(--accent)' }}>
                {number}
              </span>
              <div>
                <div className="label label-accent">{publicName}</div>
                <div className="label">
                  internal name — {internal}
                </div>
              </div>
            </div>
            <h2 style={{ marginTop: 24 }}>{title}</h2>
          </div>
          <div>{children}</div>
        </div>
      </div>
    </section>
  )
}

function Metric({ name, body }: { name: string; body: string }) {
  return (
    <div className="panel">
      <div className="label label-accent">{name}</div>
      <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
        {body}
      </p>
    </div>
  )
}
