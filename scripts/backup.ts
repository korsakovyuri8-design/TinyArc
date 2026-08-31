/**
 * Резервная копия базы.
 *
 * Кладётся в то же хранилище, что и материалы проектов: другого места у
 * продукта нет, а диск контейнера живёт до следующей выкладки.
 *
 * Запускается по расписанию хостинга, а не приложением: копия, которую делает
 * сам сервис, останавливается вместе с ним — то есть ровно тогда, когда она
 * нужнее всего.
 *
 * Это не замена копиям провайдера базы. У логической выгрузки нет
 * восстановления на момент времени: потеряно будет всё, что случилось после
 * последней. Она — то, что есть, пока копий провайдера нет.
 */

import 'dotenv/config'
import { gzipSync } from 'node:zlib'
import { prisma } from '../src/lib/db'
import { storage } from '../src/lib/storage'
import { dump } from '../src/lib/services/backup'

/** Имя по времени: сортируется само и не совпадает у двух прогонов подряд. */
function keyFor(now: Date): string {
  const stamp = now.toISOString().replace(/[:.]/g, '-')
  return `backups/bureau-${stamp}.ndjson.gz`
}

/*
 * Тело в функции, а не наверху файла: скрипты здесь собираются как CommonJS,
 * и ожидание на верхнем уровне туда не переводится.
 */
async function main(): Promise<void> {
  const started = Date.now()
  const parts: string[] = []

  for await (const line of dump(prisma)) parts.push(line)

  const text = `${parts.join('\n')}\n`
  const packed = gzipSync(Buffer.from(text, 'utf8'))
  const key = keyFor(new Date())

  await storage().put(key, packed, 'application/gzip')
  await prisma.$disconnect()

  const seconds = ((Date.now() - started) / 1000).toFixed(1)

  console.log(`Копия готова: ${key}`)
  console.log(
    `  строк: ${parts.length - 1}, сжато: ${(packed.byteLength / 1024).toFixed(0)} КБ, ${seconds} с`,
  )
  console.log(`  хранилище: ${storage().mode}`)
  console.log('')
  console.log('Срок хранения задаётся правилом жизненного цикла у самого хранилища:')
  console.log('интерфейс хранилища намеренно узкий и списка файлов не даёт, а чистить')
  console.log('копии тем же кодом, который их пишет, — это удаление копий по ошибке в нём.')
}

main().catch((error) => {
  console.error('Копия не сделана:', error)
  process.exit(1)
})
