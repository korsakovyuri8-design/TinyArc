/**
 * Канонический адрес продукта.
 *
 * Bureau живёт на поддомене группы: tinyarc.korsakovgroup.com. Адрес — не
 * настройка вкуса, а часть продукта: по нему заказчик возвращается в кабинет,
 * специалист — на доску работ, и он же уходит в письма и в разметку страниц.
 *
 * Значение по умолчанию прописано здесь намеренно. Секретом оно не является, а
 * подстановка «localhost, если не задано» однажды уедет в письмо, отправленное
 * из боевого окружения. Переменная BUREAU_PUBLIC_URL нужна там, где адрес
 * другой: превью-стенд, репетиция выкладки, локальная проверка почты.
 */

const CANONICAL = 'https://tinyarc.korsakovgroup.com'

export function siteUrl(env: Record<string, string | undefined> = process.env): string {
  const configured = env.BUREAU_PUBLIC_URL?.trim()
  if (!configured) return CANONICAL

  // Хвостовой слэш ломает склейку путей и делает канонические ссылки разными
  // для одной и той же страницы.
  return configured.replace(/\/+$/, '')
}

/** Абсолютная ссылка на страницу продукта. Путь передаётся от корня. */
export function absolute(path: string, env?: Record<string, string | undefined>): string {
  return `${siteUrl(env)}${path.startsWith('/') ? path : `/${path}`}`
}
