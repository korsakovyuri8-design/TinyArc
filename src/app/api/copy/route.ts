import { copyForClient, copyForSpecialist, NotErasable } from '@/lib/services/privacy'
import { isOperator } from '@/lib/session'

export const dynamic = 'force-dynamic'

/**
 * Копия данных одного человека — файлом.
 *
 * Отдаёт бюро, а не сам человек, и это не недоверие к нему. Право на копию
 * исполняется по обращению, обращение приходит почтой, и отвечает на него тот,
 * кто может убедиться, что просит именно тот, чьи это данные. Кнопка «скачать
 * всё о себе» в кабинете, открытом по ключу из письма, отдавала бы копию
 * всякому, к кому это письмо попало.
 *
 * Состав копии считает служба (`privacy.ts`), и граница проведена там: чужого
 * в ней нет. Здесь только доступ и форма файла.
 *
 * Ответ не кэшируется и не индексируется — это персональные данные, а не
 * страница.
 */
export async function GET(request: Request): Promise<Response> {
  if (!(await isOperator())) {
    return Response.json({ error: 'The bureau panel is closed.' }, { status: 403 })
  }

  const url = new URL(request.url)
  const subject = url.searchParams.get('subject')
  const id = url.searchParams.get('id')?.trim()

  if (!id || (subject !== 'specialist' && subject !== 'client')) {
    return Response.json(
      { error: 'Ask for subject=specialist or subject=client, and an id.' },
      { status: 400 },
    )
  }

  try {
    const copy = subject === 'specialist' ? await copyForSpecialist(id) : await copyForClient(id)

    /*
     * Имя файла без имени человека и без идентификатора.
     *
     * Файл уходит почтой и лежит в чужой папке «Загрузки»; имя, называющее
     * человека, — это те же персональные данные, только вынесенные туда, где
     * их видно, не открывая.
     */
    const name = `bureau-data-copy-${copy.subject}-${copy.generatedAt.slice(0, 10)}.json`

    return new Response(JSON.stringify(copy, null, 2), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="${name}"`,
        'cache-control': 'no-store',
        'x-robots-tag': 'noindex, nofollow',
      },
    })
  } catch (error) {
    if (error instanceof NotErasable) {
      return Response.json({ error: error.message }, { status: 404 })
    }

    console.error('Копия данных не собралась:', error)
    return Response.json({ error: 'The copy could not be assembled.' }, { status: 500 })
  }
}
