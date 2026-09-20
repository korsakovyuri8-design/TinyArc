import Link from 'next/link'
import { BriefSandbox } from '@/components/BriefSandbox'
import { HeroMassing } from '@/components/HeroMassing'
import { StageStamps } from '@/components/StageStamps'
import { DimensionScale } from '@/components/DimensionScale'
import { fill } from '@/lib/fill'
import { STAGES } from '@/lib/labels'
import { MAX_STOREYS, PORTFOLIO_THRESHOLD, JURISDICTIONS } from '@/engine/taxonomy'

/**
 * Значения взяты из таксономии, а не придуманы для красоты. Если в движке
 * появится шестой материал или тридцать первая страна, эта строка разойдётся с
 * правдой — и лучше, чтобы расхождение было заметным здесь, чем чтобы сайт
 * годами обещал то, чего нет.
 */
const DIMENSIONS = [
  { name: 'Discipline', values: 'Architecture · structural · MEP · landscape · visualisation · survey · permitting · cost' },
  { name: 'Typology', values: 'Villa · townhouse · multi-family · mixed-use' },
  { name: 'Scale', values: 'Up to 250 m2 · 250-1000 · 1000-3000 · over 3000' },
  { name: 'Storey count', values: `Up to ${MAX_STOREYS} storeys — where the bureau is sharpest` },
  { name: 'Structural system', values: 'Concrete · masonry · timber · steel · hybrid' },
  { name: 'Climate zone', values: 'Mediterranean · continental · alpine · arid' },
  { name: 'Jurisdiction and signing rights', values: `${JURISDICTIONS.length} countries. Only survey and permitting are tied to one` },
  { name: 'Software and IFC exchange', values: 'Revit · ArchiCAD · AutoCAD · Rhino · Tekla, and the IFC level between them' },
  { name: 'Documentation stage', values: 'Concept · permit · tender · construction' },
  { name: 'Regulatory track', values: 'Light zone · standard · heritage · flood-prone' },
  { name: 'Language', values: 'With the client in any language; with the authorities in theirs' },
  { name: 'Working mode and capacity', values: 'Hours a week, current load, and what is already booked' },
] as const

export default async function Home() {

  return (
    <>
      {/*
        Первый экран — ночь, остальная страница — день. Переход между ними тот
        же, что в работе с бюро: от впечатления к комплекту документации.
      */}
      <section className="night">
        <div className="shell">
          <span className="eyebrow">AI-native architectural practice</span>
          <h1 style={{ maxWidth: '18ch' }}>The bureau that ends the bureau</h1>
          <p className="lead" style={{ marginTop: 28, maxWidth: '54ch' }}>We do not assist the local architectural practice. We take its place: we take the brief, assemble the team algorithmically and deliver the documentation set.</p>

          <div className="row" style={{ marginTop: 40, gap: 16 }}>
            <Link href="/brief" className="btn btn-solid">Submit a brief</Link>
            <Link href="/algorithm" className="btn">See how the algorithm chooses</Link>
          </div>

          {/*
            Схема объёма стоит выше цифр намеренно. Три плашки — это про то, как
            бюро устроено; схема — про то, что человек получит. Порядок на
            странице и есть порядок разговора.
          */}
          <div style={{ marginTop: 56 }}>
            <HeroMassing />
          </div>

          <div style={{ marginTop: 56 }}>
            <span className="eyebrow">Try it on your own numbers</span>
            <div style={{ marginTop: 16 }}>
              <BriefSandbox />
            </div>
          </div>

        </div>
      </section>

      <section>
        <div className="shell">
          <div className="grid grid-3">
            <Figure value={`${MAX_STOREYS}`} unit="storeys" note="Where the bureau is sharpest: light-regulation zones" />
            <Figure value={`${PORTFOLIO_THRESHOLD}/10`} unit="threshold" note="Below the portfolio threshold a specialist does not pass" />
            <Figure
              value={`${JURISDICTIONS.length}`}
              unit="countries"
              note="Two roles are tied to the country. The rest of the team comes from wherever it is"
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

      {/* Сад в тени: третий тон между ночью и бумагой, чтобы страница не читалась как две половины. */}
      <section className="grove">
        <div className="shell">
          <span className="eyebrow">Three stages</span>
          <h2 style={{ marginBottom: 40 }}>Filter · Score · Relay</h2>

          <StageStamps stages={STAGES} />

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
              <div style={{ marginTop: 18 }}>
                <DimensionScale dimensions={DIMENSIONS} />
              </div>
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
