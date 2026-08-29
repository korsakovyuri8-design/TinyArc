import Link from 'next/link'
import { fill } from '@/lib/fill'
import { pageMetadata } from '@/lib/metadata'
import { AlgorithmDemo } from '@/components/AlgorithmDemo'
import { DEMO_POOL_SIZE } from '@/lib/demo-pool'

export const generateMetadata = () =>
  pageMetadata(
    'See the algorithm',
    'How a team for a specific project is assembled out of the pool: filtering across twelve dimensions, ranking by Quality × Availability, assembling the Tiny Team, and the ticket graph.',
  )

export default async function AlgorithmPage() {

  return (
    <section style={{ paddingTop: 'clamp(48px, 8vw, 88px)' }}>
      <div className="shell">
        <span className="eyebrow">Filter · Score · Relay</span>
        <h1 style={{ maxWidth: '16ch' }}>How the algorithm assembles a team</h1>
        <p className="lead" style={{ marginTop: 24, maxWidth: '58ch' }}>
          {fill(
            'Change the project requirements and watch what happens to the pool. The counting is done by the same engine that runs in the product — here it simply runs in the browser against a synthetic pool of {count} specialists.',
            { count: DEMO_POOL_SIZE },
          )}
        </p>
        <p className="note" style={{ marginTop: 20 }}>The pool is synthetic and deliberately uneven: it contains people below the portfolio threshold, without signing rights, without the required language and without free capacity. A demonstration where everyone passes demonstrates nothing.</p>

        <div style={{ marginTop: 48 }}>
          <AlgorithmDemo />
        </div>

        <div className="divider" style={{ marginTop: 56 }} />

        <div className="row" style={{ gap: 16 }}>
          <Link href="/brief" className="btn btn-solid">Submit a brief for your own project</Link>
          <Link href="/how-it-works" className="btn btn-quiet">How the three stages work</Link>
        </div>
      </div>
    </section>
  )
}
