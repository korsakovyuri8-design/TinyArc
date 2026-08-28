import { describe, expect, it } from 'vitest'
import { preflight, secret } from './env'

describe('секреты окружения', () => {
  it('в разработке подставляет значение по умолчанию', () => {
    expect(secret('BUREAU_OPS_PASSWORD', { NODE_ENV: 'development' })).toBe('bureau-ops')
  })

  it('в бою падает, а не подставляет опубликованный пароль', () => {
    expect(() => secret('BUREAU_OPS_PASSWORD', { NODE_ENV: 'production' })).toThrow(
      /обязательная переменная/,
    )
  })

  it('берёт заданное значение в любом окружении', () => {
    expect(
      secret('BUREAU_OPS_PASSWORD', { NODE_ENV: 'production', BUREAU_OPS_PASSWORD: '  свой  ' }),
    ).toBe('свой')
  })

  it('preflight собирает все проблемы боевого окружения разом', () => {
    const problems = preflight({ NODE_ENV: 'production' })

    expect(problems.some((p) => p.includes('BUREAU_OPS_PASSWORD'))).toBe(true)
    expect(problems.some((p) => p.includes('BUREAU_SESSION_SECRET'))).toBe(true)
    expect(problems.some((p) => p.includes('DATABASE_URL'))).toBe(true)
  })

  it('не пропускает неизвестный режим почты', () => {
    const problems = preflight({
      NODE_ENV: 'production',
      BUREAU_OPS_PASSWORD: 'x',
      BUREAU_SESSION_SECRET: 'y',
      DATABASE_URL: 'postgresql://h/db',
      BUREAU_MAIL: 'gmail',
    })

    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('BUREAU_MAIL')
  })

  it('требует настройку провайдера, если почта настоящая', () => {
    const problems = preflight({
      NODE_ENV: 'production',
      BUREAU_OPS_PASSWORD: 'x',
      BUREAU_SESSION_SECRET: 'y',
      DATABASE_URL: 'postgresql://h/db',
      BUREAU_MAIL: 'resend',
    })

    expect(problems.some((p) => p.includes('RESEND_API_KEY'))).toBe(true)
    expect(problems.some((p) => p.includes('BUREAU_MAIL_FROM'))).toBe(true)
  })

  it('на настроенном бою молчит', () => {
    expect(
      preflight({
        NODE_ENV: 'production',
        BUREAU_OPS_PASSWORD: 'x',
        BUREAU_SESSION_SECRET: 'y',
        DATABASE_URL: 'postgresql://h/db',
      }),
    ).toEqual([])
  })
})

describe('адрес продукта в окружении', () => {
  it('молчит, когда переменной нет: адрес по умолчанию канонический', () => {
    expect(preflight({ NODE_ENV: 'test' })).toEqual([])
  })

  it('ловит строку, которая не адрес', () => {
    const problems = preflight({ NODE_ENV: 'test', BUREAU_PUBLIC_URL: 'tinyarc.korsakovgroup.com' })

    expect(problems.join(' ')).toContain('это не адрес')
  })

  it('не пускает http вне localhost: по этому адресу ходят ключи доступа', () => {
    const problems = preflight({ NODE_ENV: 'test', BUREAU_PUBLIC_URL: 'http://tinyarc.korsakovgroup.com' })

    expect(problems.join(' ')).toContain('https')
  })

  it('на localhost http допустим', () => {
    expect(preflight({ NODE_ENV: 'test', BUREAU_PUBLIC_URL: 'http://localhost:3000' })).toEqual([])
  })
})
