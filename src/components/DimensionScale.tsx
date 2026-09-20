'use client'

import { useState } from 'react'

/**
 * Двенадцать измерений как латунная шкала.
 *
 * Не консоль с тумблерами: тумблер обещает, что им можно управлять, а
 * управлять здесь нечем, это анкета специалиста, а не настройки. Обещать
 * взаимодействие и не давать его хуже, чем не обещать.
 *
 * Шкала честнее: у каждого измерения есть значения, и их можно показать.
 * Человек ведёт по списку, и рядом проступает то, из чего измерение состоит, 
 * не абстрактная «юрисдикция», а тридцать стран, не «конструктив», а бетон,
 * металл, дерево, кладка и гибрид. Глубина системы видна сразу, и она не
 * нарисована, а взята из той же таксономии, по которой собирается команда.
 */

type Dimension = {
  name: string
  /** Значения, как они есть в таксономии. Выдумывать нечего и не нужно. */
  values: string
}

export function DimensionScale({ dimensions }: { dimensions: readonly Dimension[] }) {
  const [active, setActive] = useState(0)

  return (
    <div className="scale">
      <ol className="scale-list">
        {dimensions.map((dimension, i) => (
          <li key={dimension.name}>
            <button
              type="button"
              className={i === active ? 'is-active' : undefined}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onClick={() => setActive(i)}
            >
              <span className="mono scale-index">{String(i + 1).padStart(2, '0')}</span>
              <span className="scale-name">{dimension.name}</span>
              {/*
                Штрих справа, та самая шкала. У активного измерения он длиннее
                и ярче: положение на шкале читается боковым зрением, без чтения.
              */}
              <span className="scale-tick" aria-hidden />
            </button>
          </li>
        ))}
      </ol>

      <div className="scale-readout" aria-live="polite">
        <span className="mono scale-readout-index">
          {String(active + 1).padStart(2, '0')}
        </span>
        <h4>{dimensions[active]!.name}</h4>
        {/* Ключ по значению перезапускает проявление: смена должна быть видна. */}
        <p key={active}>{dimensions[active]!.values}</p>
      </div>
    </div>
  )
}
