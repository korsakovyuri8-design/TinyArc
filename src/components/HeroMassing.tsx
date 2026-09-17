'use client'

import { useEffect, useState } from 'react'

/**
 * Первый экран: объём, который собирается из линий.
 *
 * Не украшение и не сток. Это те же четыре объёмных решения, которые движок
 * выдаёт под настоящий бриф, — двор, павильоны, компактный объём, линейный, — и
 * та же геометрия, что уходит команде. Человек на главной видит ровно то, что
 * получит, а не картинку из фотобанка.
 *
 * Схема рисуется штрихом: линии проступают по очереди, как на кальке. Приём
 * выбран не ради моды — он показывает, что здание разбирается на элементы, а
 * это и есть то, чем бюро занимается. Рендер показал бы результат; чертёж
 * показывает работу.
 */

type Option = {
  key: string
  title: string
  cost: string
  /** Пути в порядке отрисовки. Порядок — это и есть сборка. */
  paths: string[]
}

const W = 640
const H = 360
const GROUND = 300

const OPTIONS: Option[] = [
  {
    key: 'courtyard',
    title: 'Courtyard',
    cost: 'Privacy comes from the plan, not from a fence',
    paths: [
      `M 160 ${GROUND} L 480 ${GROUND}`,
      `M 180 ${GROUND} L 180 140 L 460 140 L 460 ${GROUND}`,
      'M 250 260 L 390 260 L 390 190 L 250 190 Z',
    ],
  },
  {
    key: 'pavilions',
    title: 'Pavilions',
    cost: 'Perimeter and envelope cost rise; services run between the blocks',
    paths: [
      `M 130 ${GROUND} L 510 ${GROUND}`,
      `M 150 ${GROUND} L 150 215 L 250 215 L 250 ${GROUND}`,
      `M 285 ${GROUND} L 285 170 L 395 170 L 395 ${GROUND}`,
      `M 420 ${GROUND} L 420 225 L 505 225 L 505 ${GROUND}`,
      'M 250 265 L 285 265',
      'M 395 265 L 420 265',
    ],
  },
  {
    key: 'compact',
    title: 'Compact volume',
    cost: 'Less façade frontage and fewer viewpoints; the plan is rigid',
    paths: [
      `M 200 ${GROUND} L 440 ${GROUND}`,
      `M 230 ${GROUND} L 230 155 L 410 155 L 410 ${GROUND}`,
      'M 230 215 L 410 215',
    ],
  },
  {
    key: 'linear',
    title: 'Linear volume',
    cost: 'Long service runs; it needs a site with a pronounced long side',
    paths: [
      `M 90 ${GROUND} L 550 ${GROUND}`,
      `M 110 ${GROUND} L 110 205 L 530 205 L 530 ${GROUND}`,
      'M 200 205 L 200 300',
      'M 320 205 L 320 300',
      'M 440 205 L 440 300',
    ],
  },
]

/** Сетка как на кальке: шаг крупный, линия тонкая, разговора не перебивает. */
function Grid() {
  const step = 40
  const lines: string[] = []
  for (let x = step; x < W; x += step) lines.push(`M ${x} 0 L ${x} ${H}`)
  for (let y = step; y < H; y += step) lines.push(`M 0 ${y} L ${W} ${y}`)

  return (
    <g className="hero-grid">
      {lines.map((d) => (
        <path key={d} d={d} />
      ))}
    </g>
  )
}

export function HeroMassing() {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  /*
   * Смена сама по себе, но останавливается под курсором: если человек
   * задержался на варианте, значит он его читает, и уводить схему из-под него
   * значит мешать.
   */
  useEffect(() => {
    if (paused) return
    const timer = setTimeout(() => setIndex((i) => (i + 1) % OPTIONS.length), 5200)
    return () => clearTimeout(timer)
  }, [index, paused])

  const option = OPTIONS[index]!

  return (
    <figure
      className="hero-massing"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${option.title}: massing diagram`}>
        <Grid />

        {/*
          Ключ по варианту заставляет React пересоздать пути, а не переиспользовать
          их. Без этого линии меняли бы форму на месте, и рисунок выглядел бы
          перетеканием, а не новым чертежом.
        */}
        <g key={option.key} className="hero-lines">
          {option.paths.map((d, i) => (
            <path key={d} d={d} style={{ animationDelay: `${i * 220}ms` }} />
          ))}
        </g>
      </svg>

      <figcaption>
        <div className="hero-massing-row">
          <span className="mono hero-massing-title">{option.title}</span>
          <span className="mono hero-massing-count">
            {String(index + 1).padStart(2, '0')} / {String(OPTIONS.length).padStart(2, '0')}
          </span>
        </div>
        <p className="hint">{option.cost}</p>

        <div className="hero-massing-dots" role="tablist" aria-label="Massing options">
          {OPTIONS.map((o, i) => (
            <button
              key={o.key}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={o.title}
              className={i === index ? 'is-current' : undefined}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      </figcaption>
    </figure>
  )
}
