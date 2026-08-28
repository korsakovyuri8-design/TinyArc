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
 *
 * Заведение и рассылка разделены намеренно. Запись — это одна вставка на всю
 * пачку; письмо — сетевой вызов на человека. Держать их в одном действии
 * значит поставить создание двухсот записей в зависимость от того, ответит ли
 * почтовый провайдер двести раз подряд быстрее, чем истечёт время запроса.
 */

import { accessKey } from '@/lib/forms'
import { toList } from '@/lib/rows'
import { sendInvitation } from '@/lib/mail'
import { prisma } from '../db'
import type { IntakeDraft } from '../intake/map'

/**
 * Потолок на один импорт.
 *
 * База в тысячу строк — это не один импорт, это работа на несколько заходов, и
 * честнее сказать это до вставки, чем упереться в таймаут посередине. Порог
 * выбран так, чтобы вставка гарантированно уложилась в один запрос.
 */
export const MAX_IMPORT_ROWS = 300

/**
 * Сколько писем уходит за один заход рассылки.
 *
 * Провайдеры ограничивают частоту, а серверное действие ограничено временем.
 * Незаконченная рассылка не теряется: неотправленные остаются с пустым
 * invitedAt, и следующий заход берёт их же.
 */
export const INVITES_PER_RUN = 50

/** Сколько писем уходит одновременно. Больше — упираемся в лимит провайдера. */
const MAIL_CONCURRENCY = 5

export type ImportOutcome = {
  /** Заведено новых записей. */
  created: number
  /** Столько уже были в базе: импорт их не трогает. */
  existing: number
  /** Строк сверх потолка: их надо импортировать следующим заходом. */
  skipped: number
}

/**
 * Завести черновики.
 *
 * Повторный импорт того же файла безопасен: запись с известным адресом
 * пропускается целиком. Обновлять профиль импортом нельзя намеренно — человек
 * мог уже дозаполнить его сам, и файл из таблицы затёр бы живые данные
 * прошлогодними.
 *
 * Письма отсюда не уходят: рассылка — отдельное действие (inviteWaiting).
 */
export async function importDrafts(drafts: IntakeDraft[]): Promise<ImportOutcome> {
  const batch = drafts.slice(0, MAX_IMPORT_ROWS)
  const skipped = drafts.length - batch.length

  const known = new Set(
    (
      await prisma.specialist.findMany({
        where: { email: { in: batch.map((d) => d.email) } },
        select: { email: true },
      })
    ).map((s) => s.email),
  )

  const fresh = batch.filter((d) => !known.has(d.email))

  if (fresh.length > 0) {
    await prisma.specialist.createMany({
      data: fresh.map((draft) => ({
        displayName: draft.displayName,
        email: draft.email,
        accessKey: accessKey('pool'),
        status: 'invited',
        source: 'import',
        // Пусто до рассылки: по этому полю рассылка и находит, кого ещё не звали.
        invitedAt: null,
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
        // Ёмкость нулевая, пока человек не назовёт её сам. Это же и гейт: пока
        // он молчит, в выборку он не попадает даже случайно.
        weeklyCapacityHours: 0,
      })),
    })
  }

  return { created: fresh.length, existing: batch.length - fresh.length, skipped }
}

export type InviteOutcome = {
  sent: number
  /** Кому письмо не ушло: ключ рабочий, передать надо руками. */
  unsent: { email: string; accessKey: string }[]
  /** Сколько ещё ждут своей очереди. */
  waiting: number
}

/**
 * Позвать тех, кого завели, но ещё не звали.
 *
 * Отметка о приглашении ставится только после успешной отправки: иначе человек,
 * до которого письмо не дошло, молча выпал бы из рассылки навсегда.
 */
export async function inviteWaiting(limit = INVITES_PER_RUN): Promise<InviteOutcome> {
  const queue = await prisma.specialist.findMany({
    where: { status: 'invited', invitedAt: null },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: { id: true, email: true, displayName: true, accessKey: true },
  })

  const unsent: InviteOutcome['unsent'] = []
  let sent = 0

  for (let i = 0; i < queue.length; i += MAIL_CONCURRENCY) {
    const slice = queue.slice(i, i + MAIL_CONCURRENCY)

    await Promise.all(
      slice.map(async (person) => {
        try {
          await sendInvitation(person.email, person.displayName, person.accessKey)
          await prisma.specialist.update({
            where: { id: person.id },
            data: { invitedAt: new Date() },
          })
          sent += 1
        } catch (error) {
          console.error(`Приглашение не ушло (${person.email}):`, error)
          unsent.push({ email: person.email, accessKey: person.accessKey })
        }
      }),
    )
  }

  const waiting = await prisma.specialist.count({
    where: { status: 'invited', invitedAt: null },
  })

  return { sent, unsent, waiting }
}

/** Повторный зов тому, кто не откликнулся. Ключ остаётся прежним. */
export async function reinvite(specialistId: string): Promise<{ sent: boolean; key: string }> {
  const specialist = await prisma.specialist.findUniqueOrThrow({ where: { id: specialistId } })

  try {
    await sendInvitation(specialist.email, specialist.displayName, specialist.accessKey)
    await prisma.specialist.update({
      where: { id: specialistId },
      data: { invitedAt: new Date() },
    })
    return { sent: true, key: specialist.accessKey }
  } catch (error) {
    console.error('Повторное приглашение не ушло:', error)
    return { sent: false, key: specialist.accessKey }
  }
}
