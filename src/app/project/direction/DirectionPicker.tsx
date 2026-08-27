'use client'

import { useActionState, useState } from 'react'
import { pickDirection, type DirectionState } from './actions'

export type DirectionCard = {
  key: string
  title: string
  summary: string
  tradeoff: string
  imageUrl: string
  source: string
  chosen: boolean
}

export function DirectionPicker({ directions }: { directions: DirectionCard[] }) {
  const [state, action, pending] = useActionState<DirectionState, FormData>(pickDirection, {})
  const [selected, setSelected] = useState(directions.find((d) => d.chosen)?.key ?? '')

  return (
    <form action={action}>
      <div className="grid grid-2">
        {directions.map((direction) => (
          <label
            key={direction.key}
            className={selected === direction.key ? 'panel panel-accent' : 'panel'}
            style={{ display: 'block', cursor: 'pointer', padding: 0, margin: 0, letterSpacing: 'normal', textTransform: 'none' }}
          >
            <input
              type="radio"
              name="key"
              value={direction.key}
              checked={selected === direction.key}
              onChange={() => setSelected(direction.key)}
              className="visually-hidden"
            />

            <img
              src={direction.imageUrl}
              alt={direction.title}
              style={{ width: '100%', display: 'block', borderBottom: '1px solid var(--border)' }}
            />

            <div style={{ padding: 22 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className={selected === direction.key ? 'label label-accent' : 'label'}>
                  {selected === direction.key ? 'выбрано' : 'вариант'}
                </span>
                {direction.source === 'stub' && <span className="tag">схема</span>}
              </div>

              <h3 style={{ marginTop: 12, fontFamily: 'var(--serif)' }}>{direction.title}</h3>

              <p className="muted" style={{ marginTop: 10, fontSize: '0.92rem' }}>
                {direction.summary}
              </p>

              <div className="label" style={{ marginTop: 16 }}>
                Чем оплачивается
              </div>
              <p className="dim" style={{ marginTop: 6, marginBottom: 0, fontSize: '0.86rem' }}>
                {direction.tradeoff}
              </p>
            </div>
          </label>
        ))}
      </div>

      {state.error && (
        <div className="note note-fail" style={{ marginTop: 24 }}>
          {state.error}
        </div>
      )}

      <div className="row" style={{ gap: 16, marginTop: 32 }}>
        <button type="submit" className="btn btn-solid" disabled={pending || !selected}>
          {pending ? 'Сохраняем…' : 'Это направление'}
        </button>
        <span className="dim" style={{ fontSize: '0.85rem' }}>
          {selected ? 'Выбор уйдёт команде до первого тикета' : 'Выберите один вариант'}
        </span>
      </div>
    </form>
  )
}
