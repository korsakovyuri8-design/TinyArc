/**
 * Нехватка состава — словами, которые понимает заказчик.
 *
 * Движок отдаёт структуру, а не фразу. Фраза, собранная в движке, неминуемо
 * оказывается на его языке: в кабинете у владельца участка стояло «дисциплина
 * "mep" со специализацией mep_hvac + mep_electrical». Это не опечатка, это
 * граница, проведённая не там.
 *
 * Здесь та же нехватка называется по-русски и заканчивается тем, что будет
 * дальше. Клиенту нужен не диагноз нашего пула, а ответ на вопрос «что теперь».
 */

import type { AssemblyGap } from '@/engine/types'
import { JURISDICTION_NAMES, type Jurisdiction } from '@/engine/taxonomy'
import { DISCIPLINE_LABELS, SPECIALIZATION_LABELS } from './labels'

export function parseGap(json: string): AssemblyGap | null {
  if (!json) return null

  try {
    const parsed = JSON.parse(json) as AssemblyGap
    return parsed && typeof parsed.discipline === 'string' ? parsed : null
  } catch {
    return null
  }
}

/** Кого не хватает: «конструктор — дерево, каркас, CLT». */
export function roleName(gap: AssemblyGap): string {
  const discipline = DISCIPLINE_LABELS[gap.discipline] ?? gap.discipline

  if (gap.specializations.length === 0) return discipline

  const parts = gap.specializations.map((s) => SPECIALIZATION_LABELS[s] ?? s)

  // «all» значит, что нужен один человек, закрывающий всё перечисленное; «any»
  // — что достаточно любого из. Для читателя это «и» против «или».
  return `${discipline} — ${parts.join(gap.mode === 'all' ? ' and ' : ' or ')}`
}

/**
 * Что показать заказчику.
 *
 * Без извинений и без внутренней кухни: причина, честный статус и следующий
 * шаг. Обещания срока здесь нет намеренно — обещать неделю, не имея человека
 * на руках, значит потерять заказчика дважды.
 */
export function clientExplanation(
  gap: AssemblyGap,
  jurisdiction: Jurisdiction,
): { headline: string; body: string } {
  const who = roleName(gap)
  const where = JURISDICTION_NAMES[jurisdiction] ?? jurisdiction

  return {
    headline: 'The team is not assembled yet',
    body:
      gap.candidates === 0
        ? `Your project needs a role we have not covered yet: ${who}. ` +
          `There is no such specialist in the pool with approvals experience in ${where} right now. ` +
          'We do not put someone adjacent in their place: that substitution is exactly what ' +
          'makes projects get redone later. ' +
          'The bureau is looking for a person for this role — you have your key and can come back to the project with it.'
        : `Your project needs a role we have not covered yet: ${who}. ` +
          `Suitable people in ${where} exist — ${gap.candidates} of them — but no team ` +
          'comes together in full: some have no free time before your deadline, ' +
          'others do not share a working suite with the rest of the team. ' +
          'The bureau is sorting this out by hand — you have your key and can come back to the project with it.',
  }
}
