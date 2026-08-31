/**
 * Индексы под очереди панели.
 *
 * Проверка по схеме, а не по времени ответа. Замер времени здесь врал бы в обе
 * стороны: на стенде база помещается в память целиком и без индекса, а
 * упавшая проверка на медленной машине означала бы «сегодня занят диск», а не
 * «запрос стал перебором».
 *
 * Что именно меряли, чтобы эти три появились (SQLite, четыреста тысяч писем,
 * две с половиной тысячи счетов):
 *
 *   журнал писем          34 мс → 1 мс, план SCAN + TEMP B-TREE → SCAN USING INDEX
 *   очередь счетов        26 мс → 2 мс, строк 2407 → 20
 *   вопросы заказчиков    перебор всей переписки → поиск по индексу
 *
 * Все три запроса живут на страницах, которые бюро открывает по многу раз в
 * день, и все три перебирали таблицу, растущую всю жизнь бюро: письма не
 * удаляются никогда, счета не удаляются никогда, переписка тоже.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const schema = readFileSync(
  join(import.meta.dirname, '..', '..', 'prisma', 'schema.prisma'),
  'utf8',
)

/** Тело модели: индексы одной модели не должны считаться за индексы другой. */
function model(name: string): string {
  const start = schema.indexOf(`model ${name} {`)
  expect(start, `модели ${name} в схеме нет`).toBeGreaterThan(-1)

  return schema.slice(start, schema.indexOf('\n}', start))
}

describe('индексы под очереди панели', () => {
  it('журнал писем читается по времени отправки', () => {
    expect(model('Notification')).toContain('@@index([sentAt])')
  })

  /*
   * Дата оплаты второй колонкой обязательна: без неё база отбирает по
   * состоянию и сортирует во временном дереве все оплаченные счета за всю
   * историю — то есть ровно то, от чего ставился потолок на их показ.
   */
  it('очередь счетов ищет по состоянию и дате оплаты', () => {
    expect(model('Invoice')).toContain('@@index([status, paidAt])')
  })

  it('вопросы заказчиков ищутся по автору и отметке ответа', () => {
    expect(model('ClientMessage')).toContain('@@index([authorRole, answeredAt])')
  })
})

/**
 * Потолок на показ оплаченных счетов.
 *
 * Неоплаченные показываются все — это работа, и срезанный счёт никто не
 * отметит, потому что его никто не увидит. Оплаченные нужны только как
 * подтверждение только что нажатого, а их число растёт всю жизнь бюро.
 */
describe('очередь счетов ограничена', () => {
  const source = readFileSync(
    join(import.meta.dirname, 'services', 'billing.ts'),
    'utf8',
  )

  it('оплаченные берутся с потолком', () => {
    const queue = source.slice(source.indexOf('export async function invoiceQueue'))

    expect(queue).toContain('take: PAID_SHOWN')
  })

  it('неоплаченные берутся без потолка', () => {
    const queue = source.slice(
      source.indexOf("where: { status: 'issued' }"),
      source.indexOf("where: { status: 'paid' }"),
    )

    expect(queue).not.toContain('take:')
  })
})
