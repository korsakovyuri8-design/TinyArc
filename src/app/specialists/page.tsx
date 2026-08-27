import type { Metadata } from 'next'
import Link from 'next/link'
import { PORTFOLIO_THRESHOLD } from '@/engine/taxonomy'

export const metadata: Metadata = {
  title: 'Специалистам — TinyArc Cloud Bureau',
  description:
    'Пул специалистов Bureau: отбор по двенадцати измерениям, порог по портфолио 8/10, работа по тикетам, метрики вместо отзывов.',
}

export default function SpecialistsPage() {
  return (
    <>
      <section style={{ paddingTop: 'clamp(48px, 8vw, 96px)' }}>
        <div className="shell">
          <span className="eyebrow">Пул</span>
          <h1 style={{ maxWidth: '16ch' }}>Проекты приходят к вам, а не вы к ним</h1>
          <p className="lead" style={{ marginTop: 24, maxWidth: '54ch' }}>
            Ни тендеров, ни писем «расскажите о себе», ни торга по ставке. Движок сам решает, кто
            попадает в команду, — по фактам, которые вы заявили, и по тому, как вы сдавали
            прошлые тикеты.
          </p>
          <Link href="/specialists/apply" className="btn btn-solid" style={{ marginTop: 32 }}>
            Подать заявку
          </Link>
        </div>
      </section>

      <section>
        <div className="shell">
          <span className="eyebrow">Условия честные, но не мягкие</span>
          <div className="grid grid-2">
            <Term
              title={`Порог по портфолио — ${PORTFOLIO_THRESHOLD}/10`}
              body="Гейт стоит до скоринга. Ниже порога заявка не проходит, какой бы свободной ни была ваша неделя."
            />
            <Term
              title="Оценок не существует"
              body="Ни клиент, ни бюро не могут поставить вам балл. Считаются только сроки, приёмка с первого раза, время отклика и круги правок."
            />
            <Term
              title="Прямых чатов нет"
              body="Вы видите свой тикет и комментарии по нему. Соседей по команде — как роли, не как имена."
            />
            <Term
              title="Метрики двигают доступ"
              body="Сорванные сроки снижают Quality и убирают вас из следующих команд. Без разбирательств и без второго шанса, выданного вручную."
            />
            <Term
              title="Ёмкость — это множитель"
              body="Формула Quality × Availability. Нулевая свободная ёмкость обнуляет балл: качество недоступность не компенсирует."
            />
            <Term
              title="Плата за доступ"
              body="Подписка специалиста — за доступ к проектам. Комиссии с вашей ставки нет."
            />
          </div>
        </div>
      </section>

      <section>
        <div className="shell">
          <div className="split">
            <div>
              <span className="eyebrow">Как идёт работа</span>
              <h2>Тикет, гейт, приёмка</h2>
            </div>
            <div className="stack" style={{ gap: 22 }}>
              <Step n="01" title="Тикет открывается гейтом">
                Пока не приняты задачи, от которых зависит ваша, тикет закрыт. Вы видите
                название и стадию, но не содержание — входных артефактов ещё нет.
              </Step>
              <Step n="02" title="Вы работаете и комментируете в тикете">
                Первый содержательный ответ засекает Response Time. Всё общение — в тикете, и
                это единственное место, где его вообще можно вести.
              </Step>
              <Step n="03" title="Бюро принимает или возвращает на круг">
                Приёмка в срок и с первого раза поднимает Quality. Возврат добавляет круг правок
                и снижает First Time Right.
              </Step>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="shell">
          <div className="row" style={{ gap: 16 }}>
            <Link href="/specialists/apply" className="btn btn-solid">
              Подать заявку
            </Link>
            <Link href="/enter" className="btn btn-quiet">
              У меня уже есть ключ
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}

function Term({ title, body }: { title: string; body: string }) {
  return (
    <div className="panel">
      <div className="label label-accent">{title}</div>
      <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
        {body}
      </p>
    </div>
  )
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="row" style={{ gap: 18, alignItems: 'flex-start', flexWrap: 'nowrap' }}>
      <span className="num dim" style={{ fontSize: '1.1rem' }}>
        {n}
      </span>
      <div>
        <div className="label label-accent">{title}</div>
        <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>
          {children}
        </p>
      </div>
    </div>
  )
}
