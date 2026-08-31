/**
 * Заголовки безопасности объявлены в конфигурации.
 *
 * Проверка по конфигурации, а не по живому ответу: сквозной сценарий увидел бы
 * их только на тех страницах, куда заходит, а заголовки должны стоять на всех
 * ответах сразу — включая выдачу файлов и отказы.
 *
 * Тест сторожит не значения (они меняются), а сам факт: набор не должен
 * молча похудеть. Заголовки уже один раз исчезли целиком — вместе с proxy,
 * который удаляли по другому поводу.
 */

import { describe, expect, it } from 'vitest'
import config from '../../next.config'

const REQUIRED = [
  'X-Content-Type-Options',
  'X-Frame-Options',
  'Content-Security-Policy',
  'Referrer-Policy',
  'Permissions-Policy',
  'Strict-Transport-Security',
]

/**
 * Правило, которое ловит всё. Ищется по источнику, а не по месту в списке:
 * правила рядом появляются (у сервис-воркера свои), и проверка, считающая их
 * количество, ломается от каждого такого добавления, ничего не защищая.
 */
async function catchAll() {
  const rules = await config.headers!()
  const rule = rules.find((r) => r.source === '/:path*')

  if (!rule) throw new Error('Правила на все ответы больше нет.')

  return rule
}

describe('заголовки безопасности', () => {
  it('стоят на каждом ответе', async () => {
    const keys = (await catchAll()).headers.map((h) => h.key)

    for (const required of REQUIRED) expect(keys).toContain(required)
  })

  it('запрещают встраивание в чужую страницу', async () => {
    const byKey = new Map((await catchAll()).headers.map((h) => [h.key, h.value]))

    expect(byKey.get('X-Frame-Options')).toBe('DENY')
    expect(byKey.get('Content-Security-Policy')).toContain("frame-ancestors 'none'")
  })

  /*
   * Правило для одного адреса не заменяет общее — заголовки складываются.
   * Проверяется именно это: узкое правило, снявшее защиту с какого-то пути,
   * выглядело бы в конфигурации совершенно безобидно.
   */
  it('узкие правила ничего не снимают с общего', async () => {
    const rules = await config.headers!()
    const общие = new Set((await catchAll()).headers.map((h) => h.key))

    for (const rule of rules) {
      if (rule.source === '/:path*') continue

      for (const header of rule.headers) {
        // Пересечь общий набор своим значением узкое правило не должно:
        // единственное исключение — CSP, где два заголовка дают пересечение
        // ограничений, то есть строже, а не слабее.
        if (header.key === 'Content-Security-Policy') continue
        expect(общие.has(header.key), `${rule.source} переопределяет ${header.key}`).toBe(false)
      }
    }
  })

  it('сервис-воркер не кэшируется и отдаётся скриптом', async () => {
    const rules = await config.headers!()
    const worker = rules.find((r) => r.source === '/sw.js')

    expect(worker, 'правила для сервис-воркера нет').toBeTruthy()

    const byKey = new Map(worker!.headers.map((h) => [h.key, h.value]))

    // Закэшированный воркер — это старая логика, которую нечем заменить:
    // он же и решает, что отдавать.
    expect(byKey.get('Cache-Control')).toContain('no-store')
    expect(byKey.get('Content-Type')).toContain('javascript')
  })
})
