/**
 * Разбор CSV без библиотеки.
 *
 * Библиотека здесь была бы честнее, но формат ровно один — выгрузка из таблицы,
 * — и правила у него простые: запятая или точка с запятой, кавычки для полей с
 * разделителем внутри, удвоенная кавычка как экранирование. Тридцать строк кода
 * против зависимости, которую придётся обновлять.
 *
 * Разделитель определяется по первой строке: русские таблицы Excel сохраняют с
 * точкой с запятой, и человек, который выгрузил базу, об этом не знает.
 */

export type Row = Record<string, string>

/** Символ-разделитель: тот, которого больше в строке заголовков. */
export function detectDelimiter(header: string): string {
  const semicolons = (header.match(/;/g) ?? []).length
  const commas = (header.match(/,/g) ?? []).length
  const tabs = (header.match(/\t/g) ?? []).length

  if (tabs > semicolons && tabs > commas) return '\t'
  return semicolons > commas ? ';' : ','
}

/** Одна строка CSV в поля. Кавычки снимаются, удвоенные — схлопываются. */
function splitLine(line: string, delimiter: string): string[] {
  const fields: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]

    if (quoted) {
      if (char === '"') {
        // Удвоенная кавычка внутри поля — это одна кавычка, а не конец поля.
        if (line[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      quoted = true
    } else if (char === delimiter) {
      fields.push(field)
      field = ''
    } else {
      field += char
    }
  }

  fields.push(field)
  return fields.map((f) => f.trim())
}

/**
 * Текст CSV в строки-объекты.
 *
 * Заголовки приводятся к нижнему регистру: «Email», «email» и «E-mail» — это
 * один и тот же столбец, и человек, выгружавший базу, не обязан об этом думать.
 */
export function parseCsv(text: string): Row[] {
  // Многострочные поля в кавычках здесь не поддерживаются намеренно: они
  // встречаются в описаниях, а описания в базу специалистов не приходят.
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length < 2) return []

  const delimiter = detectDelimiter(lines[0]!)
  const headers = splitLine(lines[0]!, delimiter).map((h) => h.toLowerCase().replace(/[\s_-]+/g, ''))

  return lines.slice(1).map((line) => {
    const values = splitLine(line, delimiter)
    const row: Row = {}

    headers.forEach((header, i) => {
      if (header) row[header] = values[i] ?? ''
    })

    return row
  })
}
