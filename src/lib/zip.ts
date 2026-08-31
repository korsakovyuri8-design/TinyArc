/**
 * Сборка zip без сжатия.
 *
 * Зачем своё, а не библиотека. Комплект состоит из pdf, dwg и картинок —
 * форматов, которые уже сжаты, и дефлейт на них тратит время, ничего не
 * выигрывая. Остаётся способ хранения «как есть», а это формат из четырёх
 * структур, который целиком помещается в один файл с тестом. Первая
 * необязательная зависимость в проекте стоила бы дороже, чем эти сто строк:
 * её пришлось бы обновлять, проверять и объяснять.
 *
 * Формат: ZIP APPNOTE 6.3.3, метод 0 (stored). Пишется потоком — заголовок
 * записи, байты, следующая, — и только в конце центральный каталог. Поэтому
 * в памяти одновременно лежит один файл, а не весь комплект: у разрешительного
 * пакета это разница между сотней мегабайт и парой.
 *
 * Чего здесь нет намеренно: ZIP64. Он нужен от четырёх гигабайт или от 65535
 * записей, а один файл ограничен пятьюдесятью мегабайтами. Предел проверяется
 * явно и вслух — молча собранный битый архив хуже честного отказа.
 */

/** Дальше этого нужен ZIP64, которого здесь нет. */
export const ZIP_MAX_BYTES = 0xffffffff
/** Столько записей помещается в центральный каталог без ZIP64. */
export const ZIP_MAX_ENTRIES = 0xffff

export class TooLargeForZip extends Error {}

export type ZipEntry = {
  /**
   * Папка внутри архива. Задаём её мы, а не человек: она собирается из
   * наших же подписей стадий, и проверять её на «..» незачем — но проверяем,
   * потому что «незачем» живёт ровно до первой правки.
   */
  dir?: string
  /** Имя файла. Приходит от человека и потому чистится. */
  name: string
  bytes: Uint8Array
  /** Время записи. Нужно затем, чтобы распакованное не было из 1980 года. */
  modified?: Date
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)

  for (let i = 0; i < 256; i += 1) {
    let value = i
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[i] = value >>> 0
  }

  return table
})()

/** CRC-32, как его считает zip: тот же полином, что в PNG и gzip. */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff

  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }

  return (crc ^ 0xffffffff) >>> 0
}

/**
 * Дата и время в формате MS-DOS: два 16-битных слова.
 *
 * Секунды в нём лежат делёнными пополам, а год отсчитывается от 1980 — это не
 * причуда, а формат 1989 года, и переписать его мы не можем. Всё, что раньше
 * 1980-го, прижимается к началу: отрицательный год записать некуда.
 */
export function dosDateTime(date: Date): { time: number; dateWord: number } {
  const year = Math.max(1980, date.getUTCFullYear())

  return {
    time: (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | (date.getUTCSeconds() >> 1),
    dateWord: ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate(),
  }
}

/**
 * Одно звено пути: имя файла или имя папки.
 *
 * Имя приходит от человека и содержит что угодно: кириллицу, пробелы, слэши,
 * «..». Разделители снимаются целиком — звено на то и звено, а оставленный
 * слэш превращает имя в путь и при распаковке уводит файл из архива наружу.
 * Пустое имя заменяется, иначе запись невозможно достать.
 */
export function safeEntryPath(name: string, fallback: string): string {
  const flat = name
    .replace(/[\\/]+/g, '-')
    .split('')
    .filter((ch) => ch.charCodeAt(0) > 0x1f && ch.charCodeAt(0) !== 0x7f)
    .join('')
    .trim()

  // Имя из одних точек и дефисов запасным не считалось, и «///» приезжало
  // файлом «-», а «..» — именем, которое операционная система понимает не так,
  // как мы. Имя обязано нести хоть один свой знак.
  return /[^.-]/.test(flat) ? flat : fallback
}

function u16(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >> 8) & 0xff])
}

function u32(value: number): Uint8Array {
  return new Uint8Array([
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  ])
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0

  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }

  return out
}

