import { pageMetadata } from '@/lib/metadata'
import { BriefForm } from './BriefForm'

export const generateMetadata = () =>
  pageMetadata(
    'Project brief',
    'Describe your project. The engine checks it against the product boundary, ranks specialists across twelve dimensions and assembles the team.',
  )

export default async function BriefPage() {

  return (
    <section style={{ paddingTop: 'clamp(48px, 8vw, 88px)' }}>
      <div className="shell" style={{ maxWidth: 880 }}>
        <span className="eyebrow">Stage 01 · Filter</span>
        <h1>Project brief</h1>
        <p className="lead" style={{ marginTop: 20 }}>
          {'The sharper the input, the less the selection has to guess. Nothing here is a matter of taste — every field is a dimension the engine computes on.'}
        </p>

        <div style={{ marginTop: 44 }}>
          <BriefForm />
        </div>
      </div>
    </section>
  )
}
