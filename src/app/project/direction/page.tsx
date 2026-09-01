import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { directionOpen, directionsOf } from '@/lib/services/direction'
import { currentProjectId } from '@/lib/session'
import { mailer } from '@/lib/mail'
import { DirectionPicker } from './DirectionPicker'
import { ChosenDirection } from '@/components/ChosenDirection'

export const metadata = { title: 'Project direction — TinyArc Cloud Bureau' }

export default async function DirectionPage({
  searchParams,
}: {
  searchParams: Promise<{ issued?: string }>
}) {
  const { issued } = await searchParams
  const projectId = await currentProjectId()
  if (!projectId) redirect('/enter')

  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) redirect('/enter')

  const directions = await directionsOf(projectId)

  // Выбор закрыт — значит, до команды он уже не дойдёт: проект сдан или мы за
  // него не взялись. Экран тогда не спрашивает, а показывает.
  const open = directionOpen(project.status)
  const chosen = directions.find((d) => d.chosen)

  return (
    <section style={{ paddingTop: 'clamp(40px, 7vw, 72px)' }}>
      <div className="shell">
        <span className="eyebrow">Direction</span>
        <h1 style={{ maxWidth: '20ch' }}>How the building relates to the site</h1>

        <p className="lead" style={{ marginTop: 22, maxWidth: '58ch' }}>
          The variants follow from your brief: typology, terrain and material system. Nothing inapplicable appears here — terracing, for instance, shows up only on a slope.
        </p>

        <p className="note" style={{ marginTop: 22 }}>
          This is neither a design nor a promise. The choice fixes the direction for the team to move in and settles nothing about structure, areas or codes. The team may show that what you chose is impossible on this site — that is the work going normally, not an agreement being broken.
        </p>

        {issued === '1' && (
          <div className="panel panel-accent" style={{ marginTop: 28 }}>
            <div className="label label-accent">Access key</div>
            <p className="num" style={{ fontSize: '1.3rem', color: 'var(--accent)', margin: '12px 0' }}>
              {project.clientKey}
            </p>
            {/*
              Две вещи, и обе всплыли на пустом стенде в первый же день.
              Фраза была по-русски — на первом экране, который видит заказчик,
              и сторожевая проверка её не поймала: вставка `{' '}` разрывала
              кусок разметки, а проверка искала текст без вставок. И фраза
              врала: при выключенной почте копия никуда не уходит, а человек,
              которому обещали письмо, закрывает страницу с ключом и уходит
              его ждать.
            */}
            <p className="muted" style={{ marginBottom: 0, fontSize: '0.9rem' }}>
              {mailer().mode === 'stub' ? (
                <>
                  Save it: this key is how you come back to the workspace from any device. Email
                  delivery is off here, so no copy has been sent — this screen is the only place it
                  is shown.
                </>
              ) : (
                <>
                  Save it: this key is how you come back to the workspace from any device. A copy
                  has gone to {project.clientEmail}.
                </>
              )}
            </p>
          </div>
        )}

        {directions.length === 0 || !open ? (
          <div className="panel" style={{ marginTop: 40 }}>
            <div className="label">{chosen ? 'The direction is fixed' : 'No directions'}</div>
            <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
              {project.status === 'rejected'
                ? 'The project is outside the product boundary — there is nothing to choose a direction for.'
                : project.status === 'delivered'
                  ? 'The project is closed. What is below is the record of what was fixed at the start — it is not changed after the fact. If you want to go a different way, that is new work: write to the bureau.'
                  : 'The variants are not prepared yet.'}
            </p>
            {!open && chosen && (
              <div style={{ marginTop: 24 }}>
                <ChosenDirection direction={chosen} audience="client" />
              </div>
            )}
            <p style={{ marginTop: 16, marginBottom: 0 }}>
              <Link href="/project">To the project cabinet →</Link>
            </p>
          </div>
        ) : (
          <div style={{ marginTop: 40 }}>
            <DirectionPicker
              directions={directions.map((d) => ({
                key: d.key,
                title: d.title,
                summary: d.summary,
                tradeoff: d.tradeoff,
                imageUrl: d.imageUrl,
                source: d.source,
                chosen: d.chosen,
              }))}
            />
          </div>
        )}

        {/*
          «Можно выбрать позже» — правда ровно до тех пор, пока выбор до кого-то
          доходит. На сданном и на отказном проекте эта строка обещала то, чего
          продукт не сделает, и стояла прямо под абзацем, который говорил
          обратное. Уходить в кабинет по-прежнему есть откуда — ссылка выше.
        */}
        {open && (
          <>
            <div className="divider" style={{ marginTop: 48 }} />
            <Link href="/project" className="dim">
              Skip and go to the cabinet — a direction can be chosen later
            </Link>
          </>
        )}
      </div>
    </section>
  )
}
