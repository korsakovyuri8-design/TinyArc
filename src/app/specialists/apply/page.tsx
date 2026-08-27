import type { Metadata } from 'next'
import { ApplicationForm } from './ApplicationForm'

export const metadata: Metadata = { title: 'Заявка специалиста — TinyArc Cloud Bureau' }

export default function ApplyPage() {
  return (
    <section style={{ paddingTop: 'clamp(48px, 8vw, 88px)' }}>
      <div className="shell" style={{ maxWidth: 880 }}>
        <span className="eyebrow">Заявка</span>
        <h1>Двенадцать измерений</h1>
        <p className="lead" style={{ marginTop: 20 }}>
          Это не резюме. Каждое поле — измерение, по которому движок считает пересечение с
          проектом. Заявить лишнее не выгодно: несовпадение вскроется на первом же тикете и
          осядет в метриках.
        </p>

        <div style={{ marginTop: 44 }}>
          <ApplicationForm />
        </div>
      </div>
    </section>
  )
}
