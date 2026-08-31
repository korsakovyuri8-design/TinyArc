import Link from 'next/link'
import { redirect } from 'next/navigation'
import { dateTime } from '@/lib/format'
import { prisma } from '@/lib/db'
import { NOTIFICATION_LABELS } from '@/lib/labels'
import { mailer } from '@/lib/mail'
import { isOperator } from '@/lib/session'
import { OpsAction } from '../OpsForms'
import { resendLetter } from '../actions'

export const metadata = { title: 'Letters — bureau panel' }

/** Сколько строк показывать. Журнал растёт с каждым поводом. */
const SHOWN = 100

/**
 * Сколько неушедших показывать разом.
 *
 * Их не должно быть много: неушедшее письмо — это происшествие, а не строка
 * статистики. Если их больше потолка, дело не в адресах, а в почте целиком, и
 * список из тысячи строк этого не объяснит лучше, чем первые двадцать.
 */
const FAILED_SHOWN = 20

/**
 * Журнал уведомлений.
 *
 * Он писался с самого начала и не был виден нигде. На пилоте это стоило
 * дорого: почта выключена, значит систему знает, кого надо позвать, а
 * оператор — нет. Единственным следом было «скажите ему сами» в строке ответа
 * действия, а она живёт до первой перерисовки страницы.
 *
 * В бою у того же журнала другая работа: он отвечает на «мне ничего не
 * приходило» — ровно затем в нём и хранится адрес. Обезличенные строки
 * остаются с непригодным адресом: повод был, человека больше нет.
 */
export default async function LettersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (!(await isOperator())) redirect('/ops')

  const params = await searchParams
  const raw = params.q
  const query = ((Array.isArray(raw) ? raw[0] : raw) ?? '').trim()

  /*
   * Неушедшие идут отдельно и первыми, а не строкой в общем списке.
   *
   * Письмо, которое не ушло, — это человек, которого не позвали: срок по
   * задаче идёт на нём, а он об этом не знает. Раньше запись о неудаче
   * удалялась вовсе, и единственным следом была строка ответа действия,
   * живущая до перерисовки страницы.
   */
  const failed = await prisma.notification.findMany({
    where: { status: 'failed' },
    orderBy: { sentAt: 'desc' },
    take: FAILED_SHOWN,
  })

  const rows = await prisma.notification.findMany({
    orderBy: { sentAt: 'desc' },
    take: SHOWN + 1,
    // Подстрока адреса: оператор приходит сюда с жалобой, а в жалобе есть
    // адрес и нет ничего другого, за что можно зацепиться.
    where: query ? { email: { contains: query } } : undefined,
  })

  const more = rows.length > SHOWN
  const shown = rows.slice(0, SHOWN)
  const off = mailer().mode === 'stub'

  return (
    <section style={{ paddingTop: 'clamp(40px, 7vw, 72px)' }}>
      <div className="shell">
        <Link href="/ops" className="label">
          ← panel
        </Link>
        <h1 style={{ marginTop: 18 }}>Letters</h1>

        <div className={off ? 'note note-fail' : 'note'} style={{ marginTop: 24 }}>
          {off ? (
            <>
              <strong>Email delivery is off.</strong> Nothing below was actually sent. Each row is
              somebody the system would have written to — and until delivery is switched on, that
              is your list: they are waiting, and they do not know they are.
            </>
          ) : (
            <>
              <strong>Email delivery is on.</strong> Each row is an occasion the system acted on.
              A row that failed stays here marked as undelivered: the person was not reached, and
              that has to be visible after the page is reloaded, not just at the moment of the
              click.
            </>
          )}
        </div>

        {failed.length > 0 && (
          <div className="panel" style={{ marginTop: 24, borderColor: 'var(--fail)' }}>
            <div className="label label-accent">Did not go out</div>
            <p className="hint" style={{ marginTop: 8 }}>
              Each of these is somebody who was not reached. Send it again — mail fails
              temporarily more often than finally — and if it fails again, write to them by hand:
              the address is right here.
            </p>

            <div className="stack" style={{ gap: 16, marginTop: 16 }}>
              {failed.map((row) => (
                <div key={row.id}>
                  <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
                    <strong>{NOTIFICATION_LABELS[row.kind] ?? row.kind}</strong>{' '}
                    <span className="tag tag-fail">
                      {row.attempts === 1 ? 'one attempt' : `${row.attempts} attempts`}
                    </span>
                  </div>
                  <div className="dim" style={{ fontSize: '0.85rem', marginTop: 6 }}>
                    {row.email} · {dateTime(row.sentAt)}
                  </div>
                  {row.error && (
                    <div className="dim" style={{ fontSize: '0.8rem', marginTop: 6 }}>
                      {row.error}
                    </div>
                  )}
                  <div style={{ marginTop: 10 }}>
                    <OpsAction
                      action={resendLetter}
                      hidden={{ kind: row.kind, targetId: row.targetId }}
                      label="Send again"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <form method="get" className="panel" style={{ marginTop: 24 }}>
          <div className="field">
            <label htmlFor="q">Address</label>
            <input id="q" name="q" defaultValue={query} placeholder="name@example.com" />
          </div>
          <div className="row" style={{ gap: 12, marginTop: 16 }}>
            <button type="submit" className="btn btn-solid">
              Find
            </button>
            {query && (
              <Link href="/ops/letters" className="btn btn-quiet">
                Clear
              </Link>
            )}
          </div>
          <p className="hint" style={{ marginTop: 14, marginBottom: 0 }}>
            “Nothing ever reached me” is answered here, and that is what the address is kept for.
            An anonymised person keeps their rows with an unusable address: the occasion happened,
            the person is gone.
          </p>
        </form>

        {shown.length === 0 ? (
          <p className="dim" style={{ marginTop: 32 }}>
            {query ? 'Nothing was written to that address.' : 'Nothing has been written yet.'}
          </p>
        ) : (
          <>
            <div className="table-scroll panel" style={{ marginTop: 24, padding: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Occasion</th>
                    <th>To</th>
                    <th>Outcome</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((row) => (
                    <tr key={row.id}>
                      <td>{NOTIFICATION_LABELS[row.kind] ?? row.kind}</td>
                      <td className="dim">{row.email}</td>
                      <td className="dim" style={{ whiteSpace: 'nowrap' }}>
                        {row.status === 'failed' ? 'did not go out' : off ? 'delivery off' : 'sent'}
                      </td>
                      <td className="dim" style={{ whiteSpace: 'nowrap' }}>
                        {dateTime(row.sentAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {more && (
              <p className="hint" style={{ marginTop: 12 }}>
                The most recent {SHOWN}. Narrow by address to see older ones.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  )
}
