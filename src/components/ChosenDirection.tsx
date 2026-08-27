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
            <span className="label label-accent">Направление проекта</span>
            {direction.source === 'stub' && <span className="tag">схема</span>}
          </div>

          <h3 style={{ marginTop: 12, fontFamily: 'var(--serif)' }}>{direction.title}</h3>

          <p className="muted" style={{ marginTop: 10, fontSize: '0.92rem' }}>
            {direction.summary}
          </p>

          <p className="dim" style={{ marginTop: 12, marginBottom: 0, fontSize: '0.84rem' }}>
            {audience === 'team'
              ? 'Выбрано клиентом до начала работ. Это ориентир, а не требование: если направление на этом участке нереализуемо, скажите об этом в тикете.'
              : 'Ваш выбор. Ориентир для команды — не проектное решение и не часть комплекта документации.'}
          </p>
        </div>
      </div>
    </div>
  )
}
