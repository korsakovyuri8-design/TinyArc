/**
 * Секреты окружения.
 *
 * Правило одно: в бою недостающий секрет роняет приложение, а не подменяется
 * значением по умолчанию. Значение по умолчанию, напечатанное в README, — это
 * не значение по умолчанию, это опубликованный пароль.
 *
 * В разработке подстановка допустима и намеренно шумная: она видна в коде и
 * работает только пока NODE_ENV не production.
 */

const DEV_FALLBACKS: Record<string, string> = {
  BUREAU_OPS_PASSWORD: 'bureau-ops',
  // Подпись cookie. В разработке она защищает ровно от того же, от чего в бою,
  // но секрет одинаков у всех — поэтому в бою он обязателен.
  BUREAU_SESSION_SECRET: 'bureau-dev-secret-not-for-production',
}

export function isProduction(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV === 'production'
}

export function secret(
  name: keyof typeof DEV_FALLBACKS,
  env: Record<string, string | undefined> = process.env,
): string {
  const value = env[name]?.trim()
  if (value) return value

  if (isProduction(env)) {
    throw new Error(
      `${name} не задан. В боевом окружении это обязательная переменная: значение по умолчанию лежит в открытом репозитории и паролем не является.`,
    )
  }

  return DEV_FALLBACKS[name]
}

/**
 * Проверка окружения перед стартом.
 *
 * Вызывается скриптом запуска, чтобы приложение падало на выкладке, а не на
 * первом человеке, который открыл панель.
 */
export function preflight(env: Record<string, string | undefined> = process.env): string[] {
  const problems: string[] = []

  for (const name of Object.keys(DEV_FALLBACKS) as (keyof typeof DEV_FALLBACKS)[]) {
    try {
      secret(name, env)
    } catch (error) {
      problems.push(error instanceof Error ? error.message : String(error))
    }
  }

  if (isProduction(env) && !env.DATABASE_URL?.trim()) {
    problems.push('DATABASE_URL не задан: в бою база разработки недопустима.')
  }

  // Адрес продукта: по умолчанию канонический, но если его переопределили —
  // значение должно быть разбираемым. Кривой BUREAU_PUBLIC_URL уронил бы
  // приложение при первом же рендере страницы, а не на выкладке.
  const publicUrl = env.BUREAU_PUBLIC_URL?.trim()
  if (publicUrl) {
    try {
      const parsed = new URL(publicUrl)
      if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') {
        problems.push(
          `BUREAU_PUBLIC_URL="${publicUrl}": вне localhost адрес продукта обязан быть https — по нему ходят ключи доступа.`,
        )
      }
    } catch {
      problems.push(`BUREAU_PUBLIC_URL="${publicUrl}": это не адрес. Ожидается схема и хост целиком.`)
    }
  }

  const mail = env.BUREAU_MAIL ?? 'stub'
  if (mail !== 'stub' && mail !== 'resend') {
    problems.push(`BUREAU_MAIL="${mail}": такого режима нет. Доступны "stub" и "resend".`)
  }

  if (mail === 'resend') {
    if (!env.RESEND_API_KEY?.trim()) problems.push('BUREAU_MAIL="resend": не задан RESEND_API_KEY.')
    if (!env.BUREAU_MAIL_FROM?.trim()) problems.push('BUREAU_MAIL="resend": не задан BUREAU_MAIL_FROM.')
  }

  const pictures = env.BUREAU_IMAGES ?? 'stub'
  if (pictures !== 'stub' && pictures !== 'openai') {
    problems.push(`BUREAU_IMAGES="${pictures}": такого режима нет. Доступны "stub" и "openai".`)
  }

  if (pictures === 'openai' && !env.OPENAI_API_KEY?.trim()) {
    problems.push('BUREAU_IMAGES="openai": не задан OPENAI_API_KEY.')
  }

  /*
   * Реквизиты юридического лица.
   *
   * В бою это не придирка. Продукт берёт деньги и собирает персональные данные;
   * оферта без наименования и регистрационного номера — это не договор, а
   * политика обработки без адреса для обращений не даёт человеку сделать
   * ровно то, на что у него есть право. В разработке пусто и нормально.
   */
  if (isProduction(env)) {
    const required = {
      BUREAU_LEGAL_NAME: 'наименование юридического лица',
      BUREAU_LEGAL_REGISTRATION: 'регистрационный номер',
      BUREAU_LEGAL_ADDRESS: 'юридический адрес',
      BUREAU_LEGAL_EMAIL: 'адрес для правовых обращений и вопросов по данным',
    }

    for (const [name, what] of Object.entries(required)) {
      if (!env[name]?.trim()) {
        problems.push(`${name} не задан: без этого оферта и политика обработки неполны (${what}).`)
      }
    }
  }

  const store = env.BUREAU_STORAGE ?? 'local'
  if (store !== 'local' && store !== 's3') {
    problems.push(`BUREAU_STORAGE="${store}": такого режима нет. Доступны "local" и "s3".`)
  }

  /*
   * Диск контейнера в бою — не хранилище.
   *
   * На Render и любом контейнерном хостинге он живёт до следующей выкладки.
   * Файлы, сложенные туда, исчезнут вместе с ним — а обещание «материалы
   * передаются заказчику в полном объёме» (п.13) придётся исполнять именно
   * после того, как выкладок было много.
   */
  if (store === 'local' && isProduction(env)) {
    problems.push(
      'BUREAU_STORAGE="local" в бою: диск контейнера живёт до выкладки, и материалы проекта исчезнут вместе с ним. Нужен "s3".',
    )
  }

  if (store === 's3') {
    for (const name of [
      'BUREAU_S3_ENDPOINT',
      'BUREAU_S3_BUCKET',
      'BUREAU_S3_ACCESS_KEY_ID',
      'BUREAU_S3_SECRET_ACCESS_KEY',
    ]) {
      if (!env[name]?.trim()) problems.push(`BUREAU_STORAGE="s3": не задан ${name}.`)
    }
  }

  const assist = env.BUREAU_ASSIST ?? 'stub'
  if (assist !== 'stub' && assist !== 'anthropic') {
    problems.push(`BUREAU_ASSIST="${assist}": такого режима нет. Доступны "stub" и "anthropic".`)
  }

  if (assist === 'anthropic' && !env.ANTHROPIC_API_KEY?.trim() && !env.ANTHROPIC_AUTH_TOKEN?.trim()) {
    problems.push(
      'BUREAU_ASSIST="anthropic": не задан ни ANTHROPIC_API_KEY, ни ANTHROPIC_AUTH_TOKEN.',
    )
  }

  return problems
}
