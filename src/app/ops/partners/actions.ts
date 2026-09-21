'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { DISCIPLINES, JURISDICTIONS, SIGNED_DISCIPLINES } from '@/engine/taxonomy'
import { prisma } from '@/lib/db'
import { isOperator } from '@/lib/session'

/**
 * Фирмы с правом подписи: запись из панели.
 *
 * Без клиентского кода: обычная форма и серверное действие. Панель открывает
 * один человек, и ради редкой ошибки ввода не стоит тащить сюда состояние
 * формы; ошибка возвращается в адресе и показывается над формой.
 */

async function requireOperator(): Promise<void> {
  if (!(await isOperator())) throw new Error('The bureau panel is closed.')
}

function back(error?: string): never {
  redirect(error ? `/ops/partners?error=${encodeURIComponent(error)}` : '/ops/partners')
}

export async function addPartner(formData: FormData): Promise<void> {
  await requireOperator()

  const name = String(formData.get('name') ?? '').trim()
  const jurisdiction = String(formData.get('jurisdiction') ?? '')
  const disciplines = formData
    .getAll('disciplines')
    .map(String)
    .filter((d) => (DISCIPLINES as readonly string[]).includes(d))

  if (!name) back('Name the firm.')
  if (!(JURISDICTIONS as readonly string[]).includes(jurisdiction)) back('Choose the country where the firm signs.')

  // Фирма, которая не подписывает ни одного раздела с подписью, движку
  // бесполезна, а в списке выглядела бы как закрытая подпись.
  if (!disciplines.some((d) => (SIGNED_DISCIPLINES as readonly string[]).includes(d))) {
    back('Mark at least one section the firm can sign: architecture, structural or MEP.')
  }

  await prisma.signingPartner.create({
    data: {
      name,
      jurisdiction,
      disciplinesJson: JSON.stringify(disciplines),
      registration: String(formData.get('registration') ?? '').trim(),
      contactName: String(formData.get('contactName') ?? '').trim(),
      email: String(formData.get('email') ?? '').trim().toLowerCase(),
      phone: String(formData.get('phone') ?? '').trim(),
      terms: String(formData.get('terms') ?? '').trim(),
      notes: String(formData.get('notes') ?? '').trim(),
    },
  })

  revalidatePath('/ops/partners')
  revalidatePath('/ops/pool')
  back()
}

export async function togglePartner(formData: FormData): Promise<void> {
  await requireOperator()

  const id = String(formData.get('id') ?? '')
  const row = await prisma.signingPartner.findUnique({ where: { id } })
  if (!row) back('No such firm.')

  await prisma.signingPartner.update({ where: { id }, data: { active: !row.active } })

  revalidatePath('/ops/partners')
  revalidatePath('/ops/pool')
  back()
}
