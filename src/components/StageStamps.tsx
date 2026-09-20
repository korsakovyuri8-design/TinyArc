'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Три стадии как чертёжные клейма.
 *
 * Не медальоны с портретами: людей в пуле выдумывать нельзя, а лицо из
 * генератора на месте специалиста — первое, о чём спросит любой архитектор, и
 * первое, на чём сайт потеряет доверие.
 *
 * Клеймо честнее и ближе к делу. Так помечают проверенный лист: номер, имя
 * стадии, состояние. Печать ставят, когда работа принята, — и здесь она
 * ставится на глазах, когда блок доходит до середины экрана.
 */

type Stage = {
  public: string
  internal: string
  note: string
}

export function StageStamps({ stages }: { stages: readonly Stage[] }) {
  const frame = useRef<HTMLDivElement>(null)
  const [struck, setStruck] = useState(false)

  /*
   * Печать ставится один раз и не снимается при обратной прокрутке.
   * Клеймо, которое то появляется, то исчезает, — это анимация; клеймо,
   * которое поставили, — это состояние. Второе и имелось в виду.
   */
  useEffect(() => {
    const node = frame.current
    if (!node) return

    const watcher = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setStruck(true)
          watcher.disconnect()
        }
      },
      { threshold: 0.35 },
    )

    watcher.observe(node)
    return () => watcher.disconnect()
  }, [])

  return (
    <div ref={frame} className={`stamps${struck ? ' is-struck' : ''}`}>
      {stages.map((stage, i) => (
        <article key={stage.public} className="stamp" style={{ '--order': i } as React.CSSProperties}>
          <div className="stamp-mark" aria-hidden>
            <svg viewBox="0 0 120 120">
              {/*
                Двойное кольцо и засечки по кругу — как на штемпеле поверки.
                Рисунок не декоративный: он читается как «проверено», а не как
                «красиво», и именно это тут нужно сказать.
              */}
              <circle className="stamp-ring" cx="60" cy="60" r="52" />
              <circle className="stamp-ring stamp-ring-inner" cx="60" cy="60" r="43" />
              {Array.from({ length: 24 }, (_, t) => {
                const angle = (t / 24) * Math.PI * 2
                const x1 = 60 + Math.cos(angle) * 43
                const y1 = 60 + Math.sin(angle) * 43
                const x2 = 60 + Math.cos(angle) * 48
                const y2 = 60 + Math.sin(angle) * 48
                return <line key={t} className="stamp-tick" x1={x1} y1={y1} x2={x2} y2={y2} />
              })}
              <text className="stamp-number" x="60" y="60" textAnchor="middle" dominantBaseline="central">
                {String(i + 1).padStart(2, '0')}
              </text>
            </svg>
          </div>

          <div className="stamp-body">
            <span className="mono stamp-public">{stage.public}</span>
            <h3>{stage.internal}</h3>
            <p>{stage.note}</p>
          </div>
        </article>
      ))}
    </div>
  )
}
