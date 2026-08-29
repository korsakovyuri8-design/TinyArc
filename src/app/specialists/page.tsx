import { Link } from '@/components/Link'
import { fill } from '@/lib/i18n/fill'
import { translator } from '@/lib/i18n'
import { pageMetadata } from '@/lib/i18n/metadata'
import { PORTFOLIO_THRESHOLD } from '@/engine/taxonomy'

export const generateMetadata = () =>
  pageMetadata(
    'Специалистам',
    'Пул специалистов Bureau: отбор по двенадцати измерениям, порог по портфолио 8/10, работа по тикетам, метрики вместо отзывов.',
  )

export default async function SpecialistsPage() {
  const { locale, t } = await translator()

  return (
    <>
      <section style={{ paddingTop: 'clamp(48px, 8vw, 96px)' }}>
        <div className="shell">
          <span className="eyebrow">{t('Пул')}</span>
          <h1 style={{ maxWidth: '16ch' }}>{t('Проекты приходят к вам, а не вы к ним')}</h1>
          <p className="lead" style={{ marginTop: 24, maxWidth: '54ch' }}>{t('Ни тендеров, ни писем «расскажите о себе», ни торга по ставке. Движок сам решает, кто попадает в команду, — по фактам, которые вы заявили, и по тому, как вы сдавали прошлые тикеты.')}</p>
          <Link locale={locale} href="/specialists/apply" className="btn btn-solid" style={{ marginTop: 32 }}>{t('Подать заявку')}</Link>
        </div>
      </section>

      <section>
        <div className="shell">
          <span className="eyebrow">{t('Условия честные, но не мягкие')}</span>
          <div className="grid grid-2">
            <Term
              title={fill(t('Порог по портфолио — {threshold}/10'), {
                threshold: PORTFOLIO_THRESHOLD,
              })}
              body={t('Гейт стоит до скоринга. Ниже порога заявка не проходит, какой бы свободной ни была ваша неделя.')}
            />
            <Term
              title={t('Оценок не существует')}
              body={t('Ни клиент, ни бюро не могут поставить вам балл. Считаются только сроки, приёмка с первого раза, время отклика и круги правок.')}
            />
            <Term
              title={t('Прямых чатов нет')}
              body={t('Вы видите свой тикет и комментарии по нему. Соседей по команде — как роли, не как имена.')}
            />
            <Term
              title={t('Метрики двигают доступ')}
              body={t('Сорванные сроки снижают Quality и убирают вас из следующих команд. Без разбирательств и без второго шанса, выданного вручную.')}
            />
            <Term
              title={t('Ёмкость — это множитель')}
              body={t('Формула Quality × Availability. Нулевая свободная ёмкость обнуляет балл: качество недоступность не компенсирует.')}
            />
            <Term
              title={t('Плата за доступ')}
              body={t('Подписка специалиста — за доступ к проектам. Комиссии с вашей ставки нет.')}
            />
          </div>
        </div>
      </section>

      <section>
        <div className="shell">
          <div className="split">
            <div>
              <span className="eyebrow">{t('Как идёт работа')}</span>
              <h2>{t('Тикет, гейт, приёмка')}</h2>
            </div>
            <div className="stack" style={{ gap: 22 }}>
              <Step n="01" title={t('Тикет открывается гейтом')}>{t('Пока не приняты задачи, от которых зависит ваша, тикет закрыт. Вы видите название и стадию, но не содержание — входных артефактов ещё нет.')}</Step>
              <Step n="02" title={t('Вы работаете и комментируете в тикете')}>{t('Первый содержательный ответ засекает Response Time. Всё общение — в тикете, и это единственное место, где его вообще можно вести.')}</Step>
              <Step n="03" title={t('Бюро принимает или возвращает на круг')}>{t('Приёмка в срок и с первого раза поднимает Quality. Возврат добавляет круг правок и снижает First Time Right.')}</Step>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="shell">
          <div className="row" style={{ gap: 16 }}>
            <Link locale={locale} href="/specialists/apply" className="btn btn-solid">{t('Подать заявку')}</Link>
            <Link locale={locale} href="/enter" className="btn btn-quiet">{t('У меня уже есть ключ')}</Link>
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
