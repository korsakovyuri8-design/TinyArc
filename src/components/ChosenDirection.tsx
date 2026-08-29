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
}: {
  direction: ChosenDirectionView
  audience: 'client' | 'team'
  /**
   * Переводчик приходит сверху: компонент показывают три разные стороны, и у
   * каждой свой язык. Название и описание направления переводятся тем же
   * словарём — набор направлений фиксирован кодом, а не введён человеком.
   */
}) {
  return (
    <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 260px) minmax(0, 1fr)' }}>
        <img
          src={direction.imageUrl}
          alt={direction.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />

        <div style={{ padding: 22 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="label label-accent">Design direction</span>
            {direction.source === 'stub' && <span className="tag">diagram</span>}
          </div>

          <h3 style={{ marginTop: 12, fontFamily: 'var(--serif)' }}>{direction.title}</h3>

          <p className="muted" style={{ marginTop: 10, fontSize: '0.92rem' }}>
            {direction.summary}
          </p>

          <p className="dim" style={{ marginTop: 12, marginBottom: 0, fontSize: '0.84rem' }}>
            {audience === 'team'
              ? 'Chosen by the client before work began. A reference point, not a requirement: if the direction cannot be built on this site, say so in the ticket.'
              : 'Your choice. A reference point for the team — not a design decision and not part of the documentation set.'}
          </p>
        </div>
      </div>
    </div>
  )
}
