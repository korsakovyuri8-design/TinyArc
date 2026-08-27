import Link from 'next/link'
import { STAGES } from '@/lib/labels'
import { MAX_STOREYS, PORTFOLIO_THRESHOLD, JURISDICTIONS, JURISDICTION_NAMES } from '@/engine/taxonomy'

export default function Home() {
  return (
    <>
      <section style={{ paddingTop: 'clamp(64px, 12vw, 140px)' }}>
        <div className="shell">
          <span className="eyebrow">AI-native architectural practice</span>
          <h1 style={{ maxWidth: '18ch' }}>
            Бюро, которое заканчивает&nbsp;бюро
          </h1>
          <p className="lead" style={{ marginTop: 28, maxWidth: '54ch' }}>
            Мы не помогаем локальному архитектурному бюро. Мы занимаем его место: берём бриф,
            собираем команду алгоритмом и отдаём пакет документации.
          </p>

          <div className="row" style={{ marginTop: 40, gap: 16 }}>
            <Link href="/brief" className="btn btn-solid">
              Оставить бриф
            </Link>
            <Link href="/algorithm" className="btn">
              Посмотреть, как выбирает алгоритм
            </Link>
          </div>

          <div className="grid grid-3" style={{ marginTop: 72 }}>
            <Figure value={`${MAX_STOREYS}`} unit="этажей" note="Продуктовая граница: зоны лёгкого регулирования" />
            <Figure value={`${PORTFOLIO_THRESHOLD}/10`} unit="порог" note="Ниже порога по портфолио специалист не проходит" />
            <Figure
              value={`${JURISDICTIONS.length}`}
              unit="страны"
              note={JURISDICTIONS.map((j) => JURISDICTION_NAMES[j]).join(' · ')}
            />
          </div>
        </div>
      </section>

      <section>
        <div className="shell">
          <span className="eyebrow">Проблема</span>
          <div className="split">
            <div>
              <h2>Локальное бюро — это не компетенция, это дефицит доступа</h2>
            </div>
            <div>
              <p>
                Владелец участка платит за то, что у бюро есть люди, а у него — нет. Отбор идёт по
                записной книжке партнёра, координация стоит как офис, а качество специалиста
                измеряется репутацией на глаз.
              </p>
              <p>
                Мы разбираем этот дефицит: пул глобальный, отбор алгоритмический, координация
                протокольная.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="shell">
          <span className="eyebrow">Три стадии</span>
          <h2 style={{ marginBottom: 40 }}>Filter · Score · Relay</h2>

          <div className="grid grid-3">
            {STAGES.map((stage, i) => (
              <div key={stage.public} className="panel">
                <div className="label label-accent">
                  {String(i + 1).padStart(2, '0')} / {stage.public}
                </div>
                <h3 style={{ marginTop: 14 }}>{stage.internal}</h3>
                <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
                  {stage.note}
                </p>
              </div>
            ))}
          </div>

          <p style={{ marginTop: 32 }}>
            <Link href="/how-it-works">Подробно про каждую стадию →</Link>
          </p>
        </div>
      </section>

      <section>
        <div className="shell">
          <div className="split">
            <div>
              <span className="eyebrow">Отбор</span>
              <h2>Quality × Availability</h2>
              <p style={{ marginTop: 20 }}>
                Умножение, а не сумма. Отличный специалист без свободной ёмкости бесполезен проекту
                с датой: сумма позволила бы качеству компенсировать недоступность, произведение —
                нет.
              </p>
              <p>
                По каждому специалисту клиент видит разбор балла целиком: рейтинг портфолио, вклад
                метрик поставки, соответствие проекту, фактор доступности.
              </p>
              <Link href="/algorithm" className="btn" style={{ marginTop: 12 }}>
                Открыть демонстрацию
              </Link>
            </div>

            <div className="panel panel-raised">
              <div className="label">Двенадцать измерений таксономии</div>
              <ul className="clean" style={{ marginTop: 18 }}>
                {[
                  'Дисциплина',
                  'Типология',
                  'Масштаб',
                  'Этажность',
                  'Материальная система',
                  'Климатическая зона',
                  'Юрисдикция и право подписи',
                  'Софт и уровень обмена по IFC',
                  'Стадия документации',
                  'Регуляторный трек',
                  'Язык с клиентом и с органами',
                  'Режим работы и ёмкость',
                ].map((dimension, i) => (
                  <li
                    key={dimension}
                    style={{
                      display: 'flex',
                      gap: 14,
                      padding: '9px 0',
                      borderBottom: i === 11 ? 'none' : '1px solid var(--border)',
                    }}
                  >
                    <span className="num dim">{String(i + 1).padStart(2, '0')}</span>
                    <span>{dimension}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="shell">
          <span className="eyebrow">Blind Relay Protocol</span>
          <div className="split">
            <div>
              <h2>Специалисты не разговаривают друг с другом</h2>
              <p style={{ marginTop: 20 }}>
                Никаких прямых чатов. Только комментарии на уровне тикета задачи. Стадийные гейты по
                зависимостям: тикет не открывается, пока не приняты те, от которых он зависит.
              </p>
            </div>
            <div className="stack" style={{ gap: 20 }}>
              <Reason
                title="Защита от обхода"
                body="Прямой контакт между специалистами — готовый канал увести проект мимо бюро. Нет канала — нет утечки."
              />
              <Reason
                title="Чистота метрик"
                body="Когда договорённости живут в личных чатах, время отклика и долю переделок посчитать нечем. Тикет — единственное измеримое место."
              />
              <Reason
                title="Дисциплина зависимостей"
                body="Гейты заставляют фиксировать, что именно передано дальше, вместо «мы устно договорились»."
              />
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="shell">
          <div className="split">
            <div>
              <span className="eyebrow">Два пути</span>
              <h2>Клиент или специалист</h2>
            </div>
            <div className="grid grid-2">
              <div className="panel panel-accent">
                <div className="label label-accent">Клиент</div>
                <h3 style={{ marginTop: 12 }}>У меня участок</h3>
                <p className="muted" style={{ marginTop: 10 }}>
                  Опишите проект. Движок проверит его на продуктовую границу и соберёт команду.
                </p>
                <Link href="/brief" className="btn btn-solid">
                  Оставить бриф
                </Link>
              </div>
              <div className="panel">
                <div className="label">Специалист</div>
                <h3 style={{ marginTop: 12 }}>Я веду разделы</h3>
                <p className="muted" style={{ marginTop: 10 }}>
                  Заявка с двенадцатью измерениями. Порог по портфолио — {PORTFOLIO_THRESHOLD}/10.
                </p>
                <Link href="/specialists" className="btn">
                  Подать заявку
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

function Figure({ value, unit, note }: { value: string; unit: string; note: string }) {
  return (
    <div style={{ borderTop: '1px solid var(--border-strong)', paddingTop: 18 }}>
      <div className="row" style={{ gap: 10, alignItems: 'baseline' }}>
        <span className="num" style={{ fontSize: '2.4rem', color: 'var(--accent)' }}>
          {value}
        </span>
        <span className="label">{unit}</span>
      </div>
      <p className="dim" style={{ marginTop: 8, marginBottom: 0, fontSize: '0.9rem' }}>
        {note}
      </p>
    </div>
  )
}

function Reason({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <div className="label label-accent">{title}</div>
      <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>
        {body}
      </p>
    </div>
  )
}
