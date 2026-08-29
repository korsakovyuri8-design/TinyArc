import { describe, expect, it } from 'vitest'
import { preflight, secret } from './env'

/**
 * Настроенный бой: секреты, база и реквизиты юридического лица.
 *
 * Реквизиты и хранилище входят сюда наравне с секретами не для полноты.
 * Продукт берёт деньги и собирает персональные данные, а оферта без
 * наименования — не договор; файлы на диске контейнера исчезают с выкладкой.
 * Такой бой настроенным не считается.
 */
const CONFIGURED = {
  NODE_ENV: 'production',
  BUREAU_OPS_PASSWORD: 'x',
  BUREAU_SESSION_SECRET: 'y',
  DATABASE_URL: 'postgresql://h/db',
  BUREAU_LEGAL_NAME: 'Bureau d.o.o.',
  BUREAU_LEGAL_REGISTRATION: '50-0000000-000',
  BUREAU_LEGAL_ADDRESS: 'Tivat, Montenegro',
  BUREAU_LEGAL_EMAIL: 'legal@example.com',
  // Диск контейнера в бою не хранилище: он живёт до выкладки.
  BUREAU_STORAGE: 's3',
  BUREAU_S3_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
  BUREAU_S3_BUCKET: 'bureau',
  BUREAU_S3_ACCESS_KEY_ID: 'id',
  BUREAU_S3_SECRET_ACCESS_KEY: 'secret',
}

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
    const problems = preflight({ ...CONFIGURED, BUREAU_MAIL: 'gmail' })

    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('BUREAU_MAIL')
  })

  it('требует настройку провайдера, если почта настоящая', () => {
    const problems = preflight({ ...CONFIGURED, BUREAU_MAIL: 'resend' })

    expect(problems.some((p) => p.includes('RESEND_API_KEY'))).toBe(true)
    expect(problems.some((p) => p.includes('BUREAU_MAIL_FROM'))).toBe(true)
  })

  it('на настроенном бою молчит', () => {
    expect(preflight(CONFIGURED)).toEqual([])
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

describe('хранилище файлов', () => {
  it('в бою не разрешает диск контейнера', () => {
    // Файлы, сложенные на диск контейнера, исчезнут с ближайшей выкладкой — а
    // отдавать комплект заказчику придётся сильно позже неё.
    const problems = preflight({ ...CONFIGURED, BUREAU_STORAGE: 'local' })

    expect(problems.some((p) => p.includes('BUREAU_STORAGE'))).toBe(true)
  })

  it('в разработке диск — нормальный режим', () => {
    expect(preflight({ NODE_ENV: 'development', BUREAU_STORAGE: 'local' })).toEqual([])
  })

  it('требует настройку, если хранилище настоящее', () => {
    const problems = preflight({
      ...CONFIGURED,
      BUREAU_S3_BUCKET: '',
      BUREAU_S3_ACCESS_KEY_ID: '',
    })

    expect(problems.some((p) => p.includes('BUREAU_S3_BUCKET'))).toBe(true)
    expect(problems.some((p) => p.includes('BUREAU_S3_ACCESS_KEY_ID'))).toBe(true)
  })

  it('не пропускает неизвестный режим', () => {
    const problems = preflight({ ...CONFIGURED, BUREAU_STORAGE: 'dropbox' })

    expect(problems.some((p) => p.includes('такого режима нет'))).toBe(true)
  })
})
