/**
 * Каждая закрытая дверь спрашивает, кто пришёл.
 *
 * Сегодня спрашивают все — это проверено руками и сквозными сценариями.
 * Сторожит это ничто: серверное действие достижимо прямым запросом, и новое
 * действие в панели бюро, написанное без проверки оператора, будет работать,
 * выглядеть нормально и отдавать всю базу специалистов любому, кто повторит
 * запрос. Такую дыру не видно ни на экране, ни в отзыве: она выглядит как
 * работающая кнопка.
 *
 * Проверка структурная, по исходникам. Поведением её не заменить: чтобы
 * поймать пропуск поведением, нужен сценарий на каждое действие, а пишет их
 * тот же человек, который забыл проверку.
 *
 * Исключения названы поимённо и с причиной. Список исключений без причин — это
 * не список исключений, это место, куда дописывают то, что не проходит.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const APP = join(import.meta.dirname, '..', 'app')

type Area = {
  /** Каталог внутри src/app. */
  dir: string
  /** Чем в этой части доказывают личность. */
  guards: string[]
  /** Действия, которым доказывать нечего, и почему. */
  exceptions?: Record<string, string>
}

const AREAS: Area[] = [
  {
    // Панель бюро: пароль. За ней все проекты и вся база специалистов.
    dir: 'ops',
    guards: ['requireOperator()', 'isOperator()'],
    exceptions: {
      opsSignIn: 'это и есть дверь: проверять пароль до формы пароля невозможно',
      opsSignOut: 'выходу доказывать нечего — он ничего не открывает',
    },
  },
  {
    // Доска специалиста: ключ доступа. За ней чужие задачи и файлы проектов.
    dir: 'work',
    guards: ['currentSpecialistId()', 'currentSpecialist()', 'act('],
  },
  {
    // Кабинет заказчика: ключ проекта. За ней его проект и переписка с бюро.
    dir: 'project',
    guards: ['currentProjectId()'],
  },
]

/**
 * Открытые части. Личности у пришедшего нет по замыслу — бриф отправляет
 * человек с улицы, — поэтому дверь здесь сторожит ограничитель частоты:
 * одна отправка запускает прогон по всему пулу.
 */
const OPEN = ['brief', 'specialists/apply', 'enter']

function filesIn(dir: string, names: string[], found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)

    if (statSync(full).isDirectory()) {
      filesIn(full, names, found)
      continue
    }

    if (names.includes(entry)) found.push(full)
  }

  return found
}

/** Тела экспортированных серверных действий файла: имя → исходник. */
function actions(source: string): Map<string, string> {
  const result = new Map<string, string>()

  for (const part of source.split(/\nexport async function /).slice(1)) {
    result.set(part.split('(')[0]!, part)
  }

  return result
}

describe('закрытые двери', () => {
  for (const area of AREAS) {
    const root = join(APP, area.dir)

    describe(`/${area.dir}`, () => {
      for (const file of filesIn(root, ['actions.ts'])) {
        const source = readFileSync(file, 'utf8')

        for (const [name, body] of actions(source)) {
          const why = area.exceptions?.[name]

          it(`${name} ${why ? 'назван исключением' : 'спрашивает, кто пришёл'}`, () => {
            if (why) {
              expect(why.length, `у исключения ${name} нет причины`).toBeGreaterThan(20)
              return
            }

            expect(
              area.guards.some((guard) => body.includes(guard)),
              `${name}: ни одной проверки личности (${area.guards.join(', ')})`,
            ).toBe(true)
          })
        }
      }

      for (const file of filesIn(root, ['page.tsx'])) {
        const source = readFileSync(file, 'utf8')
        const shown = file.slice(file.indexOf('/app/') + 5)

        it(`страница ${shown} спрашивает, кто пришёл`, () => {
          expect(
            area.guards.some((guard) => source.includes(guard)),
            `${shown}: страницу видно без ключа`,
          ).toBe(true)
        })
      }
    })
  }

  /*
   * Действие, которое доказывает личность чужим помощником, защищено ровно
   * настолько, насколько защищает помощник. Проверяется он сам: `act` —
   * единственная дверь доски специалиста, и если из неё убрать проверку,
   * всё вокруг продолжит выглядеть проверенным.
   */
  it('общий помощник доски сам спрашивает ключ', () => {
    const source = readFileSync(join(APP, 'work', 'actions.ts'), 'utf8')
    const helper = source.slice(source.indexOf('async function act('))

    expect(helper.slice(0, 600)).toContain('currentSpecialistId()')
  })
})

