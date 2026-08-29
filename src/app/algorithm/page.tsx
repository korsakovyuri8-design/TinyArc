import { Link } from '@/components/Link'
import { fill } from '@/lib/i18n/fill'
import { translator } from '@/lib/i18n'
import { pageMetadata } from '@/lib/i18n/metadata'
import { AlgorithmDemo } from '@/components/AlgorithmDemo'
import { DEMO_POOL_SIZE } from '@/lib/demo-pool'

export const generateMetadata = () =>
  pageMetadata(
    'Демонстрация алгоритма',
    'Как из пула специалистов собирается команда под конкретный проект: фильтр по двенадцати измерениям, ранжирование по Quality × Availability, сборка Tiny Team и граф тикетов.',
  )

export default async function AlgorithmPage() {
  const { locale, t } = await translator()

  return (
    <section style={{ paddingTop: 'clamp(48px, 8vw, 88px)' }}>
      <div className="shell">
        <span className="eyebrow">Filter · Score · Relay</span>
        <h1 style={{ maxWidth: '16ch' }}>{t('Как алгоритм собирает команду')}</h1>
        <p className="lead" style={{ marginTop: 24, maxWidth: '58ch' }}>
          {fill(
            t('Меняйте требования проекта и смотрите, что происходит с пулом. Считает тот же движок, что работает в продукте, — здесь он просто крутится в браузере на синтетическом пуле из {count} специалистов.'),
            { count: DEMO_POOL_SIZE },
          )}
        </p>
        <p className="note" style={{ marginTop: 20 }}>{t('Пул синтетический и намеренно неровный: в нём есть люди ниже порога по портфолио, без права подписи, без нужного языка и без свободной ёмкости. Демонстрация, где проходят все, ничего не демонстрирует.')}</p>

        <div style={{ marginTop: 48 }}>
          <AlgorithmDemo locale={locale} />
        </div>

        <div className="divider" style={{ marginTop: 56 }} />

        <div className="row" style={{ gap: 16 }}>
          <Link locale={locale} href="/brief" className="btn btn-solid">{t('Оставить бриф на свой проект')}</Link>
          <Link locale={locale} href="/how-it-works" className="btn btn-quiet">{t('Как устроены три стадии')}</Link>
        </div>
      </div>
    </section>
  )
}
