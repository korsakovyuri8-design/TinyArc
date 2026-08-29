import Link from 'next/link'
import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata('Page not found')

/**
 * Страница несуществующего адреса.
 *
 * Сюда попадают тремя путями, и все три — не «человек ошибся в наборе».
 * По устаревшей ссылке из старого письма; по адресу закрытого проекта; по
 * чужому тикету — потому что чужое у нас неотличимо от несуществующего, и это
 * решение принято намеренно (п.13).
 *
 * Поэтому здесь сказано и то, чего обычно не пишут: одинаковый ответ на «нет
 * такого» и «не ваше» — не сбой. Человек, вошедший не той стороной, иначе
 * будет считать, что система потеряла его проект.
 *
 * Выходы отсюда — те же три двери, что и на входе: главная, бриф, вход по
 * ключу. Страница без выхода превращает опечатку в конец сеанса.
 */
export default async function NotFound() {

  return (
    <section style={{ paddingTop: 'clamp(48px, 8vw, 96px)' }}>
      <div className="shell" style={{ maxWidth: 620 }}>
        <span className="eyebrow">404</span>
        <h1 style={{ maxWidth: '18ch' }}>There is no such address</h1>

        <p className="lead" style={{ marginTop: 20 }}>The link may be out of date — from an old email, say. An address that exists but is not yours answers the same way: someone else’s project and someone else’s ticket are indistinguishable from ones that do not exist, deliberately — otherwise the answer itself could be used to check what we hold.</p>

        <div className="divider" style={{ marginTop: 36 }} />

        <div className="stack" style={{ gap: 10 }}>
          <Link href="/">To the home page</Link>
          <Link href="/enter">Sign in with a key — project cabinet or work board</Link>
          <Link href="/brief">Submit a brief for your own project</Link>
        </div>
      </div>
    </section>
  )
}
