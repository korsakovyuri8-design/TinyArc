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
  return `${discipline} — ${parts.join(gap.mode === 'all' ? ' и ' : ' или ')}`
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
    headline: 'Команда пока не собрана',
    body:
      gap.candidates === 0
        ? `Под ваш проект нужна роль, которую мы пока не закрыли: ${who}. ` +
          `Со стажем согласований в стране «${where}» такого специалиста в пуле сейчас нет. ` +
          'Мы не подставляем вместо него того, кто рядом: это ровно та подмена, ' +
          'из-за которой проекты потом переделывают. ' +
          'Бюро ищет человека под эту роль — ключ доступа у вас, по нему вы вернётесь в проект.'
        : `Под ваш проект нужна роль, которую мы пока не закрыли: ${who}. ` +
          `Подходящие в стране «${where}» есть — ${gap.candidates}, — но ни один состав ` +
          'не сходится целиком: у одних нет свободного времени к вашему сроку, ' +
          'у других не совпадает рабочий пакет с остальной командой. ' +
          'Бюро разбирает это вручную — ключ доступа у вас, по нему вы вернётесь в проект.',
  }
}
