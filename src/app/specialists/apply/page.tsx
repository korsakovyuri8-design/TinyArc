import { PageHero } from '@/components/PageHero'
import { SpecialistForm } from '@/components/SpecialistForm'
import { pageMetadata } from '@/lib/metadata'
import { submitApplication } from './actions'

export const metadata = pageMetadata('Specialist application')

export default async function ApplyPage() {

  return (
    <>
      <PageHero
        tone="cellar"
        width={880}
        eyebrow="Application"
        title="Twelve dimensions"
        lead="This is not a CV. Every field is a dimension the engine uses to compute overlap with a project. Claiming more than you do is not to your advantage: the mismatch surfaces on the very first ticket and settles into your metrics."
      />
      <section>
        <div className="shell" style={{ maxWidth: 880 }}>
          <SpecialistForm action={submitApplication} askConsent />
        </div>
      </section>
    </>
  )
}
