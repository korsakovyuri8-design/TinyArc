import { describe, expect, it } from 'vitest'
import { DISCIPLINE_ALIASES, matchMany, matchOne, normalise } from './aliases'
import { detectDelimiter, parseCsv } from './csv'
import { missingForSelection, readIntake } from './map'

describe('разбор CSV', () => {
  it('узнаёт разделитель русского Excel', () => {
    expect(detectDelimiter('Имя;Почта;Роль')).toBe(';')
    expect(detectDelimiter('name,email,role')).toBe(',')
    expect(detectDelimiter('name\temail\trole')).toBe('\t')
  })

  it('снимает кавычки и не делит по разделителю внутри них', () => {
    const rows = parseCsv('name,role\n"Петров, Иван","Архитектор, ландшафт"')

    expect(rows[0]).toEqual({ name: 'Петров, Иван', role: 'Архитектор, ландшафт' })
  })

  it('схлопывает удвоенную кавычку', () => {
    const rows = parseCsv('name\n"Бюро ""Форма"""')

    expect(rows[0]!.name).toBe('Бюро "Форма"')
  })

  it('приводит заголовки к одному виду', () => {
    const rows = parseCsv('E-Mail,Display Name\na@b.com,Иван')

    expect(rows[0]).toEqual({ email: 'a@b.com', displayname: 'Иван' })
  })
})

describe('распознавание значений', () => {
  it('нормализует регистр, ё и пунктуацию', () => {
    expect(normalise('Чёрный, Дом')).toBe('черный дом')
  })

  it('узнаёт дисциплину в любом написании', () => {
    for (const written of ['Архитектор', 'архитектура', 'Architect', 'АРХИТЕКТОР']) {
      expect(matchOne(written, DISCIPLINE_ALIASES)).toBe('architecture')
    }
  })

  it('длинный синоним побеждает короткий', () => {
    // «ландшафтный архитектор» — это ландшафт, а не архитектура, хотя слово
    // «архитектор» в строке есть. Спасает только привязка к началу.
    expect(matchOne('Ландшафтный архитектор', DISCIPLINE_ALIASES)).toBe('landscape')
  })

  it('делит ячейку-список и собирает нераспознанное отдельно', () => {
    const result = matchMany('Архитектор; Ландшафт; Астролог', DISCIPLINE_ALIASES)

    expect(result.values).toEqual(['architecture', 'landscape'])
    expect(result.unknown).toEqual(['Астролог'])
  })

  it('не угадывает: неизвестное остаётся неизвестным', () => {
    expect(matchOne('Специалист широкого профиля', DISCIPLINE_ALIASES)).toBeNull()
  })
})

describe('строка таблицы в черновик', () => {
  const CSV = [
    'Имя;Почта;Роль;Страна;Софт;Язык;Портфолио;Этажность',
    'Иван Петров;ivan@example.com;Архитектор;Черногория;Revit, ArchiCAD;русский, английский;https://behance.net/ivan;3',
    'Мария Йовановић;maria@example.com;Конструктор;Сербия, Черногория;Tekla;сербский;https://example.com/m;12',
  ].join('\n')

  it('читает то, что есть, и не требует того, чего нет', () => {
    const intake = readIntake(CSV)
    const first = intake.rows[0]

    expect(first?.ok).toBe(true)
    if (!first?.ok) return

    expect(first.draft).toMatchObject({
      email: 'ivan@example.com',
      displayName: 'Иван Петров',
      disciplines: ['architecture'],
      jurisdictions: ['ME'],
      software: ['revit', 'archicad'],
      languages: ['ru', 'en'],
      maxStoreys: 3,
    })
  })

  it('срезает этажность до продуктовой границы', () => {
    const intake = readIntake(CSV)
    const second = intake.rows[1]

    expect(second?.ok).toBe(true)
    if (!second?.ok) return

    // В таблице стояло 12: опыт настоящий, но выше пяти этажей мы не работаем.
    expect(second.draft.maxStoreys).toBe(5)
    expect(second.draft.jurisdictions).toEqual(['RS', 'ME'])
  })

  it('называет узнанные и проигнорированные столбцы', () => {
    const intake = readIntake('Имя;Почта;Ставка\nИван;ivan@example.com;40')

    expect(intake.recognisedColumns).toContain('displayName')
    expect(intake.recognisedColumns).toContain('email')
    expect(intake.ignoredColumns).toEqual(['ставка'])
  })

  it('нумерует строки как в файле, считая заголовок', () => {
    const intake = readIntake('Имя;Почта\nИван;ivan@example.com')

    expect(intake.rows[0]!.line).toBe(2)
  })
})

describe('что импорт отказывается брать', () => {
  it('строку без имени', () => {
    const [row] = readIntake('Имя;Почта\n;ivan@example.com').rows

    expect(row).toMatchObject({ ok: false, problem: 'нет имени' })
  })

  it('строку с адресом, который не адрес', () => {
    const [row] = readIntake('Имя;Почта\nИван;телеграм @ivan').rows

    expect(row).toMatchObject({ ok: false, problem: 'адрес не похож на почту' })
  })

  it('повтор адреса внутри файла', () => {
    const rows = readIntake(
      'Имя;Почта\nИван;a@b.com\nИван Петров;a@b.com',
    ).rows

    expect(rows[0]!.ok).toBe(true)
    expect(rows[1]).toMatchObject({ ok: false, problem: 'этот адрес уже был выше' })
  })

  it('специализацию не из заявленной дисциплины', () => {
    const [row] = readIntake(
      'Имя;Почта;Роль;Специализация\nИван;a@b.com;Конструктор;Генплан территории',
    ).rows

    expect(row?.ok).toBe(true)
    if (!row?.ok) return

    expect(row.draft.specializations).toEqual([])
    expect(row.unrecognised.join(' ')).toContain('не из заявленной дисциплины')
  })
})

describe('чего не хватает для отбора', () => {
  it('называет пробелы, которые человек дозаполнит сам', () => {
    const [row] = readIntake('Имя;Почта\nИван;a@b.com').rows
    if (!row?.ok) throw new Error('строка должна была разобраться')

    expect(missingForSelection(row.draft)).toEqual([
      'дисциплина',
      'юрисдикция',
      'пакет',
      'язык',
      'стадия',
      'портфолио',
    ])
  })

  it('на полной строке молчит', () => {
    const [row] = readIntake(
      [
        'Имя;Почта;Роль;Страна;Софт;Язык;Стадия;Портфолио',
        'Иван;a@b.com;Архитектор;Черногория;Revit;русский;Разрешение на строительство;https://x.com',
      ].join('\n'),
    ).rows
    if (!row?.ok) throw new Error('строка должна была разобраться')

    expect(missingForSelection(row.draft)).toEqual([])
  })
})
