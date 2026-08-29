/**
 * Выбранное клиентом направление — то, что видит команда.
 *
 * Показывается одинаково клиенту, специалисту и бюро: направление принадлежит
 * проекту, а не чьему-то экрану. Формулировка про необязывающий характер
 * стоит рядом всегда и намеренно: без неё картинка со временем превращается в
 * то, что предъявляют на приёмке.
 */

export type ChosenDirectionView = {
  title: string
  summary: string
  tradeoff: string
  imageUrl: string
  source: string
}

export function ChosenDirection({
  direction,
  audience,
  t,
}: {
  direction: ChosenDirectionView
  audience: 'client' | 'team'
  /**
   * Переводчик приходит сверху: компонент показывают три разные стороны, и у
   * каждой свой язык. Название и описание направления переводятся тем же
   * словарём — набор направлений фиксирован кодом, а не введён человеком.
   */
  t: (text: string) => string
}) {
  return (
    <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 260px) minmax(0, 1fr)' }}>
        <img
          src={direction.imageUrl}
          alt={t(direction.title)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />

        <div style={{ padding: 22 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="label label-accent">{t('Направление проекта')}</span>
            {direction.source === 'stub' && <span className="tag">{t('схема')}</span>}
          </div>

          <h3 style={{ marginTop: 12, fontFamily: 'var(--serif)' }}>{t(direction.title)}</h3>

          <p className="muted" style={{ marginTop: 10, fontSize: '0.92rem' }}>
            {t(direction.summary)}
          </p>

          <p className="dim" style={{ marginTop: 12, marginBottom: 0, fontSize: '0.84rem' }}>
            {audience === 'team'
              ? t('Выбрано клиентом до начала работ. Это ориентир, а не требование: если направление на этом участке нереализуемо, скажите об этом в тикете.')
              : t('Ваш выбор. Ориентир для команды — не проектное решение и не часть комплекта документации.')}
          </p>
        </div>
      </div>
    </div>
  )
}
