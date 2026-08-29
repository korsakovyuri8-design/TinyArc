import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PORTFOLIO_THRESHOLD } from '@/engine/taxonomy'
import { prisma } from '@/lib/db'
import { isOperator } from '@/lib/session'
import { MAX_IMPORT_ROWS } from '@/lib/services/intake'
import { previewIntake, runIntake, sendInvites } from '../actions'
import { OpsAction } from '../OpsForms'

export const metadata = { title: 'Database import — bureau panel' }

export default async function ImportPage() {
  if (!(await isOperator())) redirect('/ops')

  const [invited, waiting, silent] = await Promise.all([
    prisma.specialist.count({ where: { status: 'invited' } }),
    prisma.specialist.count({ where: { status: 'invited', invitedAt: null } }),
    prisma.specialist.count({
      where: {
        status: 'invited',
        invitedAt: { lt: new Date(Date.now() - 7 * 24 * 3_600_000) },
      },
    }),
  ])

  return (
    <section style={{ paddingTop: 'clamp(40px, 7vw, 72px)' }}>
      <div className="shell" style={{ maxWidth: 900 }}>
        <Link href="/ops" className="label">
          ← panel
        </Link>
        <h1 style={{ marginTop: 18 }}>Specialist database import</h1>

        <p className="muted" style={{ marginTop: 14, maxWidth: '62ch' }}>
          The import lets no one into selection. It creates a record, issues a key and invites the person to fill in their profile. Until then the portfolio rating is zero and the threshold is {PORTFOLIO_THRESHOLD}
          /10: the very first gate stops such a record.
        </p>

        <p className="hint" style={{ marginTop: 12, maxWidth: '62ch' }}>
          That is by design. A database assembled by hand holds no jurisdictions, no software suite, no time zone and no free capacity. Selecting on such a record would assemble a team out of defaults — and it would show on the project, not before it.
        </p>

        {invited > 0 && (
          <div className="panel" style={{ marginTop: 28 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div>
                <div className="num" style={{ fontSize: '2rem' }}>{invited}</div>
                <div className="label">created, profile not filled in</div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                {waiting > 0 && <span className="tag tag-accent">not invited · {waiting}</span>}
                {silent > 0 && <span className="tag tag-wait">silent over a week · {silent}</span>}
              </div>
            </div>
          </div>
        )}

        <div className="divider" style={{ marginTop: 40 }} />

        <h2>What the table needs</h2>
        <p className="muted" style={{ marginTop: 12, maxWidth: '62ch' }}>
          Two columns are required: <strong>name</strong> and <strong>email</strong>. The rest as far as you have it; what is missing the person fills in themselves. Headers are recognised in English and in Russian, and the separator can be a comma, a semicolon or a tab.
        </p>

        {/*
          Примеры заголовков и значений, а не интерфейс: импорт принимает
          таблицы, собранные руками, и русские заголовки в них встречаются
          чаще английских. Поэтому здесь кириллица остаётся намеренно, и
          сквозная проверка языка эту таблицу пропускает по метке.
        */}
        <div className="table-scroll panel" data-sample style={{ padding: 0, marginTop: 20 }}>
          <table>
            <thead>
              <tr>
                <th>Column</th>
                <th>What it may be called</th>
                <th>What is understood</th>
              </tr>
            </thead>
            <tbody>
              <Row
                name="Name"
                aliases="name, имя, фио, specialist"
                reads="as written"
              />
              <Row name="Email" aliases="email, почта, адрес" reads="checked for address shape" />
              <Row name="Role" aliases="role, discipline, роль, дисциплина" reads="“Architect”, “Structural engineer”, “HVAC”, “Landscape architect”" />
              <Row name="Specialisation" aliases="specialisation, специализация" reads="“Concrete”, “Timber, CLT”, “Master plan”" />
              <Row name="Country" aliases="country, jurisdiction, страна" reads="“Montenegro”, “ME”, “Черногория”, “Tivat”" />
              <Row name="Software" aliases="software, софт, ПО" reads="“Revit”, “ArchiCAD”, “AutoCAD”" />
              <Row name="Language" aliases="language, язык, языки" reads="“English”, “Serbian”, “русский”" />
              <Row name="Stage" aliases="stage, стадия, стадии" reads="“Concept”, “Permit”, “Construction documentation”" />
              <Row name="Portfolio" aliases="portfolio, портфолио, behance" reads="the link as written" />
              <Row name="Storey count" aliases="storeys, этажность, этажи" reads="a number; anything above five is cut to five" />
            </tbody>
          </table>
        </div>

        <p className="hint" style={{ marginTop: 14 }}>
          Columns outside this list are not imported — and do not get in the way: the parse names them so you can see what stayed out. A value absent from the taxonomy is not guessed at either: “Quantity surveyor” lands in the report, not in a discipline.
        </p>

        <div className="divider" style={{ marginTop: 40 }} />

        <h2>Paste the table</h2>
        <p className="muted" style={{ marginTop: 12, marginBottom: 24, maxWidth: '62ch' }}>
          Copy it from Excel or Google Sheets together with the header row. First <strong>“Parse”</strong> — it creates nothing and only shows what the system read. Creating the records is the second button.
        </p>

        <OpsAction action={previewIntake} label="Parse">
          <div className="field">
            <label htmlFor="csv-preview">Table</label>
            <textarea
              id="csv-preview"
              name="csv"
              style={{ minHeight: 200, fontFamily: 'var(--font-space-mono), monospace', fontSize: '0.8rem' }}
              placeholder={'Name;Email;Role;Country;Software;Language;Portfolio\nMarko Petrović;marko@example.com;Architect;Montenegro;ArchiCAD;English, Serbian;https://behance.net/marko'}
            />
          </div>
        </OpsAction>

        <div className="divider" style={{ marginTop: 40 }} />

        <h2>Create the records</h2>
        <p className="muted" style={{ marginTop: 12, marginBottom: 24, maxWidth: '62ch' }}>
          Paste the same table again — deliberately: creating records must not happen from a second press on the preview form. Addresses already in the database are skipped: the import does not overwrite a profile the person may have filled in themselves. One pass takes up to {MAX_IMPORT_ROWS} rows; the rest on the next one.
        </p>

        <OpsAction action={runIntake} label="Create the records" solid>
          <div className="field">
            <label htmlFor="csv-run">Table</label>
            <textarea
              id="csv-run"
              name="csv"
              style={{ minHeight: 200, fontFamily: 'var(--font-space-mono), monospace', fontSize: '0.8rem' }}
            />
          </div>
        </OpsAction>

        <div className="divider" style={{ marginTop: 40 }} />

        <h2>Invite those created</h2>
        <p className="muted" style={{ marginTop: 12, marginBottom: 24, maxWidth: '62ch' }}>
          The email with the key and the profile link goes to those created and not yet invited. A separate button, not part of creation: inserting the records is one query, an email is a network call per person, and tying them together would make loading the database depend on a mail provider.
        </p>

        <OpsAction action={sendInvites} label="Send the invitations" solid />

        <p className="hint" style={{ marginTop: 16 }}>
          It runs in batches — if more are waiting, press again. Only someone the email actually reached is marked invited: otherwise a person would silently drop out of the mailing for good. With the stub mailer nothing is sent anywhere, and the keys are visible in the invited list on the applications page — hand them over through whatever channel you already use.
        </p>
      </div>
    </section>
  )
}

function Row({ name, aliases, reads }: { name: string; aliases: string; reads: string }) {
  return (
    <tr>
      <td>{name}</td>
      <td className="dim" style={{ fontSize: '0.85rem' }}>{aliases}</td>
      <td className="dim" style={{ fontSize: '0.85rem' }}>{reads}</td>
    </tr>
  )
}