describe('открытые двери', () => {
  for (const dir of OPEN) {
    const file = join(APP, ...dir.split('/'), 'actions.ts')
    const source = readFileSync(file, 'utf8')

    for (const [name, body] of actions(source)) {
      it(`${name} ограничен по частоте`, () => {
        expect(body, `${name}: форма открыта всем и ничем не ограничена`).toContain('allow(')
      })
    }
  }
})

/*
 * И проверка самой проверки: она обязана что-то находить. Переименованный
 * каталог или сменившееся имя файла оставили бы её зелёной и пустой.
 */
describe('проверка не пуста', () => {
  it('находит закрытые действия и страницы', () => {
    const counted = AREAS.reduce((sum, area) => {
      const root = join(APP, area.dir)
      const acts = filesIn(root, ['actions.ts']).reduce(
        (n, file) => n + actions(readFileSync(file, 'utf8')).size,
        0,
      )

      return sum + acts + filesIn(root, ['page.tsx']).length
    }, 0)

    expect(counted).toBeGreaterThanOrEqual(30)
  })
})

/**
 * Чужое остаётся чужим (концепт, п.13).
 *
 * Заказчику видно публичное имя исполнителя и ничего сверх: ни почты, ни
 * ключа доступа. Одна строка `include: { specialist: true }` отдаёт клиентскому
 * компоненту всю запись целиком — вместе с ключом, которым в продукт входят, —
 * и выглядит это как обычное удобное включение связи.
 *
 * Проверяется поэтому форма запроса, а не отрисованная страница: на странице
 * лишнее поле просто не показано, а в свойствах компонента оно есть, и
 * прочитать его можно из браузера.
 */
describe('чужое не выдаётся', () => {
  /** Что о специалисте можно знать заказчику. */
  const VISIBLE = new Set(['id', 'displayName'])

  /*
   * Проверяются две формы, и только они. `specialist: true` — включение
   * записи целиком, и оно однозначно. `specialist: { select: … }` — список
   * полей, и он сверяется с разрешёнными.
   *
   * Третьей формы у Prisma нет: включение связи без списка полей и есть
   * `true`. Ловить «специалиста» по любому появлению в фигурных скобках
   * пробовали — под правило попадает обычный объект, собранный в коде, и
   * проверка начинает падать на месте, где никакой связи нет.
   */

  for (const dir of ['project', 'work']) {
    for (const file of filesIn(join(APP, dir), ['page.tsx', 'actions.ts'])) {
      const source = readFileSync(file, 'utf8')
      const shown = file.slice(file.indexOf('/app/') + 5)

      it(`${shown} не берёт запись специалиста целиком`, () => {
        expect(source, `${shown}: связь включена целиком, вместе с ключом и почтой`)
          .not.toContain('specialist: true')
      })

      it(`${shown} не берёт о специалисте лишнего`, () => {
        for (const match of source.matchAll(/specialist:\s*\{\s*select:\s*\{([^}]*)\}/g)) {
          const fields = [...(match[1] ?? '').matchAll(/(\w+)\s*:\s*true/g)].map((m) => m[1]!)

          for (const field of fields) {
            expect(VISIBLE.has(field), `${shown}: заказчику отдаётся «${field}»`).toBe(true)
          }
        }
      })
    }
  }
})
