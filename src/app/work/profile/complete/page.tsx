import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PORTFOLIO_THRESHOLD } from '@/engine/taxonomy'
import { SpecialistForm } from '@/components/SpecialistForm'
import { toProfile } from '@/lib/rows'
import { currentSpecialist } from '@/lib/session'
import { completeProfile } from './actions'
import { pageMetadata } from '@/lib/metadata'
import { fill } from '@/lib/fill'

export const metadata = pageMetadata('Complete your profile')

export default async function CompleteProfilePage() {
  const row = await currentSpecialist()
  if (!row) redirect('/enter')

  // Профиль, уже ушедший на разбор, здесь не правится: поля отбора меняются
  // через бюро, иначе человек правит собственный балл.
  if (row.status !== 'invited') redirect('/work/profile')

  const profile = toProfile(row)

  return (
    <section style={{ paddingTop: 'clamp(40px, 7vw, 72px)' }}>
      <div className="shell" style={{ maxWidth: 760 }}>
        <Link href="/work/profile" className="label">
          ← profile
        </Link>

        <h1 style={{ marginTop: 18 }}>
          {fill('{name}, complete your profile', { name: profile.displayName })}
        </h1>

        <p className="muted" style={{ marginTop: 16 }}>The bureau invited you — you did not apply. From our records we know your name and address, and possibly your discipline and country: those are already ticked below. The rest only you know.</p>

        <div className="panel" style={{ marginTop: 28 }}>
          <div className="label label-accent">What these fields are for</div>
          <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>The team for a project is assembled by an algorithm, not a person. It selects on facts: jurisdiction, software suite, stage, language, time zone, free capacity. An empty field is not “neutral”, it is “does not pass”: half of them are hard gates. Until the profile is filled in, you are simply not in the pool.</p>
        </div>

        <p className="hint" style={{ marginTop: 20, marginBottom: 36 }}>
          {fill(
            'Once saved, the profile goes for portfolio review. The threshold is {threshold}/10, and the bureau sets the rating: you give facts about yourself, not a rating of yourself.',
            { threshold: PORTFOLIO_THRESHOLD },
          )}
        </p>

        <SpecialistForm
          askConsent

          action={completeProfile}
          submitLabel="Send for review"
          defaults={{
            portfolioUrl: row.portfolioUrl,
            disciplines: profile.disciplines,
            specializations: profile.specializations,
            typologies: profile.typologies,
            materialSystems: profile.materialSystems,
            climateZones: profile.climateZones,
            jurisdictions: profile.jurisdictions,
            software: profile.software,
            languages: profile.languages,
            docStages: profile.docStages,
            maxStoreys: String(row.maxStoreys),
            utcOffset: String(row.utcOffset),
          }}
          done={
            <div className="panel panel-accent">
              <div className="label label-accent">Profile submitted</div>
              <h3 style={{ marginTop: 12 }}>Next — the portfolio review</h3>
              <p className="muted" style={{ marginTop: 12, marginBottom: 16 }}>
                {/*
                  Про ключ сказано полностью. «Ключ у вас уже есть» правда
                  ровно пока держится эта сессия: у двери ключ на разборе не
                  работает, и человек, вернувшийся завтра, читал там отказ,
                  которого его не предупреждали.
                */}
                {fill(
                  'The bureau reviews the portfolio and sets the rating. The threshold is {threshold}/10. The access key is the one you signed in with — keep it: at the door it starts working once the review passes.',
                  { threshold: PORTFOLIO_THRESHOLD },
                )}
              </p>
              <Link href="/work/profile">To the profile →</Link>
            </div>
          }
        />
      </div>
    </section>
  )
}
