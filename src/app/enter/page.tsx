import { PageHero } from '@/components/PageHero'
import Link from 'next/link'
import { pageMetadata } from '@/lib/metadata'
import { EnterForm, RecoverForm } from './EnterForm'

export const metadata = pageMetadata('Sign in')

export default async function EnterPage() {

  return (
    <>
    <PageHero
      width={520}
      eyebrow="Sign in"
      title="With your key"
      lead="There is no separate sign-up step. Clients get a key after submitting a brief; specialists get one once their application is approved."
    />
    <section>
      <div className="shell" style={{ maxWidth: 520 }}>
        <div>
          <EnterForm />
        </div>

        <div className="divider" />

        <details style={{ marginBottom: 28 }}>
          <summary className="label" style={{ cursor: 'pointer' }}>
            Lost your key
          </summary>
          <p className="muted" style={{ marginTop: 14, fontSize: '0.92rem' }}>We send the key to the address it was issued to. There will be no new key: the old email, if it turns up, keeps working.</p>
          <div style={{ marginTop: 16 }}>
            <RecoverForm />
          </div>
        </details>

        <div className="stack" style={{ gap: 10 }}>
          <Link href="/brief">
            No key, but you own a plot → submit a brief
          </Link>
          <Link href="/specialists">
            No key, and you are a specialist → apply
          </Link>
          <Link href="/ops" className="dim">
            Bureau sign-in
          </Link>
        </div>
      </div>
    </section>
    </>
  )
}
