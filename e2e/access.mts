/**
 * Доступ к подрядчикам продаётся заказчику (п.14б).
 *
 * Движок отбора и панель бюро существовали давно, а продукта не было: короткий
 * список видело только бюро, а заказчик, который по замыслу за него платит, не
 * видел ни списка, ни цены. Услуга, названная в концепте платной, деньгами не
 * была.
 *
 * Дорогое здесь — границы, а не кнопка. Их три, и каждую легко потерять:
 * неоплаченный доступ не должен останавливать работу; список не должен
 * открываться до отметки об оплате; и ответственность за стройку бюро не берёт
 * — это сказано в продукте, а не только в оферте.
 *
 * Сценарий заводит свой проект и в конце его убирает.
 */

import { existsSync } from 'node:fs'
import { chromium } from 'playwright'
import { prisma } from '../src/lib/db'
import { accessFor, accessOpen, markAccessPaid, quote, requestAccess } from '../src/lib/services/build-access'

const BASE = process.env.E2E_BASE ?? 'http://127.0.0.1:3100'
const EXECUTABLE = process.env.E2E_CHROMIUM ?? '/opt/pw-browsers/chromium'

function check(condition: unknown, message: string) {
  if (!condition) {
    console.error(`  ✗ ${message}`)
    process.exitCode = 1
    return false
  }
  console.log(`  ✓ ${message}`)
  return true
}

console.log('Доступ к подрядчикам')

const stamp = Date.now()
const key = `access-${stamp}`

await prisma.project.deleteMany({ where: { clientEmail: { contains: '@access.invalid' } } })

const project = await prisma.project.create({
  data: {
    clientKey: key,
    title: 'Проверка доступа к подрядчикам',
    clientName: 'e2e',
    clientEmail: `${key}@access.invalid`,
    typology: 'villa',
    storeys: 2,
    areaSqm: 240,
    jurisdiction: 'ME',
    climateZone: 'mediterranean',
    materialSystem: 'concrete',
    terrain: 'slope',
    gridConnection: 'grid',
    status: 'delivering',
  },
})

/** Цена считается из числа работ, и разбор к ней прилагается. */
{
  const offer = quote(project)

  check(offer.amount > 0, `цена названа: ${offer.amount} ${offer.currency}`)
  check(offer.trades > 0, `число работ посчитано: ${offer.trades}`)
  check(
    offer.amount === Math.round((offer.base + offer.perTrade * offer.trades) * offer.jurisdictionFactor),
    'сумма сходится с собственным разбором',
  )

  /*
   * Цена не из площади. Площадь уже оплачена комплектом; здесь бюро делает
   * другое — прогоняет отбор и собирает список по каждой работе.
   */
  const bigger = quote({ ...project, areaSqm: 900 })
  check(
    bigger.trades === offer.trades ? bigger.amount === offer.amount : true,
    'при том же наборе работ площадь цену не двигает',
  )
}

/** До оплаты список закрыт, и это единственное, что закрыто. */
{
  check(!(await accessOpen(project.id)), 'без просьбы доступа нет')

  const issued = await requestAccess(project)
  check(issued.status === 'issued', 'просьба выставляет счёт, а не открывает список')
  check(!(await accessOpen(project.id)), 'выставленный счёт список не открывает')

  // Повторная просьба не выставляет второй счёт: на проект он один.
  const again = await requestAccess(project)
  check(again.id === issued.id, 'повторная просьба не заводит второй счёт')

  const stored = await accessFor(project.id)
  check(stored?.basis?.trades === issued.basis?.trades, 'разбор сохранён вместе с суммой')
}

const browser = await chromium.launch(existsSync(EXECUTABLE) ? { executablePath: EXECUTABLE } : {})

async function cabinet() {
  const page = await (await browser.newContext()).newPage()
  await page.goto(`${BASE}/enter`)
  await page.fill('input[name=key]', key)
  await page.click('button[type=submit]')
  await page.waitForURL(`${BASE}/project**`, { timeout: 15_000 })
  // Регистр приводится намеренно: метки набираются прописными стилями.
  const text = (await page.locator('body').innerText()).toLowerCase()
  await page.context().close()
  return text
}

/** Кабинет до оплаты: цена, разбор, куда платить — и ни одного имени. */
{
  const text = await cabinet()

  check(text.includes('who will build it'), 'предложение есть в кабинете')
  check(text.includes('where to pay') || text.includes('payment details have not been published'), 'сказано, как платить')
  check(
    text.includes('the list opens once the bureau sees the money arrive'),
    'сказано, что приёма платежей нет и список откроет отметка бюро',
  )
  /*
   * Ищется фраза, которая есть только в оплаченной ветке. Первая редакция
   * искала «passed the gates» — и находила её в блоке про команду
   * специалистов, где она стоит по своему делу: проверка падала на том, что
   * работает, и мешала два разных отбора в один.
   */
  check(
    !text.includes('selected the same way your design team was'),
    'до оплаты короткий список подрядчиков не показан',
  )
  check(
    !text.includes('you sign the works contract with them yourself'),
    'до оплаты не показан и разговор про договор со стройкой',
  )
}

/** После отметки: список, арифметика и названная граница ответственности. */
{
  await markAccessPaid(project.id, 'e2e')
  check(await accessOpen(project.id), 'отметка бюро открывает список')

  const text = await cabinet()

  check(text.includes('passed the gates'), 'после оплаты показано, сколько прошло гейты')
  check(
    text.includes('selected the same way your design team was'),
    'сказано, что отбор тот же самый, — на этом стоит доверие к обоим',
  )
  check(
    text.includes('you sign the works contract with them yourself'),
    'граница ответственности названа в продукте, а не только в оферте',
  )
  check(
    text.includes('quantities come with the construction documentation'),
    'объёмов нет, и сказано почему',
  )

  /*
   * Повтор проходит молча и не переписывает дату: та же форма перехода, что у
   * счёта за стадию. Дата поступления — факт, а не последнее нажатие.
   */
  const first = (await accessFor(project.id))!.paidAt
  await markAccessPaid(project.id, 'второй раз')
  const second = (await accessFor(project.id))!.paidAt
  check(first?.getTime() === second?.getTime(), 'повторная отметка не переписывает дату')
}

/** Работа от неоплаченного доступа не зависит: гейт стоит на списке. */
{
  const gates = await prisma.ticket.count({ where: { projectId: project.id } })
  check(gates === 0, 'доступ к подрядчикам задач не заводит и не отменяет')
}

await browser.close()

await prisma.project.delete({ where: { id: project.id } })
await prisma.$disconnect()

console.log(process.exitCode ? '\nЕсть расхождения.' : '\nВсё сошлось.')
