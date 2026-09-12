/**
 * Знак нарисован из одного источника.
 *
 * Написано по факту ошибки, сделанной при первой же установке знака: числа
 * полосы реза в шапке были набраны руками и разошлись со значком на
 * шестнадцать единиц. На глаз это незаметно ровно до того дня, когда знак
 * поставят рядом с самим собой — на визитке, в презентации, в письме.
 *
 * Поэтому проверка структурная, по исходникам: она требует, чтобы места, где
 * знак рисуется, брали координаты из модуля, а не писали их рядом. Сквозная
 * проверка этого не увидит — два слегка разных знака оба отрисуются.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CANVAS, MASTER, SEAL, SMALL, band, bar } from './mark'

const ROOT = join(import.meta.dirname, '..', '..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

/** Где знак рисуется. Новое место дописывается сюда вместе с собой. */
const DRAWN_IN = ['src/app/layout.tsx', 'src/app/opengraph-image.tsx', 'scripts/mark.ts']

describe('знак рисуется из одного модуля', () => {
  it.each(DRAWN_IN)('%s берёт координаты, а не пишет их', (path) => {
    const source = read(path)

    expect(source, `${path} не обращается к модулю знака`).toMatch(/from '(@\/lib\/mark|\.\.\/src\/lib\/mark)'/)
    expect(source).toContain('band(')
    expect(source).toContain('bar(')
  })

  /*
   * Ровно та ошибка, ради которой файл написан: координаты, вписанные в
   * разметку числами. Ищется характерная пара «четыре точки через запятую».
   */
  it.each(DRAWN_IN)('%s не содержит координат россыпью', (path) => {
    const source = read(path)
    const inlined = source.match(/points="[\d\s.,-]{16,}"/g)

    expect(inlined, `в ${path} координаты вписаны руками: ${inlined?.join(' | ')}`).toBeNull()
  })
})

describe('геометрия остаётся геометрией', () => {
  it('штрих проходит через срезанные углы квадрата', () => {
    /*
     * Ось штриха обязана идти по диагонали: иначе срезы неравны, и знак
     * читается как ошибка совмещения.
     *
     * Считаются середины торцов, а не углы параллелограмма: у углов в разницу
     * по горизонтали входит ещё и толщина штриха. На этом первая редакция
     * проверки и упала — она обвинила верную геометрию.
     */
    const points = bar(MASTER).split(' ').map((pair) => pair.split(',').map(Number))
    const [lowLeft, lowRight, highRight, highLeft] = points
    const low = { x: (lowLeft[0]! + lowRight[0]!) / 2, y: lowLeft[1]! }
    const high = { x: (highRight[0]! + highLeft[0]!) / 2, y: highRight[1]! }

    expect(Math.abs(high.x - low.x - (low.y - high.y))).toBeLessThan(0.001)
  })

  it('полоса реза шире штриха ровно на два зазора', () => {
    const width = (points: string) => {
      const [first, second] = points.split(' ').map((pair) => Number(pair.split(',')[0]))
      return second! - first!
    }

    expect(width(band(MASTER)) - width(bar(MASTER))).toBeCloseTo(MASTER.gap * 2, 6)
  })

  /*
   * Мелкое начертание существует затем, чтобы рамка дожила до значка вкладки.
   * Если оно перестанет быть толще основного, смысл пропадёт молча.
   */
  it('мелкое начертание толще основного', () => {
    expect(SMALL.stroke).toBeGreaterThan(MASTER.stroke)
    expect(SMALL.width).toBeGreaterThan(MASTER.width)
  })

  it('рисунок помещается в холст', () => {
    const xs = bar(SMALL).split(' ').map((pair) => Number(pair.split(',')[0]))

    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...xs)).toBeLessThanOrEqual(CANVAS)
    expect(SEAL.x + SEAL.size).toBeLessThanOrEqual(CANVAS)
  })
})
