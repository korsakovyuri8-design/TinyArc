'use client'

import { useEffect } from 'react'

/**
 * Страница сбоя.
 *
 * Показывается вместо содержимого, когда серверная отрисовка упала. Она не
 * извиняется абстрактно: человеку нужно знать, потерялось ли то, что он делал,
 * и что нажать сейчас. Повтор — первым, потому что в половине случаев это
 * сорванное соединение с базой, и второй заход проходит.
 *
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Страница упала:', error)
  }, [error])


  return (
    <section style={{ paddingTop: 'clamp(48px, 8vw, 96px)' }}>
      <div className="shell" style={{ maxWidth: 620 }}>
        <span className="eyebrow">Failure</span>
        <h1 style={{ maxWidth: '18ch' }}>The page did not come together</h1>

        <p className="lead" style={{ marginTop: 20 }}>This is our side, not yours. What you sent earlier — a brief, a comment, an uploaded file — is where you left it: the failure happened while showing the page, not while writing.</p>

        <div className="row" style={{ gap: 16, marginTop: 32 }}>
          <button type="button" className="btn btn-solid" onClick={reset}>
            Try again
          </button>
          <a href="/" className="btn btn-quiet">
            To the home page
          </a>
        </div>

        {/*
          Цифра сбоя — то, по чему его находят в журнале. Без неё разговор с
          бюро сводится к «у меня что-то не открылось», и найти это «что-то»
          можно только по времени.
        */}
        {error.digest && (
          <p className="hint" style={{ marginTop: 24 }}>
            If it happens again, give the bureau this mark:{' '}
            <span className="num">{error.digest}</span>
          </p>
        )}
      </div>
    </section>
  )
}
