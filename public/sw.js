/*
 * Сервис-воркер.
 *
 * Он здесь ради одного: чтобы продукт ставился на телефон как приложение и
 * чтобы отсутствие сети выглядело как ответ, а не как ошибка браузера.
 *
 * Чего он намеренно не делает — кэширует страницы.
 *
 * Соблазн очевиден: закэшировать кабинет, и он открывается мгновенно даже в
 * метро. Но кабинет — это чужой проект, доска — чужие задачи, а панель бюро —
 * вся база разом. Кэш живёт на устройстве и переживает выход: человек, взявший
 * телефон в руки после владельца, открыл бы страницу, к которой у него больше
 * нет ключа. Ровно от этого продукт защищается тем, что у файлов нет публичных
 * адресов, а выдачу проверяет обработчик. Класть то же самое в кэш значит
 * обойти собственную защиту с другой стороны.
 *
 * Поэтому: статика — из кэша, всё остальное — из сети всегда, а когда сети
 * нет, отдаётся один встроенный экран.
 */

const VERSION = 'bureau-v1'
const SHELL = `${VERSION}-shell`

/* Только то, что одинаково для всех и ничего ни о ком не говорит. */
const STATIC = ['/icon-192.png', '/icon-512.png', '/icon-maskable-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(STATIC))
      // Промах по одному файлу не должен ломать установку целиком: без иконки
      // приложение работает, без воркера — нет.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((name) => !name.startsWith(VERSION)).map((n) => caches.delete(n))),
      )
      .then(() => self.clients.claim()),
  )
})

/** Экран без сети. Встроен в воркер, чтобы не зависеть от сети сам. */
const OFFLINE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>No connection — TinyArc Cloud Bureau</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       background:#0a0e14;color:#e6edf5;font:16px/1.6 system-ui,-apple-system,sans-serif;padding:24px}
  main{max-width:34rem}
  h1{font-size:1.5rem;margin:0 0 12px}
  p{color:#8b9aad;margin:0 0 12px}
  b{color:#00c9e4;font-weight:600}
</style></head>
<body><main>
  <h1>No connection</h1>
  <p>The page is not here because it is not kept on this device. Project files, tasks
     and the pool live on the server, and reaching them needs a network — that is
     deliberate: a cabinet cached on a phone outlives the key that opened it.</p>
  <p>Nothing is lost. <b>Reload when you are back online.</b></p>
</main></body></html>`

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Всё, кроме обычного чтения, идёт мимо: отправку формы кэш не касается, а
  // перехватывать её значит однажды отправить её дважды.
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  const isStatic =
    url.pathname.startsWith('/_next/static/') ||
    STATIC.includes(url.pathname) ||
    url.pathname === '/favicon.ico'

  if (isStatic) {
    // Статика неизменяема по адресу: если она есть в кэше — она та самая.
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone()
              caches.open(SHELL).then((cache) => cache.put(request, copy))
            }
            return response
          }),
      ),
    )
    return
  }

  /*
   * Всё остальное — только из сети. Ответ не кладётся в кэш ни при каких
   * условиях: страницы здесь принадлежат конкретному человеку.
   */
  event.respondWith(
    fetch(request).catch(() => {
      if (request.mode === 'navigate') {
        return new Response(OFFLINE, {
          status: 503,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      }

      return new Response('', { status: 503 })
    }),
  )
})
