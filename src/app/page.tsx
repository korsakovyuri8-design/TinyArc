import { Link } from '@/components/Link'
import { translator } from '@/lib/i18n'
import { STAGES } from '@/lib/labels'
import { MAX_STOREYS, PORTFOLIO_THRESHOLD, JURISDICTIONS, JURISDICTION_NAMES } from '@/engine/taxonomy'

export default async function Home() {
  const { locale, t } = await translator()

  return (
    <>
      <section style={{ paddingTop: 'clamp(64px, 12vw, 140px)' }}>
        <div className="shell">
          <span className="eyebrow">AI-native architectural practice</span>
          <h1 style={{ maxWidth: '18ch' }}>{t('Бюро, которое заканчивает бюро')}</h1>
          <p className="lead" style={{ marginTop: 28, maxWidth: '54ch' }}>{t('Мы не помогаем локальному архитектурному бюро. Мы занимаем его место: берём бриф, собираем команду алгоритмом и отдаём пакет документации.')}</p>

          <div className="row" style={{ marginTop: 40, gap: 16 }}>
            <Link locale={locale} href="/brief" className="btn btn-solid">{t('Оставить бриф')}</Link>
            <Link locale={locale} href="/algorithm" className="btn">{t('Посмотреть, как выбирает алгоритм')}</Link>
          </div>

          <div className="grid grid-3" style={{ marginTop: 72 }}>
            <Figure value={`${MAX_STOREYS}`} unit={t('этажей')} note={t('Продуктовая граница: зоны лёгкого регулирования')} />
            <Figure value={`${PORTFOLIO_THRESHOLD}/10`} unit={t('порог')} note={t('Ниже порога по портфолио специалист не проходит')} />
            <Figure
              value={`${JURISDICTIONS.length}`}
              unit={t('страны')}
              note={JURISDICTIONS.map((j) => t(JURISDICTION_NAMES[j])).join(' · ')}
            />
          </div>
        </div>
      </section>

      <section>
        <div className="shell">
          <span className="eyebrow">{t('Проблема')}</span>
          <div className="split">
            <div>
              <h2>{t('Локальное бюро — это не компетенция, это дефицит доступа')}</h2>
            </div>
            <div>
              <p>{t('Владелец участка платит за то, что у бюро есть люди, а у него — нет. Отбор идёт по записной книжке партнёра, координация стоит как офис, а качество специалиста измеряется репутацией на глаз.')}</p>
              <p>{t('Мы разбираем этот дефицит: пул глобальный, отбор алгоритмический, координация протокольная.')}</p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="shell">
          <span className="eyebrow">{t('Три стадии')}</span>
          <h2 style={{ marginBottom: 40 }}>Filter · Score · Relay</h2>

          <div className="grid grid-3">
            {STAGES.map((stage, i) => (
              <div key={stage.public} className="panel">
                <div className="label label-accent">
                  {String(i + 1).padStart(2, '0')} / {stage.public}
                </div>
                <h3 style={{ marginTop: 14 }}>{stage.internal}</h3>
                <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
                  {t(stage.note)}
                </p>
              </div>
            ))}
          </div>

          <p style={{ marginTop: 32 }}>
            <Link locale={locale} href="/how-it-works">{t('Подробно про каждую стадию →')}</Link>
          </p>
        </div>
      </section>

      <section>
        <div className="shell">
          <div className="split">
            <div>
              <span className="eyebrow">{t('Отбор')}</span>
              <h2>Quality × Availability</h2>
              <p style={{ marginTop: 20 }}>{t('Умножение, а не сумма. Отличный специалист без свободной ёмкости бесполезен проекту с датой: сумма позволила бы качеству компенсировать недоступность, произведение — нет.')}</p>
              <p>{t('По каждому специалисту клиент видит разбор балла целиком: рейтинг портфолио, вклад метрик поставки, соответствие проекту, фактор доступности.')}</p>
              <Link locale={locale} href="/algorithm" className="btn" style={{ marginTop: 12 }}>{t('Открыть демонстрацию')}</Link>
            </div>

            <div className="panel panel-raised">
              <div className="label">{t('Двенадцать измерений таксономии')}</div>
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
                    <span>{t(dimension)}</span>
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
              <h2>{t('Специалисты не разговаривают друг с другом')}</h2>
              <p style={{ marginTop: 20 }}>{t('Никаких прямых чатов. Только комментарии на уровне тикета задачи. Стадийные гейты по зависимостям: тикет не открывается, пока не приняты те, от которых он зависит.')}</p>
            </div>
            <div className="stack" style={{ gap: 20 }}>
              <Reason
                title={t('Защита от обхода')}
                body={t('Прямой контакт между специалистами — готовый канал увести проект мимо бюро. Нет канала — нет утечки.')}
              />
              <Reason
                title={t('Чистота метрик')}
                body={t('Когда договорённости живут в личных чатах, время отклика и долю переделок посчитать нечем. Тикет — единственное измеримое место.')}
              />
              <Reason
                title={t('Дисциплина зависимостей')}
                body={t('Гейты заставляют фиксировать, что именно передано дальше, вместо «мы устно договорились».')}
              />
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="shell">
          <div className="split">
            <div>
              <span className="eyebrow">{t('Два пути')}</span>
              <h2>{t('Клиент или специалист')}</h2>
            </div>
            <div className="grid grid-2">
              <div className="panel panel-accent">
                <div className="label label-accent">{t('Клиент')}</div>
                <h3 style={{ marginTop: 12 }}>{t('У меня участок')}</h3>
                <p className="muted" style={{ marginTop: 10 }}>{t('Опишите проект. Движок проверит его на продуктовую границу и соберёт команду.')}</p>
                <Link locale={locale} href="/brief" className="btn btn-solid">{t('Оставить бриф')}</Link>
              </div>
              <div className="panel">
                <div className="label">{t('Специалист')}</div>
                <h3 style={{ marginTop: 12 }}>{t('Я веду разделы')}</h3>
                <p className="muted" style={{ marginTop: 10 }}>
                  {t('Заявка с двенадцатью измерениями. Порог по портфолио — N/10.').replace(
                    'N',
                    String(PORTFOLIO_THRESHOLD),
                  )}
                </p>
                <Link locale={locale} href="/specialists" className="btn">{t('Подать заявку')}</Link>
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
