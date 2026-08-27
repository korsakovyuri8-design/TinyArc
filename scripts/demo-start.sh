#!/bin/sh
# Запуск демонстрационного стенда: то же, что боевой, плюс синтетический пул.
#
# Витрина без пула бесполезна, но упавший сид не должен ронять выкладку:
# причина останется в логе выше.
set -e

npx tsx scripts/preflight.ts
npx prisma migrate deploy

npx tsx prisma/seed.ts || echo 'Сид не отработал, смотрите строки выше.'

exec npx next start
