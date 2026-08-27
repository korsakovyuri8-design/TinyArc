import type { Metadata } from 'next'
import Link from 'next/link'
import {
  JURISDICTIONS,
  JURISDICTION_NAMES,
  MAX_STOREYS,
  PORTFOLIO_THRESHOLD,
} from '@/engine/taxonomy'

export const metadata: Metadata = {
  title: 'Как это работает — TinyArc Cloud Bureau',
  description:
    'Три стадии: Validate, Assemble, Deliver. Продуктовая граница, отбор по двенадцати измерениям, формула Quality × Availability, Blind Relay Protocol и метрики качества.',
}

export default function HowItWorks() {
  return (
    <>
      <section style={{ paddingTop: 'clamp(48px, 8vw, 88px)', paddingBottom: 40 }}>
        <div className="shell">
          <span className="eyebrow">Три стадии</span>
          <h1 style={{ maxWidth: '14ch' }}>Validate · Assemble · Deliver</h1>
          <p className="lead" style={{ marginTop: 24, maxWidth: '56ch' }}>
            Внутренние имена стадий. На сайте те же три стадии называются короче — Filter, Score,
            Relay. Это одно и то же, просто с разной стороны стола.
          </p>
        </div>
      </section>

      <Stage
        number="01"
        internal="Validate"
        publicName="Filter"
        title="Бриф становится требованиями, пул отсекается"
      >
        <p>
          Бриф разбирается в структурированные требования: юрисдикция, типология, этажность,
          площадь, климатическая зона, материальная система, стадия документации, сроки, софт.
        </p>
        <p>
          Здесь же проверяется сам проект. Bureau ведёт здания до {MAX_STOREYS} этажей в зонах
          лёгкого регулирования в трёх странах: {JURISDICTIONS.map((j) => JURISDICTION_NAMES[j]).join(', ')}.
          Если проект выходит за эту границу, мы отказываем — а не берём и не тянем.
        </p>
        <p>
          Затем пул проходит жёсткие гейты: дисциплина, юрисдикция, этажность, стадия, обмен
          моделями, язык, пересечение по времени. И порог по портфолио — {PORTFOLIO_THRESHOLD}/10,
          ниже которого специалист не проходит, каким бы свободным он ни был.
        </p>
        <p className="note">
          Каждый жёсткий критерий сжимает пул. Поэтому жёстких — только те, без которых нельзя;
          остальные восемь измерений таксономии ранжируют, а не отсеивают.
        </p>
      </Stage>

      <Stage
        number="02"
        internal="Assemble"
        publicName="Score"
        title="Quality × Availability и сборка Tiny Team"
      >
        <p>
          Выжившие ранжируются по формуле <strong>Quality × Availability</strong>. Умножение, а
          не сумма: сумма позволила бы качеству компенсировать недоступность, произведение — нет.
          Отличный специалист без свободной ёмкости бесполезен проекту с датой.
        </p>
        <p>
          <strong>Quality</strong> у специалиста без истории — это рейтинг портфолио. Как только
          появляются закрытые тикеты, в Quality подмешиваются метрики поставки: они вытесняют
          портфолио до потолка в 60%. Портфолио стареет, метрики — нет.
        </p>
        <p>
          <strong>Availability</strong> — свободная ёмкость против требуемой, срок выхода на
          задачу и пересечение рабочего дня по часовым поясам.
        </p>
        <p>
          Дальше собирается Tiny Team — минимальная достаточная команда, а не полный штат бюро.
          Состав дисциплин определяется проектом: вилле не нужен тот же набор, что mixed-use.
          Проверяется совместимость по софту — кандидат, ломающий обмен моделями, уступает место
          следующему даже с более высоким баллом. И проверяется право подписи: без специалиста,
          подписывающего пакет в стране проекта, команда не собирается вовсе.
        </p>
        <p>
          <Link href="/algorithm">Посмотреть, как это считается →</Link>
        </p>
      </Stage>

      <Stage
        number="03"
        internal="Deliver"
        publicName="Relay"
        title="Blind Relay Protocol"
      >
        <p>Операционный протокол выпуска. Три правила:</p>
        <ol style={{ maxWidth: 'var(--measure)', paddingLeft: 20 }}>
          <li style={{ marginBottom: 10 }}>
            Никаких прямых чатов между специалистами. Такого канала не существует.
          </li>
          <li style={{ marginBottom: 10 }}>
            Только комментарии на уровне тикета задачи.
          </li>
          <li>
            Стадийные гейты по зависимостям: тикет не открывается, пока не приняты те, от которых
            он зависит.
          </li>
        </ol>
        <p style={{ marginTop: 20 }}>
          Специалист видит свой тикет, входные артефакты, выданные гейтом, и комментарии по этому
          тикету. Соседей по команде он видит как роли, а не как имена и контакты.
        </p>
        <p className="note">
          Протокол добавляет трения там, где живое бюро решило бы вопрос за минуту в переговорке.
          Это принятая цена: без неё нет ни защиты от обхода, ни измеримых метрик, ни дисциплины
          зависимостей.
        </p>
      </Stage>

      <section>
        <div className="shell">
          <span className="eyebrow">Качество</span>
          <h2>Метрики, а не отзывы</h2>
          <p style={{ marginTop: 20 }}>
            Качество специалиста измеряется математически и считается из событий тикетов. Ни у
            клиента, ни у оператора нет способа поставить оценку — такого поля не существует.
          </p>

          <div className="grid grid-2" style={{ marginTop: 32 }}>
            <Metric name="SLA compliance" body="Доля тикетов, закрытых в срок." />
            <Metric name="First Time Right" body="Доля тикетов, принятых с первого предъявления." />
            <Metric name="Response Time" body="Время до первого содержательного ответа в тикете." />
            <Metric name="Revision Rate" body="Среднее число кругов правок на тикет." />
          </div>

          <p style={{ marginTop: 32 }}>
            Метрики входят в Quality и потому напрямую двигают шанс попасть в следующую команду.
            Это и есть механизм отбора: специалист, который срывает сроки, теряет доступ к
            проектам без единого разбирательства.
          </p>
        </div>
      </section>

      <section>
        <div className="shell">
          <div className="row" style={{ gap: 16 }}>
            <Link href="/brief" className="btn btn-solid">
              Оставить бриф
            </Link>
            <Link href="/specialists" className="btn btn-quiet">
              Вступить в пул
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}

function Stage({
  number,
  internal,
  publicName,
  title,
  children,
}: {
  number: string
  internal: string
  publicName: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="shell">
        <div className="split">
          <div>
            <div className="row" style={{ gap: 12, alignItems: 'baseline' }}>
              <span className="num" style={{ fontSize: '2.6rem', color: 'var(--accent)' }}>
                {number}
              </span>
              <div>
                <div className="label label-accent">{publicName}</div>
                <div className="label">внутреннее имя — {internal}</div>
              </div>
            </div>
            <h2 style={{ marginTop: 24 }}>{title}</h2>
          </div>
          <div>{children}</div>
        </div>
      </div>
    </section>
  )
}

function Metric({ name, body }: { name: string; body: string }) {
  return (
    <div className="panel">
      <div className="label label-accent">{name}</div>
      <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
        {body}
      </p>
    </div>
  )
}
