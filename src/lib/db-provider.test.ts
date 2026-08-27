import { describe, expect, it } from 'vitest'
import { DEV_DATABASE_URL, databaseUrl, providerFor, redact } from './db-provider'

describe('выбор базы', () => {
  it('узнаёт провайдера по строке подключения', () => {
    expect(providerFor('file:./bureau.db')).toBe('sqlite')
    expect(providerFor('postgresql://u:p@host/db')).toBe('postgresql')
    expect(providerFor('postgres://u:p@host/db')).toBe('postgresql')
  })

  it('падает, а не откатывается на SQLite молча', () => {
    expect(() => providerFor('mysql://u:p@host/db')).toThrow()
  })

  it('не показывает пароль в сообщении об ошибке', () => {
    expect(redact('postgresql://user:hunter2@host/db')).toBe('postgresql://user:***@host/db')
    expect(() => providerFor('mysql://user:hunter2@host/db')).toThrow(/\*\*\*/)
  })

  it('без переменной берёт базу разработки', () => {
    expect(databaseUrl({})).toBe(DEV_DATABASE_URL)
    expect(databaseUrl({ DATABASE_URL: '  postgresql://h/db  ' })).toBe('postgresql://h/db')
  })
})