/*
 * Флаг «имя в UTF-8» (бит 11). Без него распаковщик читает имя в кодировке
 * своей системы, и файл с кириллицей приезжает нечитаемым именем — как раз то,
 * что заказчик увидит первым.
 */
const UTF8_FLAG = 0x0800
const STORED = 0

type Placed = {
  path: Uint8Array
  crc: number
  size: number
  offset: number
  time: number
  dateWord: number
}

/**
 * Путь записи: папка, имя и разведение совпадений.
 *
 * Совпадающие имена zip не запрещает, и в этом ловушка. Два файла «План.pdf»
 * лягут в архив оба, а распаковщик молча запишет второй поверх первого —
 * заказчик недосчитается листа и не узнает об этом. Поэтому второе и
 * последующие совпадения получают номер.
 */
function unique(entry: ZipEntry, position: number, taken: Set<string>): string {
  const name = safeEntryPath(entry.name, `file-${position}`)
  const dir = entry.dir ? safeEntryPath(entry.dir, 'files') : ''
  const base = dir ? `${dir}/${name}` : name

  if (!taken.has(base)) {
    taken.add(base)
    return base
  }

  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  const extension = dot > 0 ? name.slice(dot) : ''

  for (let n = 2; ; n += 1) {
    const candidate = dir ? `${dir}/${stem} (${n})${extension}` : `${stem} (${n})${extension}`
    if (!taken.has(candidate)) {
      taken.add(candidate)
      return candidate
    }
  }
}

/**
 * Собрать архив потоком.
 *
 * `entries` — асинхронный источник: файлы приходят из хранилища по одному, и
 * держать их все сразу незачем. Возвращается поток байтов, который отдаётся
 * прямо в ответ.
 */
export function zipStream(entries: AsyncIterable<ZipEntry>): ReadableStream<Uint8Array> {
  const placed: Placed[] = []
  const taken = new Set<string>()
  let offset = 0

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const entry of entries) {
          if (placed.length >= ZIP_MAX_ENTRIES) {
            throw new TooLargeForZip('Too many files for a single archive.')
          }

          const path = new TextEncoder().encode(
            unique(entry, placed.length + 1, taken),
          )
          const { time, dateWord } = dosDateTime(entry.modified ?? new Date())
          const crc = crc32(entry.bytes)

          const header = concat([
            u32(0x04034b50),
            u16(20), // версия, нужная для распаковки
            u16(UTF8_FLAG),
            u16(STORED),
            u16(time),
            u16(dateWord),
            u32(crc),
            u32(entry.bytes.length),
            u32(entry.bytes.length),
            u16(path.length),
            u16(0),
            path,
          ])

          placed.push({ path, crc, size: entry.bytes.length, offset, time, dateWord })
          controller.enqueue(header)
          controller.enqueue(entry.bytes)
          offset += header.length + entry.bytes.length

          if (offset > ZIP_MAX_BYTES) {
            throw new TooLargeForZip('The archive is larger than the format allows without ZIP64.')
          }
        }

        const directoryStart = offset

        for (const item of placed) {
          const record = concat([
            u32(0x02014b50),
            u16(20), // чем создано
            u16(20), // чем распаковывать
            u16(UTF8_FLAG),
            u16(STORED),
            u16(item.time),
            u16(item.dateWord),
            u32(item.crc),
            u32(item.size),
            u32(item.size),
            u16(item.path.length),
            u16(0), // extra
            u16(0), // comment
            u16(0), // номер диска
            u16(0), // внутренние атрибуты
            u32(0), // внешние атрибуты
            u32(item.offset),
            item.path,
          ])

          controller.enqueue(record)
          offset += record.length
        }

        controller.enqueue(
          concat([
            u32(0x06054b50),
            u16(0),
            u16(0),
            u16(placed.length),
            u16(placed.length),
            u32(offset - directoryStart),
            u32(directoryStart),
            u16(0),
          ]),
        )

        controller.close()
      } catch (error) {
        // Ошибка в середине потока — это оборванная загрузка, а не битый архив
        // на диске у заказчика: без центрального каталога распаковщик скажет,
        // что файл повреждён, а не молча отдаст половину комплекта.
        controller.error(error)
      }
    },
  })
}
