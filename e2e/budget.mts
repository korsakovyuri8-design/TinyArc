/**
 * Ставку называет специалист, бюджет проекта — гейт, а не балл.
 *
 * Дорогое здесь — не «дешёвого отсеяло», а то, что дешёвый не поднялся. Если
 * цена войдёт в балл, назвавший меньше обойдёт сильного, то есть купит место
 * скидкой: то же самое, что проданная позиция у подрядчиков, только с другой
 * стороны, и убивает оно то же самое — доверие к тому, что отбор считается по
 * фактам.
 *
 * Второе: пока доля не задана, гейта не существует вовсе. Умолчание здесь
 * начало бы отсеивать людей по числу, которого бюро не называло.
 *
 * Сценарий заводит свою долю и свои ставки, а в конце снимает и то и другое:
 * оставленная доля меняет каждую следующую сборку на стенде.
 */

import { assemble } from '../src/engine/assemble'
import type { TeamBudget } from '../src/engine/types'
import { prisma } from '../src/lib/db'
import { activePool } from '../src/lib/services/matching'
import { costTable } from '../src/lib/services/payouts'
import { clearTeamShare, setTeamShare, teamShare } from '../src/lib/services/settings'
import { toRequirements } from '../src/lib/rows'
import { DOC_STAGES, DOC_STAGE_ORDER, type DocStage } from '../src/engine/taxonomy'

function check(condition: unknown, message: string) {
  if (!condition) {
    console.error(`  ✗ ${message}`)
    process.exitCode = 1
    return false
  }
  console.log(`  ✓ ${message}`)
  return true
}

console.log('Бюджет на команду')

const before = await teamShare()
check(before === null, 'на чистом стенде доля не задана, и гейта нет')

const project = await prisma.project.findFirstOrThrow({
  where: { status: { in: ['assembled', 'delivering'] } },
  orderBy: { createdAt: 'asc' },
})

const pool = await activePool()
const requirements = toRequirements(project)

check(pool.length > 0, `пул не пуст: ${pool.length}`)

/** Без потолка: то, с чем сравнивается всё остальное. */
const free = assemble(pool, requirements)
check(free.outcome === 'ok', `без потолка состав собирается: ${free.outcome}`)
check(free.teamCost === null, 'без потолка стоимость не считается вовсе')

const budget = (total: number, costs: Map<string, number>): TeamBudget => ({ total, costOf: costs })

/** Щедрый потолок ничего не меняет — ни состава, ни порядка. */
{
  const costs = new Map(pool.flatMap((s) => s.disciplines.map((d) => [`${s.id}:${d}`, 10])))
  const generous = assemble(pool, requirements, new Map(), budget(1_000_000, costs))

  check(generous.outcome === 'ok', 'щедрый потолок состав не ломает')
  check(
    generous.team.map((m) => m.specialist.id).join() === free.team.map((m) => m.specialist.id).join(),
    'при щедром потолке состав тот же самый, что без него',
  )
  check(generous.teamCost === generous.team.length * 10, 'стоимость состава посчитана')
}

/**
 * Главная проверка: дешёвый не обходит сильного.
 *
 * Лучшему по баллу назначается цена вдвое выше всех остальных, и потолок
 * ставится заведомо достаточным для любого состава. Если бы цена входила в
 * балл, он бы уступил место дешёвому; она гейт — и он остаётся.
 */
{
  const leader = free.team[0]
  if (!leader) throw new Error('состав пуст — сравнивать нечего')

  const costs = new Map(pool.flatMap((s) => s.disciplines.map((d) => [`${s.id}:${d}`, 10])))
  costs.set(`${leader.specialist.id}:${leader.discipline}`, 40)

  const priced = assemble(pool, requirements, new Map(), budget(1_000_000, costs))

  check(
    priced.team.some((m) => m.specialist.id === leader.specialist.id),
    'самый дорогой остался в составе: цена не двигает место',
  )
}

/** Тесный потолок отделяет «дорого» от «людей нет». */
{
  const costs = new Map(pool.flatMap((s) => s.disciplines.map((d) => [`${s.id}:${d}`, 100_000])))
  const tight = assemble(pool, requirements, new Map(), budget(1, costs))

  check(tight.outcome === 'over_budget', `тесный потолок даёт «дорого»: ${tight.outcome}`)
  check(tight.team.length === 0, 'состав при этом не выдаётся')

  const empty = assemble([], requirements, new Map(), budget(1, costs))
  check(empty.outcome === 'incomplete', 'на пустом пуле причина другая — людей нет')
}

/** Цена собирается из своей ставки, а умолчание бюро — только запасное. */
{
  const person = pool[0]!
  const discipline = person.disciplines[0]!
  const stage = project.targetStage as DocStage

  /*
   * Ставки заводятся на все стадии до целевой, а не на одну. Команда
   * собирается один раз на весь комплект, и платить ей придётся за каждую
   * стадию: цена, посчитанная по последней, — это заниженная цена.
   *
   * Первая редакция сценария задавала одну стадию и ждала известной цены. Она
   * была неправа, а не код: цена вернулась неизвестной, и это правильный
   * ответ.
   */
  const upTo = DOC_STAGES.filter((s) => DOC_STAGE_ORDER[s] <= DOC_STAGE_ORDER[stage])

  for (const each of upTo) {
    await prisma.payoutRate.upsert({
      where: { discipline_stage: { discipline, stage: each } },
      create: { discipline, stage: each, amount: 500 },
      update: { amount: 500 },
    })
  }

  const byBureau = await costTable([person.id], stage)
  check(
    byBureau.get(`${person.id}:${discipline}`) === upTo.length * 500,
    `без своей ставки цена складывается из ставок бюро по всем стадиям: ${byBureau.get(`${person.id}:${discipline}`)}`,
  )

  await prisma.specialistRate.upsert({
    where: { specialistId_discipline_stage: { specialistId: person.id, discipline, stage } },
    create: { specialistId: person.id, discipline, stage, amount: 700 },
    update: { amount: 700 },
  })

  const byPerson = await costTable([person.id], stage)
  const own = byPerson.get(`${person.id}:${discipline}`)
  const bureau = byBureau.get(`${person.id}:${discipline}`)

  check(own !== undefined && bureau !== undefined && own > bureau, 'своя ставка перекрывает ставку бюро')

  /*
   * Неоценённая стадия делает цену человека неизвестной целиком. Записать её
   * как сумму известных стадий значило бы занизить: потолок соблюли бы, а
   * денег бы не хватило.
   */
  const beyond = await costTable([person.id], 'construction')
  check(
    DOC_STAGE_ORDER[stage] === DOC_STAGE_ORDER.construction ||
      beyond.get(`${person.id}:${discipline}`) === undefined,
    'при неоценённой стадии цена человека неизвестна целиком, а не занижена',
  )

  await prisma.specialistRate.deleteMany({ where: { specialistId: person.id } })
  await prisma.payoutRate.deleteMany({ where: { discipline } })
}

/** Доля бюро включает и выключает гейт. */
{
  await setTeamShare(0.5)
  check((await teamShare()) === 0.5, 'доля записана')

  let refused = false
  try {
    await setTeamShare(0)
  } catch {
    refused = true
  }
  check(refused, 'нулевая доля отвергается: она остановила бы каждую сборку')

  await clearTeamShare()
  check((await teamShare()) === null, 'снятая доля выключает гейт целиком')
}

await prisma.$disconnect()

console.log(process.exitCode ? '\nЕсть расхождения.' : '\nВсё сошлось.')
