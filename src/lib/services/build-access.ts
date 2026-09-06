/**
 * Доступ к подрядчикам: продажа и гейт (концепт, п.14б).
 *
 * Отдельная платная услуга поверх комплекта и продолжение работы над тем же
 * проектом: к моменту выдачи бюро знает о стройке больше, чем кто-либо, и
 * отбор подрядчика считается тем же движком и по тем же правилам, что состав
 * команды.
 *
 * Три вещи, которые здесь важны и легко потерять.
 *
 * **Заказчик платит за доступ к отбору, подрядчик — не за место в нём.** Это
 * условие существования продукта, а не осторожность: проданная выдача убила бы
 * доверие и к подбору специалистов по соседству. У профиля подрядчика поэтому
 * нет поля оплаченной позиции, а здесь платит только одна сторона.
 *
 * **Ответственность за стройку бюро не берёт.** Мы отвечаем за комплект и за
 * то, что отбор посчитан честно; договор на работы заказчик заключает сам.
 * Это сказано в самом продукте, а не только в оферте: услуга, у которой
 * границу называют только юристы, продана неверно.
 *
 * **Гейт — на показ списка, а не на работу.** Неоплаченный доступ ничего не
 * останавливает: комплект выдаётся, стадии идут своим ходом. Иначе это был бы
 * четвёртый гейт, которого концепт не предусматривает.
 */

import { priceBuildAccess, type BuildAccessBasis } from '@/engine/pricing'
import { tradesFor, type BuildShape } from '@/engine/trades'
import type { Jurisdiction, Typology } from '@/engine/taxonomy'
import { prisma } from '../db'
import { bounded, TEXT_MAX } from '../text'

export class AccessRefused extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AccessRefused'
  }
}

export type AccessView = {
  id: string
  projectId: string
  projectTitle: string
  amount: number
  currency: string
  status: string
  basis: BuildAccessBasis | null
  issuedAt: Date
  paidAt: Date | null
}

/** Проект в том виде, в каком считается цена доступа. */
export type AccessProject = {
  id: string
  typology: string
  storeys: number
  areaSqm: number
  materialSystem: string
  terrain: string
  gridConnection: string
  jurisdiction: string
}

function readBasis(raw: string): BuildAccessBasis | null {
  try {
    const parsed = JSON.parse(raw || '{}')
    return typeof parsed?.amount === 'number' ? (parsed as BuildAccessBasis) : null
  } catch {
    return null
  }
}

/** Сколько работ несёт эта стройка. Из них и складывается цена. */
export function tradeCount(project: AccessProject): number {
  const shape: BuildShape = {
    typology: project.typology as Typology,
    storeys: project.storeys,
    areaSqm: project.areaSqm,
    materialSystem: project.materialSystem as BuildShape['materialSystem'],
    terrain: project.terrain as BuildShape['terrain'],
    gridConnection: project.gridConnection as BuildShape['gridConnection'],
  }

  return tradesFor(shape).length
}

/** Цена доступа для этого проекта, с разбором. Ничего не записывает. */
export function quote(project: AccessProject): BuildAccessBasis {
  return priceBuildAccess(project.jurisdiction as Jurisdiction, tradeCount(project))
}

export async function accessFor(projectId: string): Promise<AccessView | null> {
  const row = await prisma.buildAccess.findUnique({
    where: { projectId },
    include: { project: { select: { title: true } } },
  })

  if (!row) return null

  return {
    id: row.id,
    projectId: row.projectId,
    projectTitle: row.project.title,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    basis: readBasis(row.basisJson),
    issuedAt: row.issuedAt,
    paidAt: row.paidAt,
  }
}

/** Открыт ли заказчику короткий список. Единственный вопрос, который задаёт кабинет. */
export async function accessOpen(projectId: string): Promise<boolean> {
  const row = await prisma.buildAccess.findUnique({
    where: { projectId },
    select: { status: true },
  })

  return row?.status === 'paid'
}

/**
 * Заказчик просит доступ — бюро выставляет счёт.
 *
 * Цена считается и записывается здесь же, вместе с разбором: пересчёт при
 * показе задним числом менял бы уже названную сумму, ровно как у стадий.
 *
 * Повторная просьба ничего не выставляет второй раз: счёт на проект один, и
 * уникальность в схеме гасит гонку двух нажатий.
 */
export async function requestAccess(project: AccessProject): Promise<AccessView> {
  const existing = await accessFor(project.id)
  if (existing) return existing

  const basis = quote(project)

  try {
    await prisma.buildAccess.create({
      data: {
        projectId: project.id,
        amount: basis.amount,
        currency: basis.currency,
        basisJson: JSON.stringify(basis),
      },
    })
  } catch {
    // Единственная причина — уникальность: счёт уже выставил другой запрос.
  }

  const view = await accessFor(project.id)
  if (!view) throw new AccessRefused('The charge could not be issued.')

  return view
}

/**
 * Отметка об оплате.
 *
 * Условие внутри записи, как у счёта за стадию: повтор обязан пройти молча, но
 * не переписать дату поступления — дата это факт, а не последнее нажатие.
 */
export async function markAccessPaid(projectId: string, note: string): Promise<void> {
  const row = await prisma.buildAccess.findUnique({ where: { projectId } })
  if (!row) throw new AccessRefused('Nothing has been charged for this project.')
  if (row.status === 'void') {
    throw new AccessRefused('The charge is void. It does not become paid — issue a new one.')
  }

  await prisma.buildAccess.updateMany({
    where: { projectId, status: 'issued' },
    data: { status: 'paid', paidAt: new Date(), paidNote: bounded(note, TEXT_MAX.line) },
  })
}

/**
 * Сколько выставленных доступов показывается в панели.
 *
 * Неоплаченные показываются все и потолка не имеют: заказчик попросил и ждёт,
 * а срезанная строка — это просьба, на которую никто не ответит.
 */
export const ACCESS_PAID_SHOWN = 20

export async function accessQueue(): Promise<AccessView[]> {
  const [open, paid] = await Promise.all([
    prisma.buildAccess.findMany({
      where: { status: 'issued' },
      orderBy: { issuedAt: 'asc' },
      include: { project: { select: { title: true } } },
    }),
    prisma.buildAccess.findMany({
      where: { status: 'paid' },
      orderBy: { paidAt: 'desc' },
      take: ACCESS_PAID_SHOWN,
      include: { project: { select: { title: true } } },
    }),
  ])

  return [...open, ...paid].map((row) => ({
    id: row.id,
    projectId: row.projectId,
    projectTitle: row.project.title,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    basis: readBasis(row.basisJson),
    issuedAt: row.issuedAt,
    paidAt: row.paidAt,
  }))
}
