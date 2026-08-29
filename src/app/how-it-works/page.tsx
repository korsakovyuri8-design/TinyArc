import { Link } from '@/components/Link'
import { fill } from '@/lib/i18n/fill'
import { translator } from '@/lib/i18n'
import { pageMetadata } from '@/lib/i18n/metadata'
import {
  JURISDICTIONS,
  JURISDICTION_NAMES,
  MAX_STOREYS,
  PORTFOLIO_THRESHOLD,
} from '@/engine/taxonomy'

export const generateMetadata = () =>
  pageMetadata(
    'Как это работает',
    'Три стадии: Validate, Assemble, Deliver. Продуктовая граница, отбор по двенадцати измерениям, формула Quality × Availability, Blind Relay Protocol и метрики качества.',
  )

export default async function HowItWorks() {
  const { locale, t } = await translator()

  return (
    <>
      <section style={{ paddingTop: 'clamp(48px, 8vw, 88px)', paddingBottom: 40 }}>
        <div className="shell">
          <span className="eyebrow">{t('Три стадии')}</span>
          <h1 style={{ maxWidth: '14ch' }}>Validate · Assemble · Deliver</h1>
          <p className="lead" style={{ marginTop: 24, maxWidth: '56ch' }}>{t('Внутренние имена стадий. На сайте те же три стадии называются короче — Filter, Score, Relay. Это одно и то же, просто с разной стороны стола.')}</p>
        </div>
      </section>

      <Stage
        t={t}
        number="01"
        internal="Validate"
        publicName="Filter"
        title={t('Бриф становится требованиями, пул отсекается')}
      >
        <p>{t('Бриф разбирается в структурированные требования: юрисдикция, типология, этажность, площадь, климатическая зона, материальная система, стадия документации, сроки, софт.')}</p>
        <p>
          {fill(
            t('Здесь же проверяется сам проект. Bureau ведёт здания до {n} этажей в зонах лёгкого регулирования в трёх странах: {countries}. Если проект выходит за эту границу, мы отказываем — а не берём и не тянем.'),
            {
              n: MAX_STOREYS,
              countries: JURISDICTIONS.map((j) => t(JURISDICTION_NAMES[j])).join(', '),
            },
          )}
        </p>
        <p>
          {fill(
            t('Затем пул проходит жёсткие гейты: дисциплина, юрисдикция, этажность, стадия, обмен моделями, язык, пересечение по времени. И порог по портфолио — {threshold}/10, ниже которого специалист не проходит, каким бы свободным он ни был.'),
            { threshold: PORTFOLIO_THRESHOLD },
          )}
        </p>
        <p className="note">{t('Каждый жёсткий критерий сжимает пул. Поэтому жёстких — только те, без которых нельзя; остальные восемь измерений таксономии ранжируют, а не отсеивают.')}</p>
      </Stage>

      <Stage
        t={t}
        number="02"
        internal="Assemble"
        publicName="Score"
        title={t('Quality × Availability и сборка Tiny Team')}
      >
        <p>{t('Выжившие ранжируются по формуле')}<strong>Quality × Availability</strong>.{' '}
          {t('Умножение, а не сумма: сумма позволила бы качеству компенсировать недоступность, произведение — нет. Отличный специалист без свободной ёмкости бесполезен проекту с датой.')}
        </p>
        <p>
          <strong>Quality</strong>{t('у специалиста без истории — это рейтинг портфолио. Как только появляются закрытые тикеты, в Quality подмешиваются метрики поставки: они вытесняют портфолио до потолка в 60%. Портфолио стареет, метрики — нет.')}</p>
        <p>
          <strong>Availability</strong>{t('— свободная ёмкость против требуемой, срок выхода на задачу и пересечение рабочего дня по часовым поясам.')}</p>
        <p>{t('Дальше собирается Tiny Team — минимальная достаточная команда, а не полный штат бюро. Состав дисциплин определяется проектом: вилле не нужен тот же набор, что mixed-use. Проверяется совместимость по софту — кандидат, ломающий обмен моделями, уступает место следующему даже с более высоким баллом. И проверяется право подписи: без специалиста, подписывающего пакет в стране проекта, команда не собирается вовсе.')}</p>
        <p>
          <Link locale={locale} href="/algorithm">{t('Посмотреть, как это считается →')}</Link>
        </p>
      </Stage>

      <Stage
        t={t}
        number="03"
        internal="Deliver"
        publicName="Relay"
        title="Blind Relay Protocol"
      >
        <p>{t('Операционный протокол выпуска. Три правила:')}</p>
        <ol style={{ maxWidth: 'var(--measure)', paddingLeft: 20 }}>
          <li style={{ marginBottom: 10 }}>{t('Никаких прямых чатов между специалистами. Такого канала не существует.')}</li>
          <li style={{ marginBottom: 10 }}>{t('Только комментарии на уровне тикета задачи.')}</li>
          <li>{t('Стадийные гейты по зависимостям: тикет не открывается, пока не приняты те, от которых он зависит.')}</li>
        </ol>
        <p style={{ marginTop: 20 }}>{t('Специалист видит свой тикет, входные артефакты, выданные гейтом, и комментарии по этому тикету. Соседей по команде он видит как роли, а не как имена и контакты.')}</p>
        <p className="note">{t('Протокол добавляет трения там, где живое бюро решило бы вопрос за минуту в переговорке. Это принятая цена: без неё нет ни защиты от обхода, ни измеримых метрик, ни дисциплины зависимостей.')}</p>
      </Stage>

      <section>
        <div className="shell">
          <span className="eyebrow">{t('Качество')}</span>
          <h2>{t('Метрики, а не отзывы')}</h2>
          <p style={{ marginTop: 20 }}>{t('Качество специалиста измеряется математически и считается из событий тикетов. Ни у клиента, ни у оператора нет способа поставить оценку — такого поля не существует.')}</p>

          <div className="grid grid-2" style={{ marginTop: 32 }}>
            <Metric name="SLA compliance" body={t('Доля тикетов, закрытых в срок.')} />
            <Metric name="First Time Right" body={t('Доля тикетов, принятых с первого предъявления.')} />
            <Metric name="Response Time" body={t('Время до первого содержательного ответа в тикете.')} />
            <Metric name="Revision Rate" body={t('Среднее число кругов правок на тикет.')} />
          </div>

          <p style={{ marginTop: 32 }}>{t('Метрики входят в Quality и потому напрямую двигают шанс попасть в следующую команду. Это и есть механизм отбора: специалист, который срывает сроки, теряет доступ к проектам без единого разбирательства.')}</p>
        </div>
      </section>

      <section>
        <div className="shell">
          <div className="row" style={{ gap: 16 }}>
            <Link locale={locale} href="/brief" className="btn btn-solid">{t('Оставить бриф')}</Link>
            <Link locale={locale} href="/specialists" className="btn btn-quiet">{t('Вступить в пул')}</Link>
          </div>
        </div>
      </section>
    </>
  )
}

function Stage({
  t,
  number,
  internal,
  publicName,
  title,
  children,
}: {
  /** Переводчик страницы: подпись собирается здесь, а язык живёт выше. */
  t: (text: string) => string
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
                <div className="label">
                  {t('внутреннее имя —')} {internal}
                </div>
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
