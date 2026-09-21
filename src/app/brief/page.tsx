import { PageHero } from '@/components/PageHero'
import { pageMetadata } from '@/lib/metadata'
import { BriefForm } from './BriefForm'

export const generateMetadata = () =>
  pageMetadata(
    'Project brief',
    'Describe your project. The engine checks it against the product boundary, ranks specialists across twelve dimensions and assembles the team.',
  )

export default async function BriefPage() {

  return (
    <>
      <PageHero
        width={880}
        eyebrow="Stage 01 · Filter"
        title="Project brief"
        lead="The sharper the input, the less the selection has to guess. Nothing here is a matter of taste, every field is a dimension the engine computes on."
      />
      <section>
        <div className="shell" style={{ maxWidth: 880 }}>
          <BriefForm />
        </div>
      </section>
    </>
  )
}
