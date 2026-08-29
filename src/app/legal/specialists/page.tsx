import Link from 'next/link'
import { fill } from '@/lib/fill'
import { pageMetadata } from '@/lib/metadata'
import { GOVERNING_LAW, LEGAL_VERSION, company, isIdentified } from '@/lib/legal'
import { MIN_TIMEZONE_OVERLAP_HOURS, PORTFOLIO_THRESHOLD } from '@/engine/taxonomy'

export const metadata = pageMetadata(
  'Terms for specialists',
  'Terms of taking part in the pool: selection by algorithm, access, tickets, acceptance, metrics, leaving a project.',
)

/**
 * Условия участия в пуле.
 *
 * Написаны потому, что специалист до сих пор соглашался с офертой — договором
 * о том, как бюро оказывает услугу заказчику. Про него самого там нет ничего:
 * ни отбора алгоритмом, ни подписки как гейта, ни метрик, ни запрета прямых
 * чатов, ни правил выхода из проекта. Человек ставил галочку под чужим
 * документом, и это тот случай, когда согласие есть, а согласия нет.
 *
 * Здесь нет ни одного условия, которого не было бы в продукте. Гонорар за
 * тикет — единственное, что живёт вне системы, и об этом сказано прямо, а не
 * обойдено молчанием: выдуманная ставка в документе хуже её отсутствия.
 */
