/**
 * Письма: счёт, ожидание подтверждения, открытая задача.
 *
 * Проверяется не текст писем, а то, чего не видно ни модульным тестом, ни
 * глазами: что письмо уходит один раз на повод, что оно уходит той стороне,
 * которой адресовано, и что границу между сторонами оно не пересекает.
 *
 * Последнее — главное. Заказчик и специалист не должны узнавать друг о друге
 * из почты, и проверить это можно только по содержимому отправленного
 * (концепт, п.13).
 *
 * Работает по базе, а не по браузеру: письма уходят из серверных функций, и в
 * интерфейсе их следа нет. Отсюда и .mts вместо .mjs — остальные сценарии
 * гоняет чистый node, а этому нужны типы проекта.
 */

import { prisma } from '../src/lib/db'

function check(condition, message) {
  if (!condition) {
    console.error(`  ✗ ${message}`)
    process.exitCode = 1
    return false
  }
  console.log(`  ✓ ${message}`)
  return true
}

console.log('Уведомления')

const sent = await prisma.notification.findMany()
const byKind = (kind) => sent.filter((n) => n.kind === kind)

check(sent.length > 0, `отправлено писем: ${sent.length}`)

for (const kind of [
  'invoice_issued',
  'stage_awaiting',
  'ticket_open',
  'ticket_revision',
  'client_answer',
  'conflict_resolved',
  'ticket_comment',
  'application_declined',
  'invoice_paid',
]) {
  check(byKind(kind).length > 0, `повод «${kind}» дошёл до письма: ${byKind(kind).length}`)
}

// Один повод — одно письмо. Сторожит уникальный ключ, но проверить надо: гейт
// зовут после каждой приёмки, подтверждения и оплаты.
const keys = sent.map((n) => `${n.kind}:${n.targetId}`)
check(new Set(keys).size === keys.length, 'ни одного повторного письма на один и тот же повод')

/*
 * Адресат письма — та сторона, которой оно про неё.
 *
 * Счёт и ожидание подтверждения уходят заказчику, открытая задача —
 * специалисту. Перепутать их местами значит выдать почту команды заказчику или
 * наоборот, а это ровно та утечка, от которой продукт защищается поимённой
 * выборкой полей.
 */
const clientEmails = new Set(
  (await prisma.project.findMany({ select: { clientEmail: true } })).map((p) => p.clientEmail),
)
const specialistEmails = new Set(
  (await prisma.specialist.findMany({ select: { email: true } })).map((s) => s.email),
)

const clientKinds = ['invoice_issued', 'stage_awaiting', 'client_answer', 'invoice_paid']
const misdirected = sent.filter((n) =>
  clientKinds.includes(n.kind) ? !clientEmails.has(n.email) : !specialistEmails.has(n.email),
)

check(
  misdirected.length === 0,
  misdirected.length === 0
    ? 'каждое письмо ушло своей стороне'
    : `не той стороне: ${misdirected.map((n) => `${n.kind}→${n.email}`).join(', ')}`,
)

check(
  byKind('ticket_open').every((n) => !clientEmails.has(n.email)),
  'письмо о задаче не уходит заказчику',
)
check(
  [...byKind('invoice_issued'), ...byKind('stage_awaiting')].every(
    (n) => !specialistEmails.has(n.email),
  ),
  'письмо о счёте не уходит специалисту',
)

await prisma.$disconnect()
console.log(process.exitCode ? '\nЕсть расхождения.' : '\nВсё сошлось.')
