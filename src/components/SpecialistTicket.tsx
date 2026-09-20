'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Что специалист видит в работе.
 *
 * Не клуб с кожаными креслами и не обещания. Один настоящий тикет: постановка,
 * срок, гонорар, кнопка сдачи. Это весь его день в бюро, и показать его
 * честнее, чем описывать словами, чего он не увидит, пока не войдёт.
 *
 * Выбор именно этого экрана не случаен. Специалист решает не по тому, как
 * красиво написано «международная команда», а по трём вещам: что делать,
 * сколько платят, когда сдавать. Здесь они стоят рядом, и рядом же стоит то,
 * о чём другие площадки молчат, — что заказчика он не увидит, за него говорит
 * бюро.
 */

const STEPS = [
  { at: 0, label: 'Ticket opened' },
  { at: 1, label: 'Work in progress' },
  { at: 2, label: 'Handed over' },
  { at: 3, label: 'Accepted, fee accrued' },
] as const

export function SpecialistTicket() {
  const frame = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState(0)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    const node = frame.current
    if (!node) return
    const watcher = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRunning(true)
          watcher.disconnect()
        }
      },
      { threshold: 0.4 },
    )
    watcher.observe(node)
    return () => watcher.disconnect()
  }, [])

  /*
   * Тикет проходит свой путь сам, один раз. Не бесконечная петля: повтор
   * превратил бы работу в заставку, а показать надо, что у неё есть конец, —
   * и конец этот называется «принято, гонорар начислен».
   */
  useEffect(() => {
    if (!running || step >= STEPS.length - 1) return
    const timer = setTimeout(() => setStep((s) => s + 1), 1600)
    return () => clearTimeout(timer)
  }, [running, step])

  const done = step >= STEPS.length - 1

  return (
    <div ref={frame} className="ticket">
      <header className="ticket-head">
        <span className="mono ticket-id">TKT-1042 · STRUCTURAL · PERMIT</span>
        <span className={`mono ticket-state${done ? ' is-done' : ''}`}>
          {STEPS[step]!.label}
        </span>
      </header>

      <div className="ticket-body">
        <h4>Structural section, villa on a slope</h4>
        <p>
          Foundations on a terraced site, retaining wall along the north boundary. Concrete frame,
          two storeys. The architectural model is in ArchiCAD; exchange at IFC 4.
        </p>

        <dl className="ticket-facts">
          <div>
            <dt>Due</dt>
            <dd className="mono">14 working days</dd>
          </div>
          <div>
            <dt>Fee</dt>
            <dd className="mono">€730</dd>
          </div>
          <div>
            <dt>Client</dt>
            <dd>You do not meet them. The bureau speaks for you</dd>
          </div>
        </dl>

        <div className="ticket-track" aria-hidden>
          {STEPS.map((s) => (
            <span key={s.label} className={s.at <= step ? 'is-passed' : undefined} />
          ))}
        </div>

        <button type="button" className={`ticket-hand${done ? ' is-done' : ''}`} disabled>
          {done ? 'Accepted — €730 accrued' : 'Hand over the section'}
        </button>
      </div>
    </div>
  )
}
