import type { Metadata } from 'next'
import Link from 'next/link'
import { AlgorithmDemo } from '@/components/AlgorithmDemo'
import { DEMO_POOL_SIZE } from '@/lib/demo-pool'

export const metadata: Metadata = {
  title: 'Демонстрация алгоритма — TinyArc Cloud Bureau',
  description:
    'Как из пула специалистов собирается команда под конкретный проект: фильтр по двенадцати измерениям, ранжирование по Quality × Availability, сборка Tiny Team и граф тикетов.',
}

export default function AlgorithmPage() {
  return (
    <section style={{ paddingTop: 'clamp(48px, 8vw, 88px)' }}>
      <div className="shell">
        <span className="eyebrow">Filter · Score · Relay</span>
        <h1 style={{ maxWidth: '16ch' }}>Как алгоритм собирает команду</h1>
        <p className="lead" style={{ marginTop: 24, maxWidth: '58ch' }}>
          Меняйте требования проекта и смотрите, что происходит с пулом. Считает тот же движок,
          что работает в продукте, — здесь он просто крутится в браузере на синтетическом пуле
          из {DEMO_POOL_SIZE} специалистов.
        </p>
        <p className="note" style={{ marginTop: 20 }}>
          Пул синтетический и намеренно неровный: в нём есть люди ниже порога по портфолио, без
          права подписи, без нужного языка и без свободной ёмкости. Демонстрация, где проходят
          все, ничего не демонстрирует.
        </p>

        <div style={{ marginTop: 48 }}>
          <AlgorithmDemo />
        </div>

        <div className="divider" style={{ marginTop: 56 }} />

        <div className="row" style={{ gap: 16 }}>
          <Link href="/brief" className="btn btn-solid">
            Оставить бриф на свой проект
          </Link>
          <Link href="/how-it-works" className="btn btn-quiet">
            Как устроены три стадии
          </Link>
        </div>
      </div>
    </section>
  )
}
