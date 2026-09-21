import { DISCIPLINES, JURISDICTIONS, type Jurisdiction } from '@/engine/taxonomy'
import type { SigningPartner } from '@/engine/types'
import { prisma } from '../db'
import { parseList } from '../rows'

/**
 * Местные фирмы с правом подписи: чтение для движка.
 *
 * Отдельно от пула специалистов. Фирма не проходит гейты и не занимает слот,
 * она закрывает подпись раздела в своей стране, и движку нужно знать только
 * это: страну и разделы.
 */

/** Действующие фирмы страны проекта, в виде, который понимает движок. */
export async function partnersIn(jurisdiction: string): Promise<SigningPartner[]> {
  if (!(JURISDICTIONS as readonly string[]).includes(jurisdiction)) return []

  const rows = await prisma.signingPartner.findMany({
    where: { jurisdiction, active: true },
    orderBy: { createdAt: 'asc' },
  })

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    jurisdiction: r.jurisdiction as Jurisdiction,
    disciplines: parseList(r.disciplinesJson, DISCIPLINES),
  }))
}

/** Все фирмы, для карты готовности стран. */
export async function allPartners(): Promise<SigningPartner[]> {
  const rows = await prisma.signingPartner.findMany({ where: { active: true } })

  return rows
    .filter((r) => (JURISDICTIONS as readonly string[]).includes(r.jurisdiction))
    .map((r) => ({
      id: r.id,
      name: r.name,
      jurisdiction: r.jurisdiction as Jurisdiction,
      disciplines: parseList(r.disciplinesJson, DISCIPLINES),
    }))
}
