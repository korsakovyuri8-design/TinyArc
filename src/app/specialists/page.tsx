import Link from 'next/link'
import { fill } from '@/lib/fill'
import { pageMetadata } from '@/lib/metadata'
import { PORTFOLIO_THRESHOLD } from '@/engine/taxonomy'

export const generateMetadata = () =>
  pageMetadata(
    'For specialists',
    'The Bureau specialist pool: selection across twelve dimensions, a portfolio threshold of 8/10, work on tickets, metrics instead of reviews.',
  )

export default async function SpecialistsPage() {

  return (
    <>
      <section style={{ paddingTop: 'clamp(48px, 8vw, 96px)' }}>
        <div className="shell">
          <span className="eyebrow">The pool</span>
          <h1 style={{ maxWidth: '16ch' }}>Projects come to you, not the other way round</h1>
          <p className="lead" style={{ marginTop: 24, maxWidth: '54ch' }}>No tenders, no “tell us about yourself” emails, no haggling over rates. The engine decides who joins a team — from the facts you declared and from how you delivered past tickets.</p>
          <Link href="/specialists/apply" className="btn btn-solid" style={{ marginTop: 32 }}>Apply</Link>
        </div>
      </section>

      <section>
        <div className="shell">
          <span className="eyebrow">The terms are fair, not soft</span>
          <div className="grid grid-2">
            <Term
              title={fill('Portfolio threshold — {threshold}/10', {
                threshold: PORTFOLIO_THRESHOLD,
              })}
              body="The gate comes before the scoring. Below the threshold an application does not pass, however free your week is."
            />
            <Term
              title="There are no ratings"
              body="Neither the client nor the bureau can score you. Only deadlines, first-time acceptance, response time and revision rounds are counted."
            />
            <Term
              title="There are no direct chats"
              body="You see your ticket and the comments on it. Teammates appear as roles, not as names."
            />
            <Term
              title="Metrics move your access"
              body="Missed deadlines lower Quality and take you out of the next teams. Without a hearing and without a second chance handed out by anyone."
            />
            <Term
              title="Capacity is a multiplier"
              body="The formula is Quality × Availability. Zero free capacity zeroes the score: quality does not compensate for unavailability."
            />
            <Term
              title="Paying for access"
              body="The specialist subscription pays for access to projects. There is no commission on your fee."
            />
          </div>
        </div>
      </section>

      <section>
        <div className="shell">
          <div className="split">
            <div>
              <span className="eyebrow">How the work runs</span>
              <h2>Ticket, gate, acceptance</h2>
            </div>
            <div className="stack" style={{ gap: 22 }}>
              <Step n="01" title="The gate opens the ticket">Until the tasks yours depends on are accepted, the ticket stays closed. You see the title and the stage but not the content — the input files do not exist yet.</Step>
              <Step n="02" title="You work and comment in the ticket">Your first substantive reply starts the Response Time clock. All communication happens in the ticket, and that is the only place it can happen at all.</Step>
              <Step n="03" title="The bureau accepts or sends it back">Acceptance on time and first time raises Quality. A return adds a revision round and lowers First Time Right.</Step>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="shell">
          <div className="row" style={{ gap: 16 }}>
            <Link href="/specialists/apply" className="btn btn-solid">Apply</Link>
            <Link href="/enter" className="btn btn-quiet">I already have a key</Link>
          </div>
        </div>
      </section>
    </>
  )
}

function Term({ title, body }: { title: string; body: string }) {
  return (
    <div className="panel">
      <div className="label label-accent">{title}</div>
      <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
        {body}
      </p>
    </div>
  )
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="row" style={{ gap: 18, alignItems: 'flex-start', flexWrap: 'nowrap' }}>
      <span className="num dim" style={{ fontSize: '1.1rem' }}>
        {n}
      </span>
      <div>
        <div className="label label-accent">{title}</div>
        <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>
          {children}
        </p>
      </div>
    </div>
  )
}
