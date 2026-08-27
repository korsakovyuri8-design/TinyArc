/**
 * Стадия Validate (концепт, п.7). Публичное имя стадии — Filter.
 *
 * Здесь проверяется не специалист, а сам проект: попадает ли он в продуктовую
 * границу (п.5). Если нет — мы отказываем, а не берём и не тянем. Отказ выдаёт
 * движок, не человек: границу нельзя подвинуть уговорами.
 */

import {
  JURISDICTIONS,
  JURISDICTION_NAMES,
  MAX_STOREYS,
  TYPOLOGIES,
  type Jurisdiction,
} from './taxonomy'
import type { ProjectRequirements } from './types'

export type Validation = { ok: true } | { ok: false; reason: string }

export function validateProject(requirements: ProjectRequirements): Validation {
  if (requirements.storeys > MAX_STOREYS) {
    return {
      ok: false,
      reason: `${requirements.storeys} этажей — выше продуктовой границы. Bureau ведёт здания до ${MAX_STOREYS} этажей включительно: выше начинается другой объём экспертиз и другая юридическая конструкция.`,
    }
  }

  if (requirements.storeys < 1) {
    return { ok: false, reason: 'Этажность должна быть не меньше одного этажа.' }
  }

  if (requirements.areaSqm <= 0) {
    return { ok: false, reason: 'Площадь должна быть больше нуля.' }
  }

  if (!TYPOLOGIES.includes(requirements.typology)) {
    return {
      ok: false,
      reason: 'Типология вне продуктовой границы. Bureau ведёт виллы, townhouse, multi-family и mixed-use.',
    }
  }

  if (!JURISDICTIONS.includes(requirements.jurisdiction)) {
    return {
      ok: false,
      reason: `Страна пока не открыта. Bureau работает в: ${JURISDICTIONS.map((j) => JURISDICTION_NAMES[j]).join(', ')}.`,
    }
  }

  if (requirements.regulatoryTrack !== 'light') {
    return {
      ok: false,
      reason: 'Проект в зоне стандартного регулирования. Bureau ведёт объекты в зонах лёгкого регулирования — это и есть условие, при котором алгоритмическая сборка команды работает.',
    }
  }

  return { ok: true }
}

export function jurisdictionName(jurisdiction: Jurisdiction): string {
  return JURISDICTION_NAMES[jurisdiction]
}
