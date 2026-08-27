import type { Metadata } from 'next'
import Link from 'next/link'
import { EnterForm } from './EnterForm'

export const metadata: Metadata = { title: 'Вход — TinyArc Cloud Bureau' }

export default function EnterPage() {
  return (
    <section style={{ paddingTop: 'clamp(48px, 8vw, 96px)' }}>
      <div className="shell" style={{ maxWidth: 520 }}>
        <span className="eyebrow">Вход</span>
        <h1>По ключу</h1>
        <p className="lead" style={{ marginTop: 18 }}>
          Регистрации как отдельного действия здесь нет. Клиент получает ключ после брифа,
          специалист — после того, как заявку подтвердили.
        </p>

        <div style={{ marginTop: 36 }}>
          <EnterForm />
        </div>

        <div className="divider" />

        <div className="stack" style={{ gap: 10 }}>
          <Link href="/brief">Нет ключа и есть участок → оставить бриф</Link>
          <Link href="/specialists">Нет ключа и вы специалист → подать заявку</Link>
          <Link href="/ops" className="dim">
            Вход для бюро
          </Link>
        </div>
      </div>
    </section>
  )
}
