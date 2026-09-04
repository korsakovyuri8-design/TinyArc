/**
 * Как называется положение проекта на экране.
 *
 * Существует потому, что статус и положение — разные вещи. Проект, чей прогон
 * не собрал команду, остаётся в статусе `draft`: это правда для базы, но метка
 * «бриф принят» — первое, что читает заказчик, и она успокаивает ровно того,
 * кому команду укомплектовать не удалось. Тремя строками ниже панель говорит
 * обратное, и человек остаётся с двумя сообщениями и без ответа.
 *
 * Положение считается из статуса и исхода последнего прогона вместе. Чистая
 * функция: экран ничего не решает, он показывает.
 */

/**
 * Тона перечислены значением, а не только типом: по ним проходит проверка,
 * сверяющая тон с классом оформления, а тип до неё не доживает.
 */
export const STANDING_TONES = ['accent', 'wait', 'fail', 'pass'] as const

export type StandingTone = (typeof STANDING_TONES)[number]

export type Standing = {
  label: string
  tone: StandingTone
}

/**
 * @param status статус проекта из базы
 * @param outcome исход последнего прогона; `null` — прогона ещё не было
 */
export function standingOf(status: string, outcome: string | null): Standing {
  if (status === 'rejected') return { label: 'Outside the product boundary', tone: 'fail' }
  if (status === 'delivered') return { label: 'Closed', tone: 'pass' }
  if (status === 'delivering') return { label: 'In production', tone: 'accent' }
  if (status === 'assembled') return { label: 'Team assembled', tone: 'accent' }

  /*
   * Черновик — единственное место, где статуса недостаточно. Прогона не было
   * — бриф действительно только что принят, и это спокойная новость. Прогон
   * был и не собрал состав — новость другая, и называть её надо своим именем.
   */
  if (status === 'draft') {
    if (outcome === null) return { label: 'Brief accepted', tone: 'accent' }
    if (outcome === 'ok') return { label: 'Team assembled', tone: 'accent' }
    if (outcome === 'no_signatory') return { label: 'No one to sign yet', tone: 'wait' }
    if (outcome === 'rejected') return { label: 'Outside the product boundary', tone: 'fail' }
    return { label: 'Team not assembled yet', tone: 'wait' }
  }

  return { label: status, tone: 'accent' }
}

/**
 * Класс метки под тон.
 *
 * Отдельной функцией, а не шаблонной строкой на месте: имена тонов совпадают
 * с суффиксами классов не случайно, но и не навсегда. Совпадение, на которое
 * никто не смотрит, ломается молча — метка теряет цвет и остаётся серой на
 * экране, где цвет и есть сообщение.
 */
export function standingClass(standing: Standing): string {
  return `tag tag-${standing.tone}`
}
