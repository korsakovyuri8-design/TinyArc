import type { Metadata } from 'next'
import { BriefForm } from './BriefForm'

export const metadata: Metadata = {
  title: 'Бриф проекта — TinyArc Cloud Bureau',
  description:
    'Опишите проект. Движок проверит его на продуктовую границу, отберёт специалистов по двенадцати измерениям и соберёт команду.',
}

export default function BriefPage() {
  return (
    <section style={{ paddingTop: 'clamp(48px, 8vw, 88px)' }}>
      <div className="shell" style={{ maxWidth: 880 }}>
        <span className="eyebrow">Стадия 01 · Filter</span>
        <h1>Бриф проекта</h1>
        <p className="lead" style={{ marginTop: 20 }}>
          Чем точнее вход, тем меньше в отборе догадок. Ни одно поле здесь не про вкус — всё это
          измерения, по которым движок считает.
        </p>

        <div style={{ marginTop: 44 }}>
          <BriefForm />
        </div>
      </div>
    </section>
  )
}
