import { describe, expect, it } from 'vitest'
import { secretsMatch, sign, unsign } from './signing'

const KEY = 'test-secret'

describe('подпись cookie', () => {
  it('возвращает значение, подписанное тем же секретом', () => {
    expect(unsign(sign('project-123', KEY), KEY)).toBe('project-123')
  })

  it('не принимает значение, подставленное руками', () => {
    // Ровно тот случай, ради которого подпись и нужна: чужой идентификатор,
    // положенный в cookie напрямую.
    expect(unsign('project-123', KEY)).toBeNull()
    expect(unsign('project-123.', KEY)).toBeNull()
    expect(unsign('project-123.подпись', KEY)).toBeNull()
  })

  it('не принимает подпись от другого секрета', () => {
    expect(unsign(sign('project-123', 'другой'), KEY)).toBeNull()
  })

  it('замечает подмену значения при сохранённой подписи', () => {
    const signed = sign('project-123', KEY)
    const tampered = signed.replace('project-123', 'project-999')

    expect(unsign(tampered, KEY)).toBeNull()
  })

  it('переживает точки внутри значения', () => {
    expect(unsign(sign('a.b.c', KEY), KEY)).toBe('a.b.c')
  })

  it('спокойно относится к пустому входу', () => {
    expect(unsign(undefined, KEY)).toBeNull()
    expect(unsign(null, KEY)).toBeNull()
    expect(unsign('', KEY)).toBeNull()
  })
})

describe('сравнение секретов', () => {
  it('сходится только на точном совпадении', () => {
    expect(secretsMatch('пароль', 'пароль')).toBe(true)
    expect(secretsMatch('пароль', 'пароль ')).toBe(false)
    expect(secretsMatch('', 'пароль')).toBe(false)
  })
})
