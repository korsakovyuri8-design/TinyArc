import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { deliveryMetrics } from '@/engine/metrics'
import { PORTFOLIO_THRESHOLD, SUBSCRIPTIONS } from '@/engine/taxonomy'
import { SpecialistForm } from '@/components/SpecialistForm'
import { prisma } from '@/lib/db'
import { AVAILABILITY_LABELS, SPECIALIST_STATUS_LABELS, SUBSCRIPTION_LABELS } from '@/lib/labels'
import { toProfile } from '@/lib/rows'
import { isOperator } from '@/lib/session'
import { OpsAction } from '@/app/ops/OpsForms'
import { editSpecialist, setSubscription } from './actions'

export const metadata = { title: 'Профиль специалиста — панель бюро' }

export default async function SpecialistPage({
  params,
}: {
  params: Promise<{ specialistId: string }>
}) {
  if (!(await isOperator())) redirect('/ops')

  const { specialistId } = await params
  const row = await prisma.specialist.findUnique({ where: { id: specialistId } })
  if (!row) notFound()

  // Выходы из проектов показываются, но в отбор не входят. Решение сознательное:
  // штраф за честный отказ учит молчать, а молчание вскрывается позже и дороже.
  // Видеть их всё равно надо — по ним понятно, где заявленная ёмкость расходится
  // с настоящей.
  const withdrawals = await prisma.withdrawal.findMany({
    where: { specialistId },
    orderBy: { createdAt: 'desc' },
    include: { project: { select: { title: true } } },
  })

  const profile = toProfile(row)
  const metrics = deliveryMetrics(profile.delivery)

  return (
    <section style={{ paddingTop: 'clamp(40px, 7vw, 72px)' }}>
      <div className="shell" style={{ maxWidth: 760 }}>
        <Link href="/ops/pool" className="label">
          ← пул
        </Link>

        <div className="row" style={{ justifyContent: 'space-between', marginTop: 20 }}>
          <h1>{profile.displayName}</h1>
          <span className="tag">{SPECIALIST_STATUS_LABELS[row.status] ?? row.status}</span>
        </div>

        <p className="dim" style={{ marginTop: 8, fontSize: '0.85rem' }}>
          {row.email} · ключ {row.accessKey} ·{' '}
          {row.source === 'import' ? 'заведён импортом базы' : 'подал заявку сам'}
        </p>

        <div className="grid grid-3" style={{ marginTop: 32 }}>
          <Stat
            value={profile.portfolioRating.toFixed(1)}
            label="портфолио"
            note={`порог ${PORTFOLIO_THRESHOLD}/10`}
          />
          <Stat
            value={String(profile.weeklyCapacityHours)}
            label="ч/нед свободно"
            note={AVAILABILITY_LABELS[row.availabilityStatus] ?? row.availabilityStatus}
          />
          <Stat
            value={metrics ? String(metrics.delivered) : '0'}
            label="тикетов сдано"
            note={metrics ? `${Math.round(metrics.slaCompliance * 100)}% в срок` : 'истории нет'}
          />
        </div>

        {withdrawals.length > 0 && (
          <div className="panel" style={{ marginTop: 32 }}>
            <div className="label">Выходил из проектов · {withdrawals.length}</div>
            <p className="hint" style={{ marginTop: 8, marginBottom: 14 }}>
              В отбор это не входит и баллом не становится: штраф за честный отказ учит
              молчать, а молчание вскрывается позже и дороже. Смотреть сюда стоит по другой
              причине — расхождение между заявленной ёмкостью и настоящей.
            </p>
            <div className="stack" style={{ gap: 10 }}>
              {withdrawals.map((w) => (
                <div key={w.id} className="dim" style={{ fontSize: '0.85rem' }}>
                  <strong style={{ color: 'var(--text)' }}>{w.project.title}</strong> ·{' '}
                  {w.createdAt.toLocaleDateString('ru-RU')} · {w.reason}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="panel" style={{ marginTop: 32 }}>
          <div className="label label-accent">Доступ к проектам</div>
          <p className="muted" style={{ marginTop: 12, marginBottom: 16 }}>
            Подписка — гейт, а не балл: без неё человека нет в выборке вовсе, и проверяется
            она раньше портфолио. Отказ по деньгам не должен выглядеть отказом по
            квалификации (п.14а). Сейчас:{' '}
            <strong style={{ color: 'var(--text)' }}>
              {SUBSCRIPTION_LABELS[profile.subscription]}
            </strong>
            .
          </p>

          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
            {SUBSCRIPTIONS.filter((value) => value !== profile.subscription).map((value) => (
              <OpsAction
                key={value}
                action={setSubscription}
                hidden={{ specialistId: row.id, subscription: value }}
                label={`Перевести в «${SUBSCRIPTION_LABELS[value]}»`}
              />
            ))}
          </div>
        </div>

        <div className="divider" style={{ marginTop: 44 }} />

        <h2>Правка профиля</h2>

        <p className="muted" style={{ marginTop: 14, maxWidth: '62ch' }}>
          В кабинете специалиста написано, что поля отбора меняются через бюро. Вот это место.
          Правится то, что является фактами о человеке: дисциплина, специализация, юрисдикции,
          пакет, стадии, языки, часовой пояс.
        </p>

        <div className="panel" style={{ marginTop: 24, marginBottom: 36 }}>
          <div className="label label-accent">Чего здесь нет и почему</div>
          <ul className="muted" style={{ marginTop: 14, marginBottom: 0, paddingLeft: 18 }}>
            <li style={{ marginBottom: 8 }}>
              <strong>Рейтинг портфолио.</strong> Ставится разбором заявки и меняется там же,
              отдельным действием — чтобы правка фактов не превращалась незаметно в правку
              балла.
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong>Свободная ёмкость и статус занятости.</strong> Своим временем
              распоряжается специалист. Это единственное, чем он управляет напрямую, и
              отбирать это у него — значит считать по цифре, за которую никто не отвечает.
            </li>
            <li>
              <strong>Метрики поставки.</strong> Считаются из событий тикетов. Поля для их
              правки нет ни у кого, включая бюро (п.12).
            </li>
          </ul>
        </div>

        <SpecialistForm
          action={editSpecialist}
          submitLabel="Сохранить профиль"
          showCapacity={false}
          hidden={{ specialistId: row.id }}
          defaults={{
            portfolioUrl: row.portfolioUrl,
            disciplines: profile.disciplines,
            specializations: profile.specializations,
            typologies: profile.typologies,
            scaleBands: profile.scaleBands,
            materialSystems: profile.materialSystems,
            climateZones: profile.climateZones,
            jurisdictions: profile.jurisdictions,
            signsIn: profile.signsIn,
            software: profile.software,
            languages: profile.languages,
            docStages: profile.docStages,
            regulatoryTracks: profile.regulatoryTracks,
            ifcLevel: profile.ifcLevel,
            workMode: profile.workMode,
            maxStoreys: String(row.maxStoreys),
            utcOffset: String(row.utcOffset),
            leadTimeDays: String(row.leadTimeDays),
            weeklyCapacityHours: String(row.weeklyCapacityHours),
          }}
          done={
            <div className="panel panel-accent">
              <div className="label label-accent">Профиль сохранён</div>
              <p className="muted" style={{ marginTop: 12, marginBottom: 16 }}>
                Изменения войдут в следующий прогон отбора. Уже собранные команды они не
                пересобирают: состав фиксируется прогоном, а не читается заново.
              </p>
              <Link href="/ops/pool">К пулу →</Link>
            </div>
          }
        />
      </div>
    </section>
  )
}

function Stat({ value, label, note }: { value: string; label: string; note: string }) {
  return (
    <div style={{ borderTop: '1px solid var(--border-strong)', paddingTop: 14 }}>
      <div className="num" style={{ fontSize: '2rem' }}>
        {value}
      </div>
      <div className="label">{label}</div>
      <div className="dim" style={{ fontSize: '0.82rem', marginTop: 6 }}>
        {note}
      </div>
    </div>
  )
}
