import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PORTFOLIO_THRESHOLD } from '@/engine/taxonomy'
import { SpecialistForm } from '@/components/SpecialistForm'
import { toProfile } from '@/lib/rows'
import { currentSpecialist } from '@/lib/session'
import { completeProfile } from './actions'

export const metadata = { title: 'Заполнить профиль — TinyArc Cloud Bureau' }

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
          ← профиль
        </Link>

        <h1 style={{ marginTop: 18 }}>{profile.displayName}, заполните профиль</h1>

        <p className="muted" style={{ marginTop: 16 }}>
          Вас позвало бюро — заявку вы не подавали. Из нашей базы известны имя и адрес, и,
          возможно, дисциплина со страной: они уже отмечены ниже. Остальное знаете только вы.
        </p>

        <div className="panel" style={{ marginTop: 28 }}>
          <div className="label label-accent">Зачем эти поля</div>
          <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
            Команду под проект собирает алгоритм, а не человек. Он отбирает по фактам:
            юрисдикция, пакет, стадия, язык, часовой пояс, свободная ёмкость. Пустое поле —
            это не «нейтрально», это «не проходит»: половина из них — жёсткие гейты. Пока
            профиль не заполнен, вас просто нет в выборке.
          </p>
        </div>

        <p className="hint" style={{ marginTop: 20, marginBottom: 36 }}>
          После сохранения профиль уходит на разбор портфолио. Порог — {PORTFOLIO_THRESHOLD}/10,
          и рейтинг ставит бюро: вы даёте данные о себе, а не оценку себе.
        </p>

        <SpecialistForm
          action={completeProfile}
          submitLabel="Отправить на разбор"
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
              <div className="label label-accent">Профиль отправлен</div>
              <h3 style={{ marginTop: 12 }}>Дальше — разбор портфолио</h3>
              <p className="muted" style={{ marginTop: 12, marginBottom: 16 }}>
                Бюро смотрит портфолио и ставит рейтинг. Порог — {PORTFOLIO_THRESHOLD}/10.
                Ключ доступа у вас уже есть — тот же, по которому вы вошли.
              </p>
              <Link href="/work/profile">К профилю →</Link>
            </div>
          }
        />
      </div>
    </section>
  )
}
