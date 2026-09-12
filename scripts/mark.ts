/**
 * Перерисовать комплект знака.
 *
 *     npx tsx scripts/mark.ts
 *
 * Геометрия берётся из `src/lib/mark.ts` — того же модуля, из которого рисует
 * шапка. Скрипт не выдумывает ни числа, ни цвета: он только раскладывает знак
 * по размерам и подложкам, которые нужны разным местам.
 *
 * Растр делается sharp, который и так стоит в зависимостях Next. Отдельного
 * инструмента для трёх картинок заводить незачем.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { CANVAS, MASTER, SEAL, SMALL, band, bar, type Weights } from '../src/lib/mark'

const INK = '#1a1614'
const PAPER = '#f7f3ed'
const GOLD = '#9c7a3c'

/** На чернилах золото и бумага берутся светлее: иначе знак тонет. */
const ON_DARK = { bg: '#14120f', ink: '#efe9df', gold: '#c39c52' }

type Options = {
  weights: Weights
  ink: string
  gold: string
  /** Подложка. Без неё знак прозрачный — так он ложится на любой фон. */
  bg?: string
  /**
   * Ужатие к центру. Android обрезает маскируемую иконку по своей форме, и
   * рисунок обязан уместиться в безопасную долю, иначе приедет подрезанным.
   */
  scale?: number
}

function draw({ weights, ink, gold, bg, scale = 1 }: Options): string {
  const inner = [
    `  <mask id="cut">`,
    `    <rect width="${CANVAS}" height="${CANVAS}" fill="#fff"/>`,
    `    <polygon points="${band(weights)}" fill="#000"/>`,
    `  </mask>`,
    `  <rect x="${SEAL.x}" y="${SEAL.y}" width="${SEAL.size}" height="${SEAL.size}"`,
    `        fill="none" stroke="${ink}" stroke-width="${weights.stroke}" mask="url(#cut)"/>`,
    `  <polygon points="${bar(weights)}" fill="${gold}"/>`,
  ].join('\n')

  const offset = ((CANVAS / 2) * (1 - scale)).toFixed(1)
  const body =
    scale === 1
      ? inner
      : `  <g transform="translate(${offset},${offset}) scale(${scale})">\n${inner}\n  </g>`

  const plate = bg ? `  <rect width="${CANVAS}" height="${CANVAS}" fill="${bg}"/>\n` : ''

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS} ${CANVAS}"`,
    ` width="${CANVAS}" height="${CANVAS}">\n${plate}${body}\n</svg>\n`,
  ].join('')
}

const ROOT = join(import.meta.dirname, '..')

/** Значок вкладки: мелкий кегль, потому что его и видят мелким. */
const tab = draw({ weights: SMALL, ink: INK, gold: GOLD, bg: PAPER })

/** Значок приложения: основное начертание на бумаге. */
const app = draw({ weights: MASTER, ink: INK, gold: GOLD, bg: PAPER })

const files: [string, string][] = [
  ['src/app/icon.svg', tab],
  ['public/brand/logo.svg', draw({ weights: MASTER, ink: INK, gold: GOLD })],
  ['public/brand/logo-dark.svg', draw({ weights: MASTER, ink: ON_DARK.ink, gold: ON_DARK.gold, bg: ON_DARK.bg })],
  // Одним цветом — для оттиска и для печати в одну краску, где золота нет.
  ['public/brand/logo-mono.svg', draw({ weights: MASTER, ink: INK, gold: INK })],
]

for (const [path, body] of files) {
  mkdirSync(join(ROOT, path, '..'), { recursive: true })
  writeFileSync(join(ROOT, path), body, 'utf8')
  console.log(path)
}

const raster: [string, string, number][] = [
  ['public/icon-192.png', app, 192],
  ['public/icon-512.png', app, 512],
  ['public/icon-maskable-512.png', draw({ weights: MASTER, ink: INK, gold: GOLD, bg: PAPER, scale: 0.66 }), 512],
]

async function rasterise() {
  for (const [path, body, size] of raster) {
    // density повыше: иначе рамка в шестнадцать единиц растрируется с кашей.
    await sharp(Buffer.from(body), { density: 900 })
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toFile(join(ROOT, path))
    console.log(path, `${size}×${size}`)
  }
}

// Обёрткой, а не верхним await: скрипт собирается в cjs, и верхний await там
// не поддерживается — падает на трансформации, не дойдя до рисования.
rasterise().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
