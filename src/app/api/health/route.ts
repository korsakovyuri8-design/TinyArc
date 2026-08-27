import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * Проверка живости для хостинга и балансировщика.
 *
 * Наружу уходит только «да» или «нет»: ни версии, ни имени базы, ни текста
 * ошибки. Незалогиненный запрос не должен узнавать о системе ничего сверх того,
 * что она работает.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return Response.json({ ok: true }, { headers: { 'cache-control': 'no-store' } })
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { 'cache-control': 'no-store' } })
  }
}
