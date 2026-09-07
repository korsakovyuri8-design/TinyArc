/**
 * Настройки бюро: числа, задающие политику.
 *
 * Каждый ключ объявлен здесь с причиной своего существования. Ключ без
 * объявления — это место, куда дописывают то, что не продумали, и через
 * полгода никто не помнит, что оно значит и кто его поставил.
 *
 * Пустое значение — рабочее состояние, а не недоделка. Политика, которую
 * бюро ещё не назвало, не должна подставляться числом по умолчанию: цифра,
 * взявшаяся сама, ведёт себя как решение, которого никто не принимал.
 */

import { prisma } from '../db'

/**
 * Какая доля цены стадии уходит команде.
 *
 * Из неё считается потолок на гонорары: цена комплекта × доля. Пока не
 * задана, бюджетного гейта не существует вовсе — состав собирается как
 * собирался, и об этом сказано в панели. Это честнее умолчания: доля,
 * взявшаяся из воздуха, начала бы отсеивать людей по цене, которую бюро не
 * называло.
 */
export const TEAM_SHARE = 'team_budget_share'

export class SettingRefused extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SettingRefused'
  }
}

/** Доля, идущая команде, 0…1. `null` — не задана. */
export async function teamShare(): Promise<number | null> {
  const row = await prisma.setting.findUnique({ where: { key: TEAM_SHARE } })
  if (!row) return null

  const value = Number(row.value)
  return Number.isFinite(value) && value > 0 && value <= 1 ? value : null
}

export async function setTeamShare(value: number): Promise<void> {
  /*
   * Ноль и единица отвергаются с разных сторон. Ноль означал бы, что команде
   * не достаётся ничего, — то есть ни один состав не собирается, и продукт
   * встал бы молча. Больше единицы означало бы, что бюро платит больше, чем
   * получает, и это не политика, а опечатка.
   */
  if (!Number.isFinite(value) || value <= 0 || value > 1) {
    throw new SettingRefused('The share is a number above zero and no more than one.')
  }

  await prisma.setting.upsert({
    where: { key: TEAM_SHARE },
    create: { key: TEAM_SHARE, value: String(value) },
    update: { value: String(value) },
  })
}

/** Снять долю: бюджетный гейт выключается, состав собирается как раньше. */
export async function clearTeamShare(): Promise<void> {
  await prisma.setting.deleteMany({ where: { key: TEAM_SHARE } })
}
