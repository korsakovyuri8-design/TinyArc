/**
 * Корпус норм: чтение, пополнение, сверка.
 *
 * Правила до сих пор попадали в базу только сидом. Это половина функции, и
 * хуже её отсутствия: продукт проверяет посадку по корпусу и сам же не даёт
 * этот корпус завести — ровно тот дефект, что был с величинами участка.
 *
 * Правка значения здесь отсутствует намеренно. Норма не «исправляется» —
 * она меняется, и у изменения есть дата вступления в силу. Комплект, выпущенный
 * вчера, считался по вчерашнему правилу, и переписать его значение задним
 * числом значит потерять ответ на вопрос, по чему мы считали. Новая редакция
 * заводится новой записью с её собственным `effectiveFrom`; выбор между ними
 * делает движок, а не оператор.
 *
 * Сверка — отдельное действие, и это не то же самое, что заведение. Запись
 * стареет: `checkedAt` решает, доверяем ли мы ей, и год спустя правило
 * помечается несверенным, продолжая быть в базе.
 */

import { isStale, type RuleLayer, type RuleSubject } from '@/engine/compliance'
import type { Jurisdiction } from '@/engine/taxonomy'
import { prisma } from '../db'
import { parseRules, type RuleDraft } from '../norms/parse'

export class NormRefused extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NormRefused'
  }
}

export type RuleRow = {
  id: string
  layer: RuleLayer
  jurisdiction: Jurisdiction
  municipality: string
  zone: string
  subject: RuleSubject
  operator: 'max' | 'min'
  value: number
  document: string
  article: string
  effectiveFrom: Date
  checkedAt: Date
  url: string
  stale: boolean
}

/**
 * Потолок показа. Корпус по замыслу растёт до тысяч строк — по муниципалитету
 * на каждое зонирующее правило, — и страница без предела однажды перестаёт
 * открываться ровно тогда, когда корпус наконец стал полезным.
 */
export const RULES_SHOWN = 300

export type RuleFilter = {
  jurisdiction?: string
  municipality?: string
  layer?: string
  /** Только несверённые: с них начинают, когда садятся обновлять корпус. */
  staleOnly?: boolean
}

export async function listRules(
  filter: RuleFilter,
  now: Date,
): Promise<{ rows: RuleRow[]; total: number; stale: number }> {
  const where = {
    ...(filter.jurisdiction ? { jurisdiction: filter.jurisdiction } : {}),
    ...(filter.municipality ? { municipality: filter.municipality } : {}),
    ...(filter.layer ? { layer: filter.layer } : {}),
  }

  const staleBefore = new Date(now.getTime() - 365 * 86_400_000)

  const [rows, total, stale] = await Promise.all([
    prisma.complianceRule.findMany({
      where: { ...where, ...(filter.staleOnly ? { checkedAt: { lt: staleBefore } } : {}) },
      orderBy: [
        { jurisdiction: 'asc' },
        { municipality: 'asc' },
        { layer: 'asc' },
        { subject: 'asc' },
      ],
      take: RULES_SHOWN,
    }),
    prisma.complianceRule.count({ where }),
    prisma.complianceRule.count({ where: { ...where, checkedAt: { lt: staleBefore } } }),
  ])

  return {
    total,
    stale,
    rows: rows.map((row) => ({
      id: row.id,
      layer: row.layer as RuleLayer,
      jurisdiction: row.jurisdiction as Jurisdiction,
      municipality: row.municipality ?? '',
      zone: row.zone ?? '',
      subject: row.subject as RuleSubject,
      operator: row.operator as 'max' | 'min',
      value: row.value,
      document: row.document,
      article: row.article,
      effectiveFrom: row.effectiveFrom,
      checkedAt: row.checkedAt,
      url: row.url,
      stale: isStale(
        {
          document: row.document,
          article: row.article,
          effectiveFrom: row.effectiveFrom.toISOString(),
          checkedAt: row.checkedAt.toISOString(),
        },
        now,
      ),
    })),
  }
}

/** Муниципалитеты, по которым уже что-то есть. Для сужения списка. */
export async function municipalitiesWithRules(): Promise<string[]> {
  const rows = await prisma.complianceRule.findMany({
    where: { municipality: { not: null } },
    select: { municipality: true },
    distinct: ['municipality'],
    orderBy: { municipality: 'asc' },
  })

  return rows.map((r) => r.municipality!).filter(Boolean)
}

async function create(draft: RuleDraft): Promise<void> {
  await prisma.complianceRule.create({
    data: {
      layer: draft.layer,
      jurisdiction: draft.jurisdiction,
      municipality: draft.municipality || null,
      zone: draft.zone || null,
      subject: draft.subject,
      operator: draft.operator,
      value: draft.value,
      document: draft.document,
      article: draft.article,
      effectiveFrom: draft.effectiveFrom,
      checkedAt: draft.checkedAt,
      url: draft.url,
    },
  })
}

export async function addRule(draft: RuleDraft): Promise<void> {
  await create(draft)
}

export type ImportResult = {
  created: number
  /** Строки, которые разбор не взял, вместе с причиной. */
  rejected: { line: number; reason: string }[]
  /** Сколько строк были бы заведены при прогоне. Для предпросмотра. */
  ready: number
}

/**
 * Пополнение корпуса таблицей.
 *
 * Предпросмотром и прогоном, как импорт базы специалистов: набор из сотни
 * строк, отвергнутый целиком из-за одной, — это потерянный вечер, а прогон
 * без предпросмотра означает, что ошибку видно уже в базе.
 *
 * Дубли не гасятся. Две записи одной нормы — это либо две редакции с разными
 * датами, и тогда обе нужны, либо ошибка оператора, которую он видит в списке
 * и убирает сам. Молчаливое «уже есть» скрыло бы вторую редакцию, а она и есть
 * самое ценное в корпусе.
 */
export async function importRules(text: string, dryRun: boolean): Promise<ImportResult> {
  const { drafts, rejected } = parseRules(text)

  if (dryRun) return { created: 0, rejected, ready: drafts.length }

  let created = 0
  for (const draft of drafts) {
    await create(draft)
    created += 1
  }

  return { created, rejected, ready: drafts.length }
}

/**
 * Отметка о сверке с первоисточником.
 *
 * Двигает только `checkedAt` — значение не трогает. Если норма изменилась,
 * это не сверка, а новая редакция, и заводится она новой записью.
 */
export async function markChecked(ruleId: string, at: Date): Promise<void> {
  const rule = await prisma.complianceRule.findUnique({ where: { id: ruleId } })
  if (!rule) throw new NormRefused('There is no such rule.')

  await prisma.complianceRule.update({ where: { id: ruleId }, data: { checkedAt: at } })
}

/**
 * Удаление правила.
 *
 * Нужно ровно для одного: убрать запись, которой не должно было быть. Норма,
 * переставшая действовать, удалением не оформляется — у неё есть преемница с
 * более поздней датой вступления, и движок выберет её сам.
 */
export async function deleteRule(ruleId: string): Promise<void> {
  await prisma.complianceRule.delete({ where: { id: ruleId } })
}
