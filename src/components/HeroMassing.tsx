'use client'

import { useEffect, useState } from 'react'

/**
 * Первый экран: объём, который вычерчивается латунью в темноте.
 *
 * Два языка, которые принято считать несовместимыми, здесь стоят вместе
 * намеренно. Тёплый уголь, терракотовый отсвет и латунь — это Средиземноморье
 * и старый Голливуд: то, за чем к архитектуре и приходят. Геометрия, точность
 * хода и число рядом — это алгоритм.
 *
 * Стык и есть смысл. Бюро, которое обещает алгоритмическую сборку, а
 * показывает чужую виллу из фотобанка, теряет доверие на первом экране.
 * Поэтому здесь не фотография, а чертёж, — но вычерченный так, как вычерчивал
 * бы человек, которому не всё равно.
 *
 * Сами четыре решения — те же, что движок выдаёт под настоящий бриф.
 */

type Option = {
  key: string
  title: string
  cost: string
  paths: string[]
}

const W = 640
const H = 380
const GROUND = 310

const OPTIONS: Option[] = [
  {
    key: 'courtyard',
    title: 'Courtyard',
    cost: 'Privacy comes from the plan, not from a fence',
    paths: [
      `M 150 ${GROUND} L 490 ${GROUND}`,
      `M 175 ${GROUND} L 175 145 L 465 145 L 465 ${GROUND}`,
      'M 250 265 L 390 265 L 390 195 L 250 195 Z',
      'M 175 205 L 465 205',
    ],
  },
  {
    key: 'pavilions',
    title: 'Pavilions',
    cost: 'Perimeter and envelope cost rise; services run between the blocks',
    paths: [
      `M 120 ${GROUND} L 520 ${GROUND}`,
      `M 145 ${GROUND} L 145 220 L 250 220 L 250 ${GROUND}`,
      `M 288 ${GROUND} L 288 170 L 400 170 L 400 ${GROUND}`,
      `M 430 ${GROUND} L 430 232 L 515 232 L 515 ${GROUND}`,
      'M 250 272 L 288 272',
      'M 400 272 L 430 272',
    ],
  },
  {
    key: 'compact',
    title: 'Compact volume',
    cost: 'Less façade frontage and fewer viewpoints; the plan is rigid',
    paths: [
      `M 195 ${GROUND} L 445 ${GROUND}`,
      `M 225 ${GROUND} L 225 158 L 415 158 L 415 ${GROUND}`,
      'M 225 222 L 415 222',
      'M 320 158 L 320 310',
    ],
  },
  {
    key: 'linear',
    title: 'Linear volume',
    cost: 'Long service runs; it needs a site with a pronounced long side',
    paths: [
      `M 80 ${GROUND} L 560 ${GROUND}`,
      `M 100 ${GROUND} L 100 212 L 540 212 L 540 ${GROUND}`,
      'M 190 212 L 190 310',
      'M 320 212 L 320 310',
      'M 450 212 L 450 310',
    ],
  },
]

function Grid() {
  const step = 40
  const lines: string[] = []
  for (let x = step; x < W; x += step) lines.push(`M ${x} 0 L ${x} ${H}`)
  for (let y = step; y < H; y += step) lines.push(`M 0 ${y} L ${W} ${y}`)

  return (
    <g className="night-grid">
      {lines.map((d) => (
        <path key={d} d={d} />
      ))}
    </g>
  )
}

export function HeroMassing() {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const timer = setTimeout(() => setIndex((i) => (i + 1) % OPTIONS.length), 6000)
    return () => clearTimeout(timer)
  }, [index, paused])

  const option = OPTIONS[index]!

  return (
    <figure
      className="night-massing"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${option.title}: massing diagram`}>
        <defs>
          {/*
            Латунь не однотонная. Градиент по ходу линии даёт тот перелив, по
            которому металл отличается от краски, — и он же не даёт чертежу
            выглядеть напечатанным.
          */}
          <linearGradient id="brass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#c9a227" />
            <stop offset="45%" stopColor="#e8c86a" />
            <stop offset="100%" stopColor="#a8792c" />
          </linearGradient>

          <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <Grid />

        <g key={option.key} className="night-lines" filter="url(#glow)">
          {option.paths.map((d, i) => (
            <g key={d}>
              <path d={d} style={{ animationDelay: `${i * 260}ms` }} />
              {/*
                Головка плоттера. Она и есть разница между «линия появилась» и
                «линию провели»: глаз следит за точкой, а не за краем заливки.
              */}
              <circle className="night-head" r="3.5">
                <animateMotion
                  dur="1.2s"
                  begin={`${i * 0.26}s`}
                  fill="freeze"
                  keyPoints="0;1"
                  keyTimes="0;1"
                  calcMode="spline"
                  keySplines="0.22 1 0.36 1"
                  path={d}
                />
              </circle>
            </g>
          ))}
        </g>
      </svg>

      <figcaption>
        <div className="night-row">
          <span className="mono night-title">{option.title}</span>
          <span className="mono night-count">
            {String(index + 1).padStart(2, '0')} / {String(OPTIONS.length).padStart(2, '0')}
          </span>
        </div>
        <p className="night-cost">{option.cost}</p>

        <div className="night-dots" role="tablist" aria-label="Massing options">
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
