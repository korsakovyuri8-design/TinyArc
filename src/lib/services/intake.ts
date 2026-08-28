/**
 * Приём базы специалистов.
 *
 * Импорт не пускает никого в выборку. Он делает ровно одно: заводит запись,
 * выдаёт ключ и открывает человеку дверь, чтобы тот дозаполнил профиль сам.
 * Порог портфолио при этом нетронут — рейтинг у импортированного нулевой, а
 * значит первый же гейт его не пропускает (п.9).
 *
 * Это не осторожность ради осторожности. База бюро — это имена и контакты; в
 * ней нет ни юрисдикций, ни пакета, ни часового пояса, ни свободной ёмкости.
 * Отбор, запущенный по такой записи, дал бы команду, собранную из умолчаний.
 */

import { accessKey } from '@/lib/forms'
import { toList } from '@/lib/rows'
import { sendInvitation } from '@/lib/mail'
import { prisma } from '../db'
import type { IntakeDraft } from '../intake/map'

export type ImportOutcome = {
  /** Заведено новых записей. */
  created: number
  /** Столько уже были в базе: импорт их не трогает. */
  existing: number
  /** Приглашения, которые не ушли. Ключ при этом создан и работает. */
  unsent: { email: string; accessKey: string }[]
}

/**
 * Завести черновики и позвать людей.
 *
 * Повторный импорт того же файла безопасен: запись с известным адресом
 * пропускается целиком. Обновлять профиль импортом нельзя намеренно — человек
 * мог уже дозаполнить его сам, и файл из таблицы затёр бы живые данные
 * прошлогодними.
 */
export async function importDrafts(
  drafts: IntakeDraft[],
  { invite = true }: { invite?: boolean } = {},
): Promise<ImportOutcome> {
  const emails = drafts.map((d) => d.email)

  const known = new Set(
    (
      await prisma.specialist.findMany({
        where: { email: { in: emails } },
        select: { email: true },
      })
    ).map((s) => s.email),
  )

  const fresh = drafts.filter((d) => !known.has(d.email))
  const unsent: ImportOutcome['unsent'] = []

  for (const draft of fresh) {
    const specialist = await prisma.specialist.create({
      data: {
        displayName: draft.displayName,
        email: draft.email,
        accessKey: accessKey('pool'),
        status: 'invited',
        source: 'import',
        invitedAt: invite ? new Date() : null,
        portfolioUrl: draft.portfolioUrl,
        disciplinesJson: toList(draft.disciplines),
        specializationsJson: toList(draft.specializations),
        jurisdictionsJson: toList(draft.jurisdictions),
        softwareJson: toList(draft.software),
        languagesJson: toList(draft.languages),
        typologiesJson: toList(draft.typologies),
        materialSystemsJson: toList(draft.materialSystems),
        climateZonesJson: toList(draft.climateZones),
        docStagesJson: toList(draft.docStages),
        ...(draft.maxStoreys === null ? {} : { maxStoreys: draft.maxStoreys }),
        ...(draft.utcOffset === null ? {} : { utcOffset: draft.utcOffset }),
        // Ёмкость нулевая до тех пор, пока человек не назовёт её сам. Это же
        // гейт: пока он молчит, в выборку он не попадает даже случайно.
        weeklyCapacityHours: 0,
      },
    })

    if (!invite) continue

    try {
      await sendInvitation(specialist.email, specialist.displayName, specialist.accessKey)
    } catch (error) {
      // Письмо — доставка, а не запись. Не ушло — ключ остаётся рабочим, и
      // бюро передаёт его тем каналом, которым и так общается с человеком.
      console.error('Приглашение не ушло:', error)
      unsent.push({ email: specialist.email, accessKey: specialist.accessKey })
    }
  }

  return { created: fresh.length, existing: drafts.length - fresh.length, unsent }
}

/** Повторный зов тем, кто не откликнулся. Ключ остаётся прежним. */
export async function reinvite(specialistId: string): Promise<{ sent: boolean; key: string }> {
  const specialist = await prisma.specialist.findUniqueOrThrow({ where: { id: specialistId } })

  await prisma.specialist.update({
    where: { id: specialistId },
    data: { invitedAt: new Date() },
  })

  try {
    await sendInvitation(specialist.email, specialist.displayName, specialist.accessKey)
    return { sent: true, key: specialist.accessKey }
  } catch (error) {
    console.error('Повторное приглашение не ушло:', error)
    return { sent: false, key: specialist.accessKey }
  }
}
