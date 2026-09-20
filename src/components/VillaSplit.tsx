'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Вилла, у которой половина уходит в чертёж.
 *
 * Слева камень, черепица, арки, тень под карнизом. Справа то же самое, но
 * латунными линиями: оси, отметки, размерные выноски. Граница между ними
 * проходит по середине и движется, когда человек ведёт мышью.
 *
 * Это и есть продукт в одном кадре. Заказчик приходит за тем, что слева, и
 * думает, что покупает это. На деле он покупает то, что справа, и разница
 * между двумя половинами, ровно та работа, за которую платят бюро.
 *
 * Нарисовано целиком кодом. Фотография виллы есть у каждого бюро, и любая
 * взятая из фотобанка выдала бы себя на сайте, который обещает работу по
 * фактам. Вектор беднее фотографии в деталях и честнее в главном: здесь всё,
 * что видно, нарисовано под этот проект.
 */

const W = 720
const H = 400
const GROUND = 330

/** Аркада: повторяющийся мотив, по которому средиземноморский дом и узнаётся. */
function arcade(x0: number, count: number, width: number, top: number, bottom: number) {
  const paths: string[] = []
  for (let i = 0; i < count; i += 1) {
    const x = x0 + i * width
    const r = width / 2
    paths.push(
      `M ${x} ${bottom} L ${x} ${top + r} A ${r} ${r} 0 0 1 ${x + width} ${top + r} L ${x + width} ${bottom}`,
    )
  }
  return paths
}

export function VillaSplit() {
  const frame = useRef<HTMLDivElement>(null)
  const [cut, setCut] = useState(52)

  /*
   * Граница ведётся мышью, но не прыгает за ней: движение сглажено, потому что
   * резкий скачок читался бы как переключатель, а нужен переход. У края
   * оставлен запас, иначе одну из половин можно было бы схлопнуть совсем, а
   * смысл картинки именно в том, что их две.
   */
  const onMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const node = frame.current
    if (!node) return
    const box = node.getBoundingClientRect()
    const raw = ((event.clientX - box.left) / box.width) * 100
    setCut(Math.max(18, Math.min(86, raw)))
  }

  const [drawn, setDrawn] = useState(false)

  useEffect(() => {
    const node = frame.current
    if (!node) return
    const watcher = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setDrawn(true)
          watcher.disconnect()
        }
      },
      { threshold: 0.3 },
    )
    watcher.observe(node)
    return () => watcher.disconnect()
  }, [])

  const arches = arcade(150, 5, 76, 190, GROUND)

  return (
    <div
      ref={frame}
      className={`villa${drawn ? ' is-drawn' : ''}`}
      onMouseMove={onMove}
      onMouseLeave={() => setCut(52)}
      style={{ '--cut': `${cut}%` } as React.CSSProperties}
    >
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="A villa, half built and half drawn">
        <defs>
          <linearGradient id="villa-plaster" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e6d5bd" />
            <stop offset="100%" stopColor="#cbb094" />
          </linearGradient>

          <linearGradient id="villa-roof" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#b5603a" />
            <stop offset="100%" stopColor="#8d4529" />
          </linearGradient>

          <linearGradient id="villa-brass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#c9a227" />
            <stop offset="50%" stopColor="#e8c86a" />
            <stop offset="100%" stopColor="#a8792c" />
          </linearGradient>

          {/* Маски делят кадр по подвижной границе: слева камень, справа чертёж. */}
          <clipPath id="villa-left">
            <rect x="0" y="0" width={`${cut}%`} height={H} />
          </clipPath>
          <clipPath id="villa-right">
            <rect x={`${cut}%`} y="0" width={W} height={H} />
          </clipPath>
        </defs>

        {/* --- Построенная половина ------------------------------------- */}
        <g clipPath="url(#villa-left)">
          <rect x="120" y="190" width="460" height="140" fill="url(#villa-plaster)" />

          {/* Карниз и черепица: два ската, по которым дом и читается южным. */}
          <path d="M 100 190 L 350 120 L 600 190 Z" fill="url(#villa-roof)" />
          <path d="M 100 190 L 600 190 L 600 200 L 100 200 Z" fill="#8d4529" opacity="0.75" />

          {arches.map((d) => (
            <path key={d} d={d} fill="#5d4a38" opacity="0.5" />
          ))}

          {/* Тень под карнизом: без неё штукатурка выглядит бумагой. */}
          <rect x="120" y="190" width="460" height="18" fill="#000" opacity="0.14" />
        </g>

        {/* --- Начерченная половина -------------------------------------- */}
        <g clipPath="url(#villa-right)" className="villa-draft">
          <rect x="120" y="190" width="460" height="140" className="villa-line" />
          <path d="M 100 190 L 350 120 L 600 190 Z" className="villa-line" />

          {arches.map((d) => (
            <path key={d} d={d} className="villa-line" />
          ))}

          {/* Оси и размеры: то, чего на фасаде не видно, но без чего нет комплекта. */}
          <path d="M 350 90 L 350 360" className="villa-axis" />
          <path d="M 120 360 L 580 360" className="villa-axis" />
          <path d="M 120 355 L 120 365 M 580 355 L 580 365" className="villa-axis" />
          <text x="350" y="378" className="villa-dim" textAnchor="middle">
            18 400
          </text>
          <path d="M 610 190 L 610 330 M 605 190 L 615 190 M 605 330 L 615 330" className="villa-axis" />
          <text x="628" y="264" className="villa-dim">
            3 200
          </text>
        </g>

        {/* Земля идёт через обе половины: участок один, как его ни рисуй. */}
        <path d={`M 60 ${GROUND} L 660 ${GROUND}`} className="villa-ground" />

        {/* Черта раздела: тонкая, латунная, видимая. Это шов, а не стык. */}
        <line x1={`${cut}%`} y1="0" x2={`${cut}%`} y2={H} className="villa-seam" />
      </svg>

      <div className="villa-legend">
        <span className="mono">What they come for</span>
        <span className="mono villa-legend-right">What they actually buy</span>
      </div>
    </div>
  )
}
