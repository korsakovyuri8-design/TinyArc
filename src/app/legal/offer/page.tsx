import Link from 'next/link'
import { fill } from '@/lib/fill'
import { pageMetadata } from '@/lib/metadata'
import { DOC_STAGE_LABELS } from '@/lib/labels'
import { GOVERNING_LAW, LEGAL_VERSION, company, isIdentified } from '@/lib/legal'
import { JURISDICTIONS, JURISDICTION_NAMES, MAX_STOREYS } from '@/engine/taxonomy'

export const generateMetadata = () =>
  pageMetadata(
    'Terms of service',
    'Условия оказания услуг: состав комплекта, цена, оплата по стадиям, ответственность.',
  )

/**
 * Публичная оферта.
 *
 * Написана под то, как продукт устроен на самом деле, а не под шаблон из сети:
 * оплата по стадиям вперёд (п.14а), приёмка двумя сторонами (п.12б), команду
 * собирает алгоритм (п.6), продуктовая граница по этажности и странам (п.5).
 * Договор, расходящийся с продуктом, хуже отсутствующего: по нему возникают
 * обязательства, которых система не исполняет.
 */
export default async function OfferPage() {
  const details = company()
  const identified = isIdentified(details)

  return (
    <section style={{ paddingTop: 'clamp(40px, 7vw, 72px)', paddingBottom: 80 }}>
      <div className="shell" style={{ maxWidth: 760 }}>
        <span className="eyebrow">Legal</span>
        <h1>Terms of service</h1>

        <p className="dim" style={{ marginTop: 12, fontSize: '0.85rem' }}>
          Revision {LEGAL_VERSION} · governing law — {GOVERNING_LAW}
        </p>

        <div className="panel panel-accent" style={{ marginTop: 28 }}>
          <div className="label label-accent">Before you read</div>
          <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>This is a working revision, drafted alongside the product and describing exactly how it works. It does not replace review by a lawyer in the jurisdiction of registration, and it is subject to that review before the first paid order.</p>
        </div>

        {!identified && (
          <div className="panel" style={{ marginTop: 20, borderColor: 'var(--fail)' }}>
            <div className="label" style={{ color: 'var(--fail)' }}>Company details are not filled in</div>
            <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>The company name, registration number and address come from environment settings and are currently empty. Until they are set, this offer is not a contract: there is no one to enter into it with. Invented details are deliberately not substituted here.</p>
          </div>
        )}

        <Article title="1. Who provides the service">
          <p>
            The service is provided by {details.name || '— company name not set —'}
            {details.registration && `, $registration number ${details.registration}`}
            {details.taxId && `, $tax number ${details.taxId}`}
            {details.address && `, $address: ${details.address}`} (the “Bureau”).
          </p>
          <p>The Bureau is registered in Montenegro and operates under Montenegrin law. The Client may be located in any country; this does not change the law governing the contract.</p>
        </Article>

        <Article title="2. What we do and what we do not">
          <p>The Bureau produces design documentation using a team of specialists assembled algorithmically for the specific project, and is accountable to the Client for the result as a whole.</p>
          <p>The Bureau does not perform and does not promise:</p>
          <ul>
            <li>construction work, supply of materials or site supervision;</li>
            <li>a permit as a guaranteed outcome: the Bureau prepares and submits the set, the authority makes the decision;</li>
            <li>
              {fill(
                'work outside the product boundary — the Bureau does not take buildings above {n} storeys or sites in standard (heavy) regulation zones;',
                { n: MAX_STOREYS },
              )}
            </li>
            <li>
              {fill(
                'issuing permit documentation outside the countries where the team holds signing rights. Currently those are {countries}. A project outside that list is one the Bureau cannot take — not as a matter of policy, but because there would be no one to sign the set.',
                { countries: JURISDICTIONS.map((j) => JURISDICTION_NAMES[j]).join(', ') },
              )}
            </li>
          </ul>
        </Article>

        <Article title="3. What the set contains, by stage">
          <p>
            {fill(
              'Work proceeds in stages: {stages}. The Client selects the target stage in the brief; stages beyond it are neither ordered nor paid for.',
              {
                stages: Object.values(DOC_STAGE_LABELS)
                  .map((stage) => stage.toLowerCase())
                  .join(', '),
              },
            )}
          </p>
          <p>The tasks in each stage follow from the shape of the project — typology, structural system, terrain, utility connection — and are visible to the Client in the project workspace before work begins.</p>
        </Article>

        <Article title="4. Price and payment">
          <p>The price of a stage is calculated automatically from the floor area, the stage rate, the typology multiplier and the country multiplier, but never below the minimum set for that stage. The calculation is shown to the Client together with the invoice: they see not only the amount but what it is made of.</p>
          <p>
            <strong>A stage is paid for before work on it begins.</strong>Opening a task means a specific specialist has taken it on, and the Bureau is not entitled to start a stage on credit against its contributors.</p>
          <p>An invoice for the next stage is issued only after the Client has confirmed the previous one. At no point does the Client pay in advance for work they have not yet accepted.</p>
          <p>The price stated on an issued invoice is not revised. A change in the Bureau’s rates applies only to invoices issued after the change.</p>
        </Article>

        <Article title="5. Acceptance and confirmation of a stage">
          <p>A stage closes on two acts. The Bureau accepts the work from the specialists — that means “done as specified”. The Client confirms the stage — that means “what was specified is what was ordered”.</p>
          <p>Until confirmation arrives, the next stage does not begin. The Client’s comments are received through their channel to the Bureau and turned by the Bureau into a round of revisions within the stage already paid for.</p>
        </Article>

        <Article title="6. Composition of the team">
          <p>The team for a project is determined by an algorithm from the declared and verified attributes of specialists. Neither the Client nor the Bureau appoints particular contributors: no such action exists in the system.</p>
          <p>A departing member is replaced by the next candidate in the calculation. A replacement is not a change to the terms of the contract and does not affect the price of the stage.</p>
        </Article>

        <Article title="7. Rights in the result">
          <p>Materials produced under the contract and accepted by the Bureau belong to the Client and are handed over in full on completion of the stages paid for.</p>
          <p>The Bureau may state the fact that a project was carried out, together with its anonymised characteristics (typology, area, stage, country), in its own materials. The address of the property, the Client’s name and the contents of the documentation are not disclosed without the Client’s consent.</p>
        </Article>

        <Article title="8. Liability">
          <p>The Bureau is responsible for the documentation conforming to the task set and to the requirements in force in the country of the property at the time the stage is issued.</p>
          <p>The Bureau’s liability for each stage is limited to the amount actually paid for that stage. The Bureau is not liable for losses arising from site information supplied by the Client that proves inaccurate, nor for changes in the authorities’ requirements after a stage has been issued.</p>
        </Article>

        <Article title="9. Withdrawal and refunds">
          <p>The Client may withdraw from further work at any time. A stage that has been paid for but not started (no task opened) is refunded in full. For a stage already underway, the share corresponding to tasks not yet accepted at the moment of withdrawal is refunded: accepted work was done by people and has been paid to them.</p>
          <p>The Bureau may decline a project if, after the brief, it turns out to fall outside the product boundary — with a full refund of anything paid.</p>
        </Article>

        <Article title="10. Personal data">
          <p>
            The processing of personal data is described in the{' '}
            <Link href="/legal/privacy">
              Data Processing Policy
            </Link>
            , which forms an integral part of this offer.
          </p>
        </Article>

        <Article title="11. Governing law and disputes">
          <p>The contract is governed by the law of Montenegro. Disputes not settled by negotiation are heard by the court at the Bureau’s place of registration.</p>
          <p>Where the Client is a consumer located in a country whose law affords them protection that cannot be set aside by agreement, that protection is preserved.</p>
        </Article>

        <Article title="12. Language of the offer">
          <p>
            The offer exists in English, and English is the language of the service: the
            documentation set, the briefs on tickets and the correspondence with the bureau are
            all in English. A working command of the language is a condition of joining the
            pool, and it is checked at selection like any other requirement.
          </p>
          <p>
            A translation made for convenience does not bind either side. Where a translation
            differs from this text, this text governs.
          </p>
        </Article>

        <Article title="13. Changes to this offer">
          <p>The revision of the offer is marked by the date at the top of the document. A contract already entered into is governed by the revision in force at the moment of the Client’s consent: it is recorded together with the timestamp.</p>
        </Article>

        <div className="divider" style={{ marginTop: 44 }} />

        <p className="dim" style={{ fontSize: '0.85rem' }}>
          Questions about the contract: {details.email || '— address not set —'}
        </p>

        <p style={{ marginTop: 24 }}>
          <Link href="/legal/privacy">Data processing policy →</Link>
        </p>
      </div>
    </section>
  )
}

function Article({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 40 }}>
      <h2 style={{ fontSize: '1.15rem' }}>{title}</h2>
      <div className="muted legal-body" style={{ marginTop: 12 }}>
        {children}
      </div>
    </div>
  )
}
