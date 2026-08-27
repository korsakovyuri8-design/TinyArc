/**
 * Проверка окружения перед запуском.
 *
 * Нужна ровно из-за режима отказа. Недостающий секрет и так роняет запрос, но
 * происходит это на первом человеке, который открыл страницу: сайт поднялся,
 * выглядит живым и отдаёт 500. Здесь то же самое обнаруживается на выкладке —
 * до того, как адрес кому-то отправили.
 */

import 'dotenv/config'
import { preflight } from '../src/lib/env'

const problems = preflight()

if (problems.length > 0) {
  console.error('Окружение не настроено, запуск отменён:\n')
  for (const problem of problems) console.error(`  · ${problem}`)
  console.error('')
  process.exit(1)
}
