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
      reason: `${requirements.storeys} storeys — above the product boundary. Bureau handles buildings up to ${MAX_STOREYS} storeys inclusive: above that the scope of expert review and the legal construction are different.`,
    }
  }

  if (requirements.storeys < 1) {
    return { ok: false, reason: 'The building must have at least one storey.' }
  }

  if (requirements.areaSqm <= 0) {
    return { ok: false, reason: 'The floor area must be greater than zero.' }
  }

  if (!TYPOLOGIES.includes(requirements.typology)) {
    return {
      ok: false,
      reason: 'The typology is outside the product boundary. Bureau handles villas, townhouses, multi-family and mixed-use.',
    }
  }

  if (!JURISDICTIONS.includes(requirements.jurisdiction)) {
    return {
      ok: false,
      reason: `That country is not open yet. Bureau works in: ${JURISDICTIONS.map((j) => JURISDICTION_NAMES[j]).join(', ')}.`,
    }
  }

  if (requirements.regulatoryTrack !== 'light') {
    return {
      ok: false,
      reason: 'The project sits in a standard-regulation zone. Bureau handles buildings in light-regulation zones — that is the condition under which algorithmic team assembly works.',
    }
  }

  return { ok: true }
}

export function jurisdictionName(jurisdiction: Jurisdiction): string {
  return JURISDICTION_NAMES[jurisdiction]
}
