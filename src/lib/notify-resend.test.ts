/**
 * Повторить можно любой повод.
 *
 * Повторная отправка разбирает повод по ключу: у каждого свой способ достать,
 * кому и о чём писать — у одних это идентификатор счёта, у других пара
 * «проект и стадия», у третьих идентификатор реплики. Пропущенный в разборе
 * повод молчит: письмо не уходит, кнопка отвечает «некому», и выглядит это
 * как «человека больше нет», а не как «мы забыли про этот случай».
 *
 * Поэтому проверка структурная — по исходнику. Поведением её не заменить:
 * чтобы дойти до каждого повода, нужен стенд с десятью разными состояниями,
 * а не пройденный повод в таком сценарии выглядит как пропущенная проверка.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(import.meta.dirname, 'services', 'notify.ts'), 'utf8')

/** Поводы берутся из самого типа, а не переписываются сюда списком. */
function kinds(): string[] {
  const start = source.indexOf('type Kind =')
  expect(start, 'типа Kind в модуле больше нет').toBeGreaterThan(-1)

  const declaration = source.slice(start, source.indexOf('\n\n', start))

  return [...declaration.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!)
}

const resend = source.slice(source.indexOf('export async function resend'))

describe('повторная отправка', () => {
  it('знает все десять поводов', () => {
    expect(kinds()).toHaveLength(10)
  })

  for (const kind of kinds()) {
    it(`разбирает повод «${kind}»`, () => {
      expect(resend).toContain(`case '${kind}'`)
    })
  }
})

/**
 * Запись об отправке не удаляется.
 *
 * Удаление было прежним поведением, и оно стирало след: в журнале письма нет,
 * будто повода не было. Проверка сторожит именно отсутствие удаления —
 * вернуть его обратно легко, а заметить возврат нечем: всё остальное при этом
 * работает, и только человек, которого не позвали, остаётся не позванным.
 */
describe('след отправки', () => {
  it('неудача не стирает запись', () => {
    const once = source.slice(source.indexOf('async function once('), source.indexOf('\nexport function deliveryNote'))

    expect(once).not.toContain('notification.delete')
    expect(once).toContain("status: 'failed'")
  })
})
