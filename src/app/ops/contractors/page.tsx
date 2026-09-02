import Link from 'next/link'
import { redirect } from 'next/navigation'
import { JURISDICTIONS, JURISDICTION_NAMES, PORTFOLIO_THRESHOLD, SCALE_BANDS, TYPOLOGIES } from '@/engine/taxonomy'
import { TRADES } from '@/engine/trades'
import { Choices, Field } from '@/components/Fields'
import { CONTRACTOR_REJECTION_LABELS, SCALE_BAND_LABELS, TRADE_LABELS, TYPOLOGY_LABELS } from '@/lib/labels'
import { prisma } from '@/lib/db'
import { fill } from '@/lib/fill'
import { insuredOn } from '@/lib/services/contractors'
import { isOperator } from '@/lib/session'
import { OpsAction } from '../OpsForms'
import { addContractor, setContractorStatus } from '../actions'

export const metadata = { title: 'Contractors — bureau panel' }

/**
 * Потолок тот же, что у пула, и по той же причине: страница обязана
 * открываться. Сеть растёт импортом, и таблица без предела однажды перестаёт
 * быть списком.
 */
const SHOWN = 200

export default async function ContractorsPage() {
  if (!(await isOperator())) redirect('/ops')

  const now = new Date()

  const [rows, total] = await Promise.all([
    prisma.contractor.findMany({ orderBy: [{ status: 'asc' }, { displayName: 'asc' }], take: SHOWN }),
    prisma.contractor.count(),
  ])

  return (
    <section style={{ paddingTop: 'clamp(40px, 7vw, 72px)' }}>
      <div className="shell">
        <span className="eyebrow">Bureau panel</span>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h1>Contractor network</h1>
          <Link href="/ops" className="btn btn-quiet">
            To the panel
          </Link>
        </div>

        <p className="muted" style={{ marginTop: 14, maxWidth: '68ch' }}>
          The client pays for access to the shortlist. A contractor never pays for a place in it — there is no field for that, here or in the engine. Selection works the same way as for specialists: hard gates first, then a score, then three names.
        </p>

        <div className="divider" style={{ marginTop: 40 }} />

        <h2>Add a contractor</h2>
        <p className="muted" style={{ marginTop: 12, marginBottom: 20, maxWidth: '64ch' }}>
          {fill(
            'Entered by the bureau, one at a time: the network is built by hand. Below {threshold}/10 the record is kept but stays out of selection.',
            { threshold: PORTFOLIO_THRESHOLD },
          )}
        </p>

        <div className="panel">
          <OpsAction action={addContractor} label="Add to the network" solid>
            <div className="grid grid-2" style={{ marginBottom: 18 }}>
              <Field label="Name" name="displayName">
                <input id="displayName" name="displayName" type="text" maxLength={120} required />
              </Field>
              <Field label="Email" name="email">
                <input id="email" name="email" type="email" maxLength={200} required />
              </Field>
              <Field label="Portfolio rating, 0–10" name="portfolioRating">
                <input id="portfolioRating" name="portfolioRating" type="number" min={0} max={10} step={0.1} defaultValue={8} />
              </Field>
              <Field label="Portfolio link" name="portfolioUrl">
                <input id="portfolioUrl" name="portfolioUrl" type="url" maxLength={2000} />
              </Field>
              <Field
                label="Insurance valid until"
                name="insuredUntil"
                hint="Without a date the contractor does not pass the insurance gate — a tick with no expiry never expires"
              >
                <input id="insuredUntil" name="insuredUntil" type="date" />
              </Field>
              <Field
                label="Municipalities"
                name="municipalities"
                hint="Comma-separated, as written locally. Empty means the whole country"
              >
                <input id="municipalities" name="municipalities" type="text" maxLength={400} />
              </Field>
            </div>

            <Field label="Works carried out" name="trades">
              <Choices name="trades" options={TRADES} labels={TRADE_LABELS as Record<string, string>} />
            </Field>
            <Field label="Entitled to work in" name="jurisdictions">
              <Choices name="jurisdictions" options={JURISDICTIONS} labels={JURISDICTION_NAMES} />
            </Field>
            <Field label="Typologies built" name="typologies">
              <Choices name="typologies" options={TYPOLOGIES} labels={TYPOLOGY_LABELS} />
            </Field>
            <Field label="Scale led" name="scaleBands">
              <Choices name="scaleBands" options={SCALE_BANDS} labels={SCALE_BAND_LABELS} />
            </Field>
          </OpsAction>
        </div>

        <div className="divider" style={{ marginTop: 48 }} />

        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2>In the network</h2>
          <span className="num dim">{total}</span>
        </div>

        {rows.length === 0 ? (
          <p className="dim" style={{ marginTop: 16 }}>
            The network is empty. Until it has someone, the shortlist on a project card is empty too — and that is stated there rather than hidden.
          </p>
        ) : (
          <>
            {total > rows.length && (
              <p className="hint" style={{ marginTop: 14 }}>
                {fill('Shown {count} of {total}.', { count: rows.length, total })}
              </p>
            )}
            <div className="table-scroll panel" style={{ marginTop: 18, padding: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Contractor</th>
                    <th>Works</th>
                    <th>Where</th>
                    <th>Portfolio</th>
                    <th>Insurance</th>
                    <th>State</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const covered = insuredOn(row, now)

                    return (
                      <tr key={row.id}>
                        <td>{row.displayName}</td>
                        <td className="dim" style={{ fontSize: '0.82rem' }}>
                          {(JSON.parse(row.tradesJson) as string[])
                            .map((trade) => TRADE_LABELS[trade] ?? trade)
                            .join(', ')}
                        </td>
                        <td className="dim" style={{ fontSize: '0.82rem' }}>
                          {(JSON.parse(row.municipalitiesJson) as string[]).join(', ') ||
                            (JSON.parse(row.jurisdictionsJson) as string[])
                              .map((code) => JURISDICTION_NAMES[code as keyof typeof JURISDICTION_NAMES] ?? code)
                              .join(', ')}
                        </td>
                        <td className="num">{row.portfolioRating.toFixed(1)}</td>
                        <td>
                          {/*
                            Полис показывается состоянием на сегодня, а не
                            галочкой: просроченный гасит гейт сам, и бюро должно
                            видеть это раньше, чем подрядчик исчезнет из выдачи
                            без объяснения.
                          */}
                          {covered ? (
                            <span className="tag tag-pass">valid</span>
                          ) : (
                            <span className="tag tag-fail">
                              {row.insuredUntil ? 'expired' : 'no date'}
                            </span>
                          )}
                        </td>
                        <td>
                          {row.status === 'rejected' ? (
                            <span className="dim" style={{ fontSize: '0.82rem' }}>
                              {CONTRACTOR_REJECTION_LABELS.portfolio}
                            </span>
                          ) : (
                            <OpsAction
                              action={setContractorStatus}
                              hidden={{
                                contractorId: row.id,
                                status: row.status === 'active' ? 'paused' : 'active',
                              }}
                              label={row.status === 'active' ? 'Take out' : 'Put back'}
                            />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
