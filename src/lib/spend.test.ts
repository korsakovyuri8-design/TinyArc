/**
 * Всё, что стоит денег наружу, ограничено по частоте.
 *
 * Ограничитель стоял только на публичных формах, и это выглядело достаточным:
 * там чужак, здесь свои. Но пределы на формах защищают базу, а эти действия
 * тратят не базу, а деньги — обращение к внешней модели, у которой есть счёт.
 * Цена запроса для того, кто его шлёт, при этом нулевая: специалист, залипший
 * на кнопке генерации, платит нулём, платим мы.
 *
 * Проверяется структурно, по исходнику, а не поведением. Поведение здесь
 * проверить нечем: внешнюю модель на стенде подменяет заглушка, и сценарий,
 * который «сгенерировал изображение», не отличит бесплатный вызов от платного.
 * А появится действие такое же — с новым помощником, с новым генератором, —
 * оно появится без предела ровно потому, что про предел никто не вспомнит.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ACTIONS = [
  'src/app/work/actions.ts',
  'src/app/ops/actions.ts',
  'src/app/brief/actions.ts',
  'src/app/project/actions.ts',
  'src/app/project/direction/actions.ts',
  'src/app/specialists/apply/actions.ts',
  'src/app/enter/actions.ts',
  'src/app/work/profile/actions.ts',
  'src/app/work/profile/complete/actions.ts',
  'src/app/ops/pool/[specialistId]/actions.ts',
]

/** Признаки обращения к внешней модели — по имени слоя, а не по провайдеру. */
const SPENDS = ['assistant(', 'generateRender(', 'images(', 'prepareDirections(']

/** Тела экспортированных функций файла: имя → исходник. */
function functions(source: string): Map<string, string> {
  const result = new Map<string, string>()
  const parts = source.split(/\nexport async function /)

  for (const part of parts.slice(1)) {
    const name = part.split('(')[0]!
    result.set(name, part)
  }

  return result
}

describe('расход наружу ограничен', () => {
  const spending: string[] = []

  for (const path of ACTIONS) {
    const source = readFileSync(join(process.cwd(), path), 'utf8')

    for (const [name, body] of functions(source)) {
      if (!SPENDS.some((mark) => body.includes(mark))) continue

      spending.push(`${path}:${name}`)

      it(`${name} спрашивает ограничитель`, () => {
        expect(body).toMatch(/allow\('/)
      })
    }
  }

  /*
   * Список не должен опустеть от переименования: проверка, которой нечего
   * проверять, зелёная всегда.
   */
  it('находит действия, которые тратят наружу', () => {
    expect(spending.length).toBeGreaterThanOrEqual(6)
  })
})
