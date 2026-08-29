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

describe('заголовки безопасности', () => {
  it('стоят на каждом ответе', async () => {
    const rules = await config.headers!()

    expect(rules).toHaveLength(1)
    expect(rules[0].source).toBe('/:path*')

    const keys = rules[0].headers.map((h) => h.key)
    for (const required of REQUIRED) expect(keys).toContain(required)
  })

  it('запрещают встраивание в чужую страницу', async () => {
    const rules = await config.headers!()
    const byKey = new Map(rules[0].headers.map((h) => [h.key, h.value]))

    expect(byKey.get('X-Frame-Options')).toBe('DENY')
    expect(byKey.get('Content-Security-Policy')).toContain("frame-ancestors 'none'")
  })
})
