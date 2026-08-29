import Link from 'next/link'
import { LEGAL_VERSION, company, isIdentified } from '@/lib/legal'
import { pageMetadata } from '@/lib/metadata'

export const generateMetadata = () =>
  pageMetadata(
    'Data processing',
    'Какие данные Бюро собирает, зачем, кому передаёт и как их удалить.',
  )

/**
 * Политика обработки персональных данных.
 *
 * Написана по тому, что система делает на самом деле (п.13), а не по образцу.
 * Каждый пункт здесь проверяем по коду: выборка данных специалиста для кабинета
 * клиента задана поимённо, контакты не пересекают границу между сторонами,
 * ключ доступа — учётные данные.
 *
 * Заказчик может быть из любой страны, значит данные пересекают границы, и
 * молчать об этом нельзя: для человека из ЕС это отдельный вопрос, на который
 * документ обязан отвечать прямо.
 */
export default async function PrivacyPage() {
  const details = company()
  const identified = isIdentified(details)

  return (
    <section style={{ paddingTop: 'clamp(40px, 7vw, 72px)', paddingBottom: 80 }}>
      <div className="shell" style={{ maxWidth: 760 }}>
        <span className="eyebrow">Legal</span>
        <h1>Processing of personal data</h1>

        <p className="dim" style={{ marginTop: 12, fontSize: '0.85rem' }}>
          Revision {LEGAL_VERSION}
        </p>

        <div className="panel panel-accent" style={{ marginTop: 28 }}>
          <div className="label label-accent">In short</div>
          <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>We collect what it takes to assemble a team and issue documentation, and nothing beyond that. The client’s contact details never reach the specialists, and the specialists’ never reach the client — that is enforced not by a rule but by the fact that those fields physically never arrive in the other side’s browser.</p>
        </div>

        {!identified && (
          <div className="panel" style={{ marginTop: 20, borderColor: 'var(--fail)' }}>
            <div className="label" style={{ color: 'var(--fail)' }}>No controller named</div>
            <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>The company name and the address for enquiries come from environment settings and are currently empty. Without them there is nowhere to exercise your rights, which makes this document incomplete.</p>
          </div>
        )}

        <Article title="1. Who processes the data">
          <p>
            The controller is {details.name || '— company name not set —'}
            {details.registration && `, $registration number ${details.registration}`}
            {details.address && `, $address: ${details.address}`}, Montenegro.
          </p>
          <p>
            Enquiries on any matter regarding this data:{' '}
            {details.email || '— address not set —'}. We reply within 30 days at most.
          </p>
        </Article>

        <Article title="2. What we collect from the client">
          <ul>
            <li>name and email address — to issue an access key and to correspond;</li>
            <li>project data: typology, area, storeys, country, site, stage and the free text of the brief — the team composition and the price are calculated from these;</li>
            <li>the workspace access key — these are credentials, not an identifier;</li>
            <li>the record of consent to the offer and to this document: date, time and revision.</li>
          </ul>
          <p>We collect no payment data: there is no payment processing on this site, and payment goes by bank transfer outside the product.</p>
        </Article>

        <Article title="3. What we collect from the specialist">
          <ul>
            <li>name, email address, a link to the portfolio;</li>
            <li>professional attributes: disciplines, specialisations, typologies, materials, countries and signing rights, software, languages, stages, time zone, declared free capacity;</li>
            <li>delivery metrics, computed from task events and editable by no one, the Bureau included;</li>
            <li>the access key and the record of consent — the same as for a client.</li>
          </ul>
          <p>A portfolio is stored as a link and as structured attributes. The Bureau does not keep an archive of other people’s files.</p>
        </Article>

        <Article title="4. Why, and on what basis">
          <ul>
            <li>
              <strong>Performance of the contract.</strong>Project data and professional attributes are needed to assemble a team and issue documentation. Without them the service cannot be provided.</li>
            <li>
              <strong>Consent.</strong>Applying to the pool and submitting a brief are voluntary acts; consent can be withdrawn by writing to the address above.</li>
            <li>
              <strong>Legitimate interest.</strong>Keeping records of accepted work, issued invoices and stage confirmations — this is what reconstructs events if there is a dispute.</li>
          </ul>
        </Article>

        <Article title="5. Who the data goes to">
          <ul>
            <li>
              <strong>To the project team</strong>{' '}
              — the brief is disclosed scoped to the specific task, not in full. The client’s name and contact details are not passed on.
            </li>
            <li>
              <strong>To the client</strong>{' '}
              — the team composition with professional attributes and the score breakdown. Specialists’ email, access key and other contact details are not passed on.
            </li>
            <li>
              <strong>Between specialists</strong>{' '}
              — accepted work becomes the input to the next task, credited to the author’s discipline but not their name. No direct channel between specialists exists.
            </li>
            <li>
              <strong>To processors:</strong>application and database hosting, email delivery. They process data on our instructions and do not use it for their own purposes.</li>
          </ul>
          <p>Data is not sold, not passed to advertising networks and not used for profiling beyond computing the team composition.</p>
        </Article>

        <Article title="6. Transfers outside the country">
          <p>The Bureau is registered in Montenegro, the client may be located in any country, and hosting and email services sit outside it. That means data crosses borders.</p>
          <p>Contractual data-protection terms apply to the providers that process the data. If you are located in the European Union, you may ask on what basis such a transfer takes place.</p>
        </Article>

        <Article title="7. How long we keep data">
          <ul>
            <li>project data and correspondence with the bureau — for the life of the project and three years after it closes: that is how long claims about issued documentation live;</li>
            <li>a specialist’s profile — while they are in the pool; on request the profile is anonymised: the name, the address, the portfolio link and the works go, the access key is retired, and the delivery metrics remain in the anonymised form they already had;</li>
            <li>records of invoices and confirmations — for the period required of accounting records in the country of registration.</li>
          </ul>
        </Article>

        <Article title="8. Your rights">
          <p>You have the right to:</p>
          <ul>
            <li>find out what data of yours we hold and obtain a copy;</li>
            <li>have inaccurate data corrected;</li>
            <li>have data erased — except what we must keep by law or under an open contract;</li>
            <li>withdraw consent;</li>
            <li>object to processing based on legitimate interest;</li>
            <li>lodge a complaint with a data protection supervisory authority — in Montenegro that is the Agency for Personal Data Protection, or the corresponding authority where you are located.</li>
          </ul>
          <p>These are not statements of intent. Anonymising a profile and erasing the data of a closed project are single actions in the bureau panel, and each records the date on which it was carried out. What stays after erasure is named in advance: invoices, because keeping them is an obligation of the country of registration, and task events, because the delivery metrics of other people are computed from them.</p>

          <p>A note for specialists: there is no field anywhere, the Bureau included, for rating a person. No opinions about you are stored in the system — only task events and what you declared yourself.</p>
        </Article>

        <Article title="9. What the automated calculations do">
          <p>Team composition is computed by an algorithm. The calculation makes no judgements about a person and uses no data beyond professional attributes and task events. A specialist is shown exactly which condition was not met; a client is shown the score breakdown for every member.</p>
          <p>AI models take part in preparing drafts and images. They take no part in computing team composition, in accepting work, or in setting the order of tasks.</p>
        </Article>

        <Article title="10. Cookies">
          <p>One technical cookie is used — a signed session that remembers whose workspace you signed into. There are no analytics or advertising cookies.</p>
        </Article>

        <Article title="11. Language of this document">
          <p>
            The document exists in English, and English is the language of the service. A
            translation made for convenience does not bind either side: where a translation
            differs from this text, this text governs.
          </p>
        </Article>

        <div className="divider" style={{ marginTop: 44 }} />

        <p style={{ marginTop: 24 }}>
          <Link href="/legal/offer">← Terms of service</Link>
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
