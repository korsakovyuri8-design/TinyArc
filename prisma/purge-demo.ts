/**
 * Вынос синтетики из боевой базы.
 *
 * Та же чистка, что стоит в начале сида, но без второй половины: сид стирает
 * выдуманное, чтобы тут же положить его заново, а здесь нужно только стереть.
 *
 * Живые записи не трогаются вовсе. Признак выдуманного не «похоже на
 * тестовое», а метка, проставленная при создании: ключ `seed-key-`, бриф
 * `seed-brief-`, подрядчик на домене `@seed-build.invalid`, норма из
 * синтетического источника. Настоящая анкета такой метки не получит никогда,
 * потому что ключи живым выписываются другим префиксом.
 *
 * Запускается руками и печатает, что именно убрал:
 *
 *     npx tsx prisma/purge-demo.ts          — показать, ничего не трогая
 *     npx tsx prisma/purge-demo.ts --delete — убрать
 *
 * Без флага скрипт не удаляет ничего. Это не вежливость: база одна, отката у
 * неё нет, и команда, стирающая записи с первого нажатия, однажды будет
 * набрана не в том окне.
 */

import { PrismaClient } from '../src/generated/prisma/client'
import { adapterFor } from '../src/lib/db-adapter'
import { databaseUrl } from '../src/lib/db-provider'

const SYNTHETIC_SOURCE = 'Synthetic stand data'

const prisma = new PrismaClient({ adapter: adapterFor(databaseUrl()) })

const WHERE = {
  specialist: { accessKey: { startsWith: 'seed-key-' } },
  project: { clientKey: { startsWith: 'seed-brief-' } },
  rule: { document: { startsWith: SYNTHETIC_SOURCE } },
  contractor: { email: { endsWith: '@seed-build.invalid' } },
} as const

async function main() {
  const doDelete = process.argv.includes('--delete')

  const [specialists, projects, rules, contractors] = await Promise.all([
    prisma.specialist.findMany({
      where: WHERE.specialist,
      select: { displayName: true, email: true },
    }),
    prisma.project.findMany({ where: WHERE.project, select: { clientEmail: true } }),
    prisma.complianceRule.count({ where: WHERE.rule }),
    prisma.contractor.count({ where: WHERE.contractor }),
  ])

  /*
   * Живое считается и печатается тоже.
   *
   * Цифра «уберём 24 записи» сама по себе ничего не говорит: страшно не то,
   * сколько уходит, а сколько остаётся. Человек, видящий «останется 1 живая
   * анкета», проверит, та ли это анкета, прежде чем нажать.
   */
  const liveSpecialists = await prisma.specialist.count({
    where: { accessKey: { not: { startsWith: 'seed-key-' } } },
  })
  const liveProjects = await prisma.project.count({
    where: { clientKey: { not: { startsWith: 'seed-brief-' } } },
  })

  console.log('Синтетика в базе:')
  console.log(`  специалистов: ${specialists.length}`)
  for (const s of specialists) console.log(`    ${s.displayName} <${s.email}>`)
  console.log(`  проектов: ${projects.length}`)
  console.log(`  норм: ${rules}`)
  console.log(`  подрядчиков: ${contractors}`)
  console.log('')
  console.log('Останется живого:')
  console.log(`  специалистов: ${liveSpecialists}`)
  console.log(`  проектов: ${liveProjects}`)

  if (!doDelete) {
    console.log('')
    console.log('Ничего не тронуто. Чтобы убрать, добавьте --delete')
    return
  }

  /*
   * Письма о выдуманных убираются первыми, пока есть по чему искать: адреса в
   * журнале отправленных не связаны внешним ключом ни с кем, и после удаления
   * записей найти их будет уже нельзя. Журнал целиком не стирается: на пилоте
   * это список тех, кого бюро зовёт руками.
   */
  const invented = [
    ...specialists.map((s) => s.email),
    ...projects.map((p) => p.clientEmail),
  ]
  if (invented.length > 0) {
    const { count } = await prisma.notification.deleteMany({ where: { email: { in: invented } } })
    console.log(`Писем убрано: ${count}`)
  }

  const removedProjects = await prisma.project.deleteMany({ where: WHERE.project })
  const removedSpecialists = await prisma.specialist.deleteMany({ where: WHERE.specialist })
  const removedRules = await prisma.complianceRule.deleteMany({ where: WHERE.rule })
  const removedContractors = await prisma.contractor.deleteMany({ where: WHERE.contractor })

  console.log('')
  console.log('Убрано:')
  console.log(`  специалистов: ${removedSpecialists.count}`)
  console.log(`  проектов: ${removedProjects.count}`)
  console.log(`  норм: ${removedRules.count}`)
  console.log(`  подрядчиков: ${removedContractors.count}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
