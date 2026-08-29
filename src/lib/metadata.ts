import type { Metadata } from 'next'

/**
 * Заголовок и описание страницы.
 *
 * Одной строкой вместо повторения суффикса на каждой странице: название бюро
 * в заголовке вкладки — это то, что человек видит в списке из двадцати
 * вкладок, и оно должно быть одинаковым везде.
 */
export function pageMetadata(title: string, description?: string): Metadata {
  return {
    title: `${title} — TinyArc Cloud Bureau`,
    ...(description ? { description } : {}),
  }
}
