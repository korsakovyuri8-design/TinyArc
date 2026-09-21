import type { DeclaredLicence } from '@/engine/licensing'

/**
 * Лицензии и контакты в форме специалиста: разбор и обратная подстановка.
 *
 * В одном месте, потому что анкету сохраняют три пути: подача, дозаполнение
 * после импорта и правка из панели. Три копии разбора разошлись бы на первой
 * же поправке, и лицензия терялась бы ровно на том пути, где её поправили.
 */

/**
 * Собирает лицензии из полей вида `licence_<страна>_<что>`.
 *
 * Страны: проживания и подписи, без повторов. Поля от страны, которую человек
 * отметил и снял, браузер всё равно пришлёт; без этой отсечки в базу попала бы
 * лицензия страны, о которой человек в итоге ничего не заявлял.
 */
export function collectLicences(formData: FormData, signsIn: unknown, residence: unknown): unknown[] {
  const countries = new Set<string>()
  if (typeof residence === 'string' && residence) countries.add(residence)
  if (Array.isArray(signsIn)) for (const j of signsIn) countries.add(String(j))

  const out: unknown[] = []
  for (const j of countries) {
    const number = String(formData.get(`licence_${j}_number`) ?? '').trim()
    const authority = String(formData.get(`licence_${j}_authority`) ?? '').trim()

    // Пустая строка ничего не утверждает, а в панели выглядела бы как
    // заявленная и непроверенная лицензия.
    if (!number && !authority) continue

    out.push({
      jurisdiction: j,
      authority,
      number,
      registryUrl: String(formData.get(`licence_${j}_registry`) ?? '').trim(),
    })
  }
  return out
}

/** Читает сохранённые лицензии, не падая на кривой записи. */
export function readLicences(json: string): DeclaredLicence[] {
  try {
    const parsed: unknown = JSON.parse(json)
    return Array.isArray(parsed) ? (parsed as DeclaredLicence[]) : []
  } catch {
    return []
  }
}

/**
 * Поля формы из записи: контакты, страна проживания и лицензии россыпью.
 *
 * Без этого правка профиля из панели открывала бы пустые поля лицензий, и
 * первое же сохранение по другому поводу стирало бы номера молча.
 */
export function contactDefaults(row: {
  residenceCountry: string
  linkedinUrl: string
  phone: string
  phoneWhatsapp: boolean
  licencesJson: string
}): Record<string, string> {
  const out: Record<string, string> = {
    residenceCountry: row.residenceCountry,
    linkedinUrl: row.linkedinUrl,
    phone: row.phone,
  }
  if (row.phoneWhatsapp) out.phoneWhatsapp = '1'
  for (const l of readLicences(row.licencesJson)) {
    out[`licence_${l.jurisdiction}_authority`] = l.authority
    out[`licence_${l.jurisdiction}_number`] = l.number
    if (l.registryUrl) out[`licence_${l.jurisdiction}_registry`] = l.registryUrl
  }
  return out
}