export default function SpecialistTermsPage() {
  const details = company()
  const identified = isIdentified(details)

  return (
    <section style={{ paddingTop: 'clamp(40px, 7vw, 72px)', paddingBottom: 80 }}>
      <div className="shell" style={{ maxWidth: 760 }}>
        <span className="eyebrow">Legal</span>
        <h1>Terms for specialists</h1>

        <p className="dim" style={{ marginTop: 12, fontSize: '0.85rem' }}>
          Revision {LEGAL_VERSION} · governing law — {GOVERNING_LAW}
        </p>

        <div className="panel panel-accent" style={{ marginTop: 28 }}>
          <div className="label label-accent">Before you read</div>
          <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
            This is a working revision, drafted alongside the product and describing exactly
            how it works. It does not replace review by a lawyer in the jurisdiction of
            registration, and it is subject to that review before the first paid engagement.
          </p>
        </div>

        {!identified && (
          <div className="panel" style={{ marginTop: 20, borderColor: 'var(--fail)' }}>
            <div className="label" style={{ color: 'var(--fail)' }}>Company details are not filled in</div>
            <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
              The company name, registration number and address come from environment settings
              and are currently empty. Until they are set, this document is not an agreement:
              there is no one to enter into it with.
            </p>
          </div>
        )}

        <Article title="1. Who this is between">
          <p>
            The Bureau — {details.name || '— name not filled in —'}
            {details.registration && `, registration number ${details.registration}`}
            {details.address && `, address: ${details.address}`}, Montenegro — and you, an
            independent specialist taking part in the pool. Nothing here creates employment,
            exclusivity, or an obligation to be available.
          </p>
          <p>
            The language of the service is English: briefs, tickets, correspondence and the
            documentation set are all in English, and a working command of it is a condition
            of taking part.
          </p>
        </Article>

        <Article title="2. How a project reaches you">
          <p>
            Teams are assembled by an algorithm from what you declared and from how you
            delivered earlier tickets. No one at the Bureau picks the people for a project:
            there is no field for that anywhere in the system.
          </p>
          <p>
            {fill(
              'Hard gates come before any scoring: discipline and specialisation, jurisdiction and signing rights, storeys, documentation stage, model exchange, a language in common with the client and with the authorities, at least {overlap} hours of working-day overlap, free capacity, and a portfolio rating of {threshold}/10 or above.',
              { overlap: MIN_TIMEZONE_OVERLAP_HOURS, threshold: PORTFOLIO_THRESHOLD },
            )}
          </p>
          <p>
            Failing a gate is not a judgement of you. The system says which condition was not
            met, and that is all it says.
          </p>
        </Article>

        <Article title="3. Access to projects">
          <p>
            Access is a subscription, and it is a gate rather than a score: without it you are
            not in selection at all, whatever your portfolio and metrics. It is checked before
            the portfolio deliberately — being turned away over money must not look like being
            turned away over qualification.
          </p>
          <p>
            The supply side pays for access to demand. <strong>No commission is taken from
            your fee.</strong> Access is free during the pilot; any change to that is a new
            revision of this document and does not apply retroactively.
          </p>
        </Article>

        <Article title="4. The portfolio review">
          <p>
            {fill(
              'The Bureau reviews the portfolio and sets a rating from 0 to 10. The threshold is {threshold}: below it an application does not pass, and that follows from the rule rather than from anyone’s discretion.',
              { threshold: PORTFOLIO_THRESHOLD },
            )}
          </p>
          <p>
            Declaring more than you have done is not to your advantage: a mismatch surfaces on
            the very first ticket and settles into the metrics.
          </p>
        </Article>

        <Article title="5. How the work goes">
          <p>
            Work comes as tickets. The Bureau writes the brief and accepts the work; the
            deadline is stated in hours and runs from the moment the ticket opens, not from
            the moment you see it. A ticket that other tasks depend on does not open until
            those are accepted.
          </p>
          <p>
            Acceptance means “done as specified”. If it is not, the work comes back for
            another round with the reason written in the ticket. A revision round is counted
            in the delivery metrics and nowhere else.
          </p>
        </Article>

        <Article title="6. No direct channels">
          <p>
            There are no direct chats between specialists — not discouraged, but not built.
            You see your ticket and its comments; teammates appear as roles, not as names, and
            their contact details do not exist in the system.
          </p>
          <p>
            Anything you need from an adjacent discipline becomes a ticket for that discipline
            through the Bureau. A dispute is ruled on by the Bureau, and work on the ticket
            stops until it does.
          </p>
        </Article>

        <Article title="7. What is measured, and what is not">
          <p>
            Four metrics are computed from ticket events: deadlines met, acceptance first
            time, time to a first substantive reply, revision rounds per ticket. They are not
            editable by anyone, the Bureau included.
          </p>
          <p>
            There is no field for rating a person — not for the client, not for the Bureau. No
            opinions about you are stored anywhere in the system.
          </p>
        </Article>

        <Article title="8. Leaving a project">
          <p>
            You may leave a role on a project. A reason is required and stays in the records;
            it does not become a rating, and leaving does not enter selection: penalising an
            honest withdrawal teaches silence, and silence surfaces later and costs more.
          </p>
          <p>
            The whole role goes: your open tasks on that project pass to the next by rank from
            the same run. Work already accepted stays yours — it is in your metrics, and no
            one rewrites it.
          </p>
        </Article>

        <Article title="9. Your fee">
          <p>
            The fee for the work is agreed with the Bureau separately and is paid by the
            Bureau, not by the client: your agreement is with us, and it is the Bureau that
            answers to the client for the result.
          </p>
          <p>
            This is the one part the product does not do yet: the system holds no rates and
            makes no payments. Stating a rate here that the system cannot honour would be
            worse than saying so plainly.
          </p>
        </Article>

        <Article title="10. Rights in the work">
          <p>
            The documentation set is delivered to the client in full, and rights in it pass to
            the client on payment for the stage. You keep the right to state the fact of the
            work and to show it in your own portfolio in anonymised form — typology, area,
            stage, country, your part in it — without the address of the property, the
            client’s name, or the contents of the set.
          </p>
        </Article>

        <Article title="11. Your data">
          <p>
            What we hold, why, and who it goes to is set out in the{' '}
            <Link href="/legal/privacy">data processing policy</Link>. Two things from it
            belong here: your contact details never reach the client, and your profile is
            anonymised on request — the name, the address, the portfolio link and the works
            go, and the delivery metrics remain in the anonymised form they already had.
          </p>
        </Article>

        <Article title="12. Changes to these terms">
          <p>
            The revision is marked by the date at the top of the document. The revision in
            force at the moment of your consent is the one that binds; it is recorded together
            with the timestamp. A translation made for convenience does not bind either side:
            where a translation differs from this text, this text governs.
          </p>
        </Article>

        <div className="divider" style={{ marginTop: 44 }} />

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
