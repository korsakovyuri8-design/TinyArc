/**
 * Форма запроса к модели проверяется по исходнику.
 *
 * Поведением её здесь не проверить: на стенде помощника подменяет заглушка, и
 * ключа нет ни в разработке, ни в CI. Значит единственное, что отделяет
 * работающий адаптер от сломанного, — внимательность того, кто его правит, а
 * этого мало: API меняется снаружи, и меняется молча.
 *
 * Каждый пункт ниже — то, что ломается без единой ошибки при сборке и
 * выясняется первым живым запросом, то есть у человека, которому помощник
 * нужен прямо сейчас.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ASSISTANT_METHODS } from './methods'

const source = readFileSync(join(import.meta.dirname, 'anthropic.ts'), 'utf8')

describe('договор с моделью', () => {
  /*
   * Идентификатор без даты. Датированный вариант — самая частая правка «по
   * памяти», и он либо не существует, либо однажды перестаёт обслуживаться.
   */
  it('модель названа точным идентификатором, без даты', () => {
    const model = source.match(/const MODEL = '([^']+)'/)?.[1]

    expect(model, 'MODEL из модуля пропал').toBeTruthy()
    expect(model).toBe('claude-opus-5')
    expect(model, 'к идентификатору приписана дата').not.toMatch(/-\d{8}$/)
  })

  /*
   * Рассуждение включается словом, а не бюджетом токенов: `budget_tokens` на
   * этой модели возвращает 400. Ошибка выглядит как отказ провайдера, и искать
   * её пойдут в ключе.
   */
  it('рассуждение адаптивное, а не по бюджету токенов', () => {
    expect(source).toContain("thinking: { type: 'adaptive' }")
    expect(source, 'budget_tokens этой моделью не принимается').not.toContain('budget_tokens')
  })

  /*
   * Структурный ответ задаётся через `output_config.format`. Прежнее имя
   * параметра снято, и запрос с ним разбирается как обычный текст: схема
   * молча перестаёт действовать, а ответ приходит «не по схеме».
   */
  it('структурный ответ задан нынешним параметром', () => {
    expect(source).toContain('output_config: { format:')
    expect(source, 'output_format снят с поддержки').not.toMatch(/\boutput_format\b/)
  })

  /*
   * Подстановка начала ответа ассистента на этой модели возвращает 400.
   * Соблазн вернуться к ней возникает каждый раз, когда хочется задать формат.
   */
  it('начало ответа не подставляется', () => {
    expect(source).not.toMatch(/role:\s*'assistant'/)
  })

  it('потолок ответа не ставится впритык', () => {
    const floor = Number(source.match(/const MIN_TOKENS = (\d+)/)?.[1])

    expect(floor, 'MIN_TOKENS из модуля пропал').toBeGreaterThan(0)
    /*
     * Рассуждение тратит те же токены, что и ответ. Потолок, рассчитанный
     * только на ответ, обрывает его на трудном входе — то есть ровно там, где
     * помощник и нужен.
     */
    expect(floor).toBeGreaterThanOrEqual(4000)

    const literals = [...source.matchAll(/^\s+(\d{3,}),$/gm)].map((m) => Number(m[1]))
    for (const value of literals) {
      expect(value, `потолок ${value} ниже нижней границы`).toBeGreaterThanOrEqual(floor)
    }
  })

  /*
   * Четыре причины отказа различаются на месте. Одна фраза на все посылает
   * чинить не то: предел частоты лечится ожиданием, обрыв — потолком, отказ
   * модели — руками, сеть — повтором.
   */
  it('каждая причина отказа названа отдельно', () => {
    for (const reason of ['rate_limit', 'auth', 'network', 'provider', 'refusal', 'truncated', 'schema']) {
      expect(source, `причина «${reason}» не разбирается`).toContain(`'${reason}'`)
    }
  })

  it('отказ модели читается по stop_reason, а не по пустому разбору', () => {
    expect(source).toContain("stop_reason === 'refusal'")
    expect(source).toContain("stop_reason === 'max_tokens'")
  })

  it('ошибки провайдера разбираются от частного к общему', () => {
    const order = ['RateLimitError', 'AuthenticationError', 'APIConnectionError', 'APIError']
    const at = order.map((name) => source.indexOf(name))

    for (const index of at) expect(index).toBeGreaterThan(-1)
    // APIError — родитель остальных: поставленный первым, он их проглотит.
    expect(at[3]).toBeGreaterThan(Math.max(at[0]!, at[1]!, at[2]!))
  })
})

/**
 * Помощник, которого никто не зовёт, — это не помощник.
 *
 * Написанный и неподключённый метод выглядит работающим: он есть в интерфейсе,
 * покрыт заглушкой, проходит типы. Отличить его от работающего можно только
 * одним способом — поискать, кто его зовёт.
 */
describe('каждый помощник достижим', () => {
  const app = readFileSync(join(import.meta.dirname, '..', '..', 'app', 'ops', 'actions.ts'), 'utf8')
  const at = (...parts: string[]) =>
    readFileSync(join(import.meta.dirname, '..', '..', 'app', ...parts), 'utf8')

  const callers = [
    app,
    at('brief', 'actions.ts'),
    at('project', 'actions.ts'),
    at('work', 'actions.ts'),
  ].join('\n')

  for (const method of ASSISTANT_METHODS) {
    it(`«${method}» зовут из действия`, () => {
      expect(callers, `${method} написан, но его никто не зовёт`).toContain(`${method}(`)
    })
  }
})
