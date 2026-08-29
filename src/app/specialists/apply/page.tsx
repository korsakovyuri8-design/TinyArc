import { SpecialistForm } from '@/components/SpecialistForm'
import { pageMetadata } from '@/lib/metadata'
import { submitApplication } from './actions'

export const metadata = pageMetadata('Specialist application')

export default async function ApplyPage() {

  return (
    <section style={{ paddingTop: 'clamp(48px, 8vw, 88px)' }}>
      <div className="shell" style={{ maxWidth: 880 }}>
        <span className="eyebrow">Application</span>
        <h1>Twelve dimensions</h1>
        <p className="lead" style={{ marginTop: 20 }}>This is not a CV. Every field is a dimension the engine uses to compute overlap with a project. Claiming more than you do is not to your advantage: the mismatch surfaces on the very first ticket and settles into your metrics.</p>

        <div style={{ marginTop: 44 }}>
          <SpecialistForm action={submitApplication} askConsent />
        </div>
      </div>
    </section>
  )
}
