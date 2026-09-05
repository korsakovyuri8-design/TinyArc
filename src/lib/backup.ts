/**
 * Выгрузка базы и восстановление из неё.
 *
 * Резервных копий у продукта не было вовсе: на бесплатном плане Postgres их не
 * делает никто, а данные здесь — чужие проекты, чужие профили и счета, которые
 * мы обязаны хранить перед страной регистрации.
 *
 * Копия логическая, строками, а не снимком тома. Причин две. Она читается чем
 * угодно и переживает смену провайдера базы — снимок Render вне Render не
 * открывается. И она же закрывает вторую обязанность: выгрузить данные по
 * требованию, а не только «удалить по требованию».
 *
 * Это не замена копиям провайдера, а то, что есть, пока их нет: у логической
 * выгрузки нет восстановления на момент времени, и потерянным окажется всё,
 * что случилось после последней.
 *
 * Формат — NDJSON: строка на запись, первой строкой заголовок. Не zip и не
 * снимок: строчный формат читается по кускам и не требует держать базу в
 * памяти целиком, а повреждённый файл теряет хвост, а не весь архив.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Порядок таблиц: сначала те, на кого ссылаются.
 *
 * Порядок нужен восстановлению: строка со ссылкой на несуществующую запись не
 * запишется. Выгрузка идёт тем же порядком, чтобы восстановление читало файл
 * подряд и ничего не откладывало.
 *
 * `RateWindow` здесь намеренно нет: это окна ограничителя частоты, живущие
 * минуты. Восстановленное окно означало бы отказ формы человеку, который в
 * неё ещё не заходил.
 */
export const TABLES = [
  // Корпус норм ни от чего не зависит и восстанавливается первым: без него
  // проверка на нормы после восстановления молчит, а молчание читается как
  // «всё сошлось».
  'ComplianceRule',
  // Ставки гонорара ни от чего не зависят. Без них восстановленная база
  // считает маржу по пустому расходу, то есть завышает её на всю величину
  // расхода: ошибка всегда в одну сторону и выглядит как хороший год.
  'PayoutRate',
  // Сеть подрядчиков ни от чего не зависит и восстанавливается вместе с
  // корпусом норм: без неё короткий список после восстановления пуст, а пустой
  // список читается как «подрядчиков нет», а не как «мы их потеряли».
  'Contractor',
  'ContractorTrade',
  'Specialist',
  'Project',
  'MatchRun',
  'Candidate',
  'TeamSlot',
  'Ticket',
  'TicketDependency',
  'TicketComment',
  'Artifact',
  'Invoice',
  // Обязательства идут после проекта и специалиста: они ссылаются на обоих.
  'Payout',
  'StageApproval',
  'ClientMessage',
  'DesignDirection',
  'Withdrawal',
  'Collaboration',
  'PortfolioItem',
  'Notification',
] as const

export type Table = (typeof TABLES)[number]

/** Таблицы, которых в копии нет намеренно, и почему. */
export const SKIPPED: Record<string, string> = {
  RateWindow: 'окна ограничителя частоты живут минуты; восстановленное окно — отказ на пустом месте',
}

export const BACKUP_FORMAT = 1

export type Header = {
  backup: number
  createdAt: string
  counts: Record<string, number>
}

/**
 * Поля дат по таблицам — из самой схемы, а не списком рядом.
 *
 * Нужны восстановлению: в JSON дата становится строкой, и вернуть её обратно
 * надо ровно там, где она была датой. Угадывать по виду строки нельзя —
 * комментарий, в котором человек написал дату, превратился бы в дату и лёг бы
 * в текстовое поле объектом.
 */
export function dateFields(schema: string): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>()

  for (const match of schema.matchAll(/\nmodel\s+(\w+)\s*\{([\s\S]*?)\n\}/g)) {
    const [, model, body] = match
    const fields = new Set<string>()

    for (const line of body!.split('\n')) {
      // Отношения и списки отношений — не колонки: у них имя модели, а не тип.
      const field = line.trim().match(/^(\w+)\s+DateTime(\?)?\s*(.*)$/)
      if (field) fields.add(field[1]!)
    }

    result.set(model!, fields)
  }

  return result
}

/** Модели, объявленные в схеме. Нужны проверке «копия не забыла таблицу». */
export function modelsIn(schema: string): string[] {
  return [...schema.matchAll(/\nmodel\s+(\w+)\s*\{/g)].map((m) => m[1]!)
}

/** Схема проекта. Читается один раз: она не меняется на ходу. */
export function schemaText(): string {
  return readFileSync(join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8')
}

/**
 * Вернуть датам их тип.
 *
 * Строка, которая была датой, снова становится датой; всё остальное остаётся
 * как есть, даже если выглядит датой.
 */
export function revive(row: Record<string, unknown>, dates: Set<string>): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(row)) {
    result[key] = dates.has(key) && typeof value === 'string' ? new Date(value) : value
  }

  return result
}

/** Строка файла: заголовок или запись таблицы. */
export type Line = { header: Header } | { table: Table; row: Record<string, unknown> }

export function encode(line: Line): string {
  return JSON.stringify(line)
}

export function decode(text: string): Line {
  return JSON.parse(text) as Line
}
