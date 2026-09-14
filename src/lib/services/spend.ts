/**
 * Расход наружу: обращения к внешним моделям.
 *
 * Существует потому, что расход был ограничен по частоте и не считался нигде.
 * Предел частоты защищает от залипшего пальца на кнопке — он не отвечает на
 * вопрос «во что модели обошлись за неделю», а этот вопрос задают в конце
 * месяца, когда менять что-либо уже поздно.
 *
 * Денег здесь нет намеренно. Цена токена живёт у провайдера, меняется без нас
 * и по стране покупателя; зашитая в код, она однажды покажет бюро уверенное
 * число, которое неверно. Считаются токены и обращения — то, что мы знаем
 * точно, — а перевести их в евро можно по прейскуранту, глядя на него.
 */

import { prisma } from '../db'

export type ModelCallRecord = {
  provider: string
  model: string
  /** Имя помощника или `image`. По нему видно, что именно дорого. */
  purpose: string
  inputTokens?: number | null
  outputTokens?: number | null
  /** `ok` или причина отказа. */
  outcome: string
  ms?: number | null
}

/**
 * Записывает обращение. Никогда не бросает.
 *
 * Учёт — служебная запись, а вызов, ради которого человек нажал кнопку,
 * основной. Уронить второй из-за первого значило бы поменять их местами:
 * бюро осталось бы без черновика постановки ради строки в журнале расхода.
 */
export async function recordModelCall(call: ModelCallRecord): Promise<void> {
  try {
    await prisma.modelCall.create({
      data: {
        provider: call.provider,
        model: call.model,
        purpose: call.purpose,
        inputTokens: call.inputTokens ?? null,
        outputTokens: call.outputTokens ?? null,
        outcome: call.outcome,
        ms: call.ms ?? null,
      },
    })
  } catch (error) {
    console.error('Обращение к модели не записалось в журнал расхода:', error)
  }
}

export type SpendRow = {
  purpose: string
  calls: number
  /** Из них не ответивших. Оборванный ответ оплачен так же, как удавшийся. */
  failed: number
  inputTokens: number
  outputTokens: number
}

export type Spend = {
  since: Date
  rows: SpendRow[]
  calls: number
  failed: number
  inputTokens: number
  outputTokens: number
  /** Есть ли обращения без токенов: тогда итог занижен, и это надо сказать. */
  incomplete: boolean
}

/**
 * Расход за период, по помощникам.
 *
 * Разбит по назначению, а не по дням: бюро решает не «когда мы потратили», а
 * «что именно дорого» — и отключить или сузить можно только помощника.
 */
export async function spendSince(since: Date): Promise<Spend> {
  /*
   * Считает база, а не мы.
   *
   * Строки здесь копятся быстрее всех остальных — обращение к модели делается
   * нажатием кнопки, а не завершением проекта, — и тянуть их все в память,
   * чтобы сложить в цикле, значит однажды открывать панель за секунды. Пар
   * «помощник × исход» при этом десятки: свернуть их в базе дёшево, а
   * досчитать в памяти нечего.
   *
   * `_count.inputTokens` считает непустые: по расхождению с общим числом видно,
   * что часть обращений пришла без счётчика токенов и итог занижен.
   */
  const grouped = await prisma.modelCall.groupBy({
    by: ['purpose', 'outcome'],
    where: { at: { gte: since } },
    _count: { _all: true, inputTokens: true },
    _sum: { inputTokens: true, outputTokens: true },
  })

  const byPurpose = new Map<string, SpendRow>()
  let incomplete = false

  for (const row of grouped) {
    const found = byPurpose.get(row.purpose) ?? {
      purpose: row.purpose,
      calls: 0,
      failed: 0,
      inputTokens: 0,
      outputTokens: 0,
    }

    const calls = row._count._all

    found.calls += calls
    if (row.outcome !== 'ok') found.failed += calls

    if (row._count.inputTokens < calls) incomplete = true

    found.inputTokens += row._sum.inputTokens ?? 0
    found.outputTokens += row._sum.outputTokens ?? 0

    byPurpose.set(row.purpose, found)
  }

  const list = [...byPurpose.values()].sort((a, b) => b.outputTokens - a.outputTokens)

  return {
    since,
    rows: list,
    calls: list.reduce((n, r) => n + r.calls, 0),
    failed: list.reduce((n, r) => n + r.failed, 0),
    inputTokens: list.reduce((n, r) => n + r.inputTokens, 0),
    outputTokens: list.reduce((n, r) => n + r.outputTokens, 0),
    incomplete,
  }
}
