/**
 * Проверка проекта на нормы: правила из базы, арифметика — движком.
 *
 * Служба знает про базу и ничего не решает сама: что с чем сравнивать и как
 * называется исход — в `src/engine/compliance.ts`. Здесь только выборка по
 * области и перевод результата в то, что показывают человеку.
 */

import { check, type Finding, type Rule, type RuleLayer, type RuleOperator, type RuleSubject } from '@/engine/compliance'
import { blocking, missingInputs } from '@/engine/compliance'
import type { Jurisdiction } from '@/engine/taxonomy'
import { prisma } from '../db'
import { siteFacts, type SiteInput } from '../site-facts'

/** Поля проекта, которых достаточно для проверки. Выбираются одним запросом. */
export const SITE_SELECT = {
  jurisdiction: true,
  municipality: true,
  zone: true,
  storeys: true,
  areaSqm: true,
  plotAreaSqm: true,
  footprintSqm: true,
  heightM: true,
  setbackFrontM: true,
  setbackSideM: true,
  setbackRearM: true,
  units: true,
  parkingSpaces: true,
  greenSqm: true,
} as const

type RuleRow = {
  id: string
  layer: string
  jurisdiction: string
  municipality: string | null
  zone: string | null
  subject: string
  operator: string
  value: number
  document: string
  article: string
  effectiveFrom: Date
  checkedAt: Date
  url: string
}

function toRule(row: RuleRow): Rule {
  return {
    id: row.id,
    layer: row.layer as RuleLayer,
    scope: {
      jurisdiction: row.jurisdiction as Jurisdiction,
      municipality: row.municipality ?? undefined,
      zone: row.zone ?? undefined,
    },
    subject: row.subject as RuleSubject,
    operator: row.operator as RuleOperator,
    value: row.value,
    source: {
      document: row.document,
      article: row.article,
      effectiveFrom: row.effectiveFrom.toISOString(),
      checkedAt: row.checkedAt.toISOString(),
      url: row.url || undefined,
    },
  }
}

/**
 * Правила, которые вообще могут подействовать на участке.
 *
 * Сужается запросом, а не в памяти: страна обязательна, а строки чужих
 * муниципалитетов и зон читать незачем — их будут десятки тысяч, когда
 * заполнится Европа. Какое из отобранных сильнее, решает движок.
 */
export async function rulesForSite(site: {
  jurisdiction: string
  municipality?: string | null
  zone?: string | null
}): Promise<Rule[]> {
  const rows = await prisma.complianceRule.findMany({
    where: {
      jurisdiction: site.jurisdiction,
      // Страновое правило действует всюду, поэтому пустой муниципалитет
      // остаётся в выборке наравне со «своим».
      OR: [{ municipality: null }, { municipality: site.municipality ?? undefined }],
      AND: [{ OR: [{ zone: null }, { zone: site.zone ?? undefined }] }],
    },
  })

  return rows.map(toRule)
}

export type ProjectCompliance = {
  findings: Finding[]
  /** Что останавливает подачу: только сверенные, только не прошедшие. */
  blocking: Finding[]
  /** Чего не хватает, чтобы проверить. Именами полей проекта. */
  missing: string[]
  /** Есть ли вообще правила на этот участок. Ноль — это не «всё в порядке». */
  covered: boolean
}

/** Проверяет проект против правил его участка. */
export async function checkProject(projectId: string, now = new Date()): Promise<ProjectCompliance> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: SITE_SELECT,
  })

  if (!project) return { findings: [], blocking: [], missing: [], covered: false }

  return checkSite(project, now)
}

/** То же для уже прочитанного проекта: страница читает его один раз. */
export async function checkSite(project: SiteInput, now = new Date()): Promise<ProjectCompliance> {
  const rules = await rulesForSite(project)
  const findings = check(rules, siteFacts(project), now)

  return {
    findings,
    blocking: blocking(findings),
    missing: missingInputs(findings),
    /*
     * Отсутствие правил и соответствие правилам — разные вещи, и путать их
     * нельзя. Пустая база на новом муниципалитете означает «мы ещё не знаем»,
     * а показанное как «всё сошлось» отправит комплект в орган с нашей
     * подписью под непроверенным.
     */
    covered: rules.length > 0,
  }
}
