/**
 * Сервис-воркер: что он отвечает, когда сети нет.
 *
 * Проверка по коду воркера, а не через браузер, и это исправление.
 * Сквозной сценарий эмулировал отсутствие сети средствами Playwright, а они
 * не распространяются на запросы самого воркера — тот иногда доходил до
 * сервера и получал обычную страницу. Проверка мигала примерно раз на три
 * прогона, и мигала она на чужой эмуляции, а не на нашем коде: в CI такая
 * проверка живёт ровно до того дня, когда её начинают перезапускать не глядя.
 *
 * Здесь воркер исполняется в поддельной области видимости: свои `caches`, своя
 * `fetch`, свой `Response`. Это позволяет сказать «сеть отказала» точно, а не
 * приблизительно, и посмотреть, что он отдаёт в ответ.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  join(import.meta.dirname, '..', '..', 'public', 'sw.js'),
  'utf8',
)

const ORIGIN = 'https://example.test'

type Handlers = Record<string, (event: unknown) => void>

/** Запускает воркер в поддельной области и возвращает его обработчики. */
function run(networkFails: boolean): Handlers {
  const handlers: Handlers = {}

  const scope = {
    addEventListener: (name: string, handler: (event: unknown) => void) => {
      handlers[name] = handler
    },
    location: { origin: ORIGIN },
    skipWaiting: () => undefined,
    clients: { claim: () => Promise.resolve() },
  }

  const caches = {
    open: () =>
      Promise.resolve({
        addAll: () => Promise.resolve(),
        put: () => Promise.resolve(),
      }),
    keys: () => Promise.resolve([]),
    delete: () => Promise.resolve(true),
    match: () => Promise.resolve(undefined),
  }

  const fetchImpl = networkFails
    ? () => Promise.reject(new Error('сети нет'))
    : () => Promise.resolve(new Response('живая страница', { status: 200 }))

  // eslint-disable-next-line no-new-func
  const load = new Function('self', 'caches', 'fetch', 'Response', 'URL', source)
  load(scope, caches, fetchImpl, Response, URL)

  return handlers
}

/** Прогоняет обработчик запроса и возвращает то, что он отдал. */
async function answer(
  handlers: Handlers,
  request: { method: string; url: string; mode?: string },
): Promise<Response | undefined> {
  let answered: Promise<Response> | undefined

  handlers.fetch!({
    request,
    respondWith: (value: Promise<Response>) => {
      answered = value
    },
  })

  return answered ? await answered : undefined
}

describe('воркер без сети', () => {
  it('на переход по адресу отдаёт свой экран, а не ошибку браузера', async () => {
    const response = await answer(run(true), {
      method: 'GET',
      url: `${ORIGIN}/how-it-works`,
      mode: 'navigate',
    })

    expect(response?.status).toBe(503)
    expect(await response!.text()).toContain('No connection')
  })

  /*
   * Экран встроен в воркер намеренно: страница, объясняющая отсутствие сети,
   * не может сама зависеть от сети.
   */
  it('экран без сети по-английски', async () => {
    const response = await answer(run(true), {
      method: 'GET',
      url: `${ORIGIN}/`,
      mode: 'navigate',
    })

    expect(/[А-Яа-яЁё]/.test(await response!.text())).toBe(false)
  })

  it('на прочие запросы отвечает пустым отказом, а не экраном', async () => {
    const response = await answer(run(true), {
      method: 'GET',
      url: `${ORIGIN}/api/files/abc`,
    })

    expect(response?.status).toBe(503)
    expect(await response!.text()).toBe('')
  })
})

describe('воркер при живой сети', () => {
  it('страницу отдаёт сеть, а не кэш', async () => {
    const response = await answer(run(false), {
      method: 'GET',
      url: `${ORIGIN}/project`,
      mode: 'navigate',
    })

    expect(response?.status).toBe(200)
    expect(await response!.text()).toBe('живая страница')
  })

  /*
   * Отправку формы воркер не трогает вовсе: перехватить её значит однажды
   * отправить её дважды.
   */
  it('отправку формы не перехватывает', async () => {
    const response = await answer(run(false), {
      method: 'POST',
      url: `${ORIGIN}/project`,
      mode: 'navigate',
    })

    expect(response).toBeUndefined()
  })

  it('чужой источник не перехватывает', async () => {
    const response = await answer(run(false), {
      method: 'GET',
      url: 'https://another.test/thing',
      mode: 'navigate',
    })

    expect(response).toBeUndefined()
  })
})
