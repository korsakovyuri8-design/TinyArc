import Link from 'next/link'
import { pageMetadata } from '@/lib/metadata'
import { EnterForm, RecoverForm } from './EnterForm'

export const metadata = pageMetadata('Sign in')

export default async function EnterPage() {

  return (
    <section style={{ paddingTop: 'clamp(48px, 8vw, 96px)' }}>
      <div className="shell" style={{ maxWidth: 520 }}>
        <span className="eyebrow">Sign in</span>
        <h1>With your key</h1>
        <p className="lead" style={{ marginTop: 18 }}>
          {'There is no separate sign-up step. Clients get a key after submitting a brief; specialists get one once their application is approved.'}
        </p>

        <div style={{ marginTop: 36 }}>
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
  )
}
