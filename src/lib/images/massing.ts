/**
 * Схема объёма для режима без генератора изображений.
 *
 * Это именно схема, а не подделка под визуализацию. Разница принципиальная:
 * серый прямоугольник с подписью «здесь будет рендер» ничего не сообщает, а
 * правдоподобная картинка, полученная без нейросети, вводит в заблуждение.
 * Схема показывает ровно то, что направление и означает, — как объём стоит на
 * участке, — и ничем другим не притворяется.
 *
 * Рисуется детерминированно: один и тот же ключ даёт одну и ту же схему.
 */

const W = 640
const H = 400

const BG = '#0A0E14'
const LINE = '#00C9E4'
const DIM = '#2b3746'
const GROUND = '#1e2733'

type Shape = (() => string) | undefined

const SHAPES: Record<string, () => string> = {
  terraced: () =>
    [
      ground(),
      box(120, 180, 130, 70),
      box(250, 220, 130, 60),
      box(380, 260, 130, 50),
      slope(),
    ].join(''),

  embedded: () =>
    [
      slope(),
      `<path d="M 120 300 L 360 300 L 360 190 L 250 190" fill="none" stroke="${DIM}" stroke-width="2" stroke-dasharray="6 5"/>`,
      box(360, 190, 150, 110),
      ground(),
    ].join(''),

  stilts: () =>
    [
      ground(),
      box(160, 150, 320, 110),
      leg(200, 260, 60),
      leg(300, 260, 60),
      leg(400, 260, 60),
      `<line x1="160" y1="320" x2="480" y2="320" stroke="${DIM}" stroke-width="2" stroke-dasharray="4 6"/>`,
    ].join(''),

  courtyard: () =>
    [
      ground(),
      box(160, 150, 320, 170),
      `<rect x="245" y="205" width="150" height="60" fill="${BG}" stroke="${DIM}" stroke-width="2"/>`,
    ].join(''),

  pavilions: () =>
    [
      ground(),
      box(120, 200, 110, 90),
      box(265, 180, 110, 110),
      box(410, 210, 110, 80),
      `<line x1="230" y1="255" x2="265" y2="255" stroke="${DIM}" stroke-width="2"/>`,
      `<line x1="375" y1="255" x2="410" y2="255" stroke="${DIM}" stroke-width="2"/>`,
    ].join(''),

  compact: () => [ground(), box(230, 160, 180, 130)].join(''),

  linear: () => [ground(), box(90, 205, 460, 85)].join(''),

  stacked: () =>
    [
      ground(),
      box(170, 240, 300, 50),
      box(200, 195, 240, 45),
      box(230, 150, 180, 45),
    ].join(''),

  podium: () =>
    [
      ground(),
      box(140, 250, 360, 40),
      box(215, 150, 210, 100),
    ].join(''),
}

function ground(): string {
  return `<line x1="40" y1="290" x2="600" y2="290" stroke="${GROUND}" stroke-width="2"/>`
}

function slope(): string {
  return `<path d="M 40 300 L 600 150" fill="none" stroke="${GROUND}" stroke-width="2"/>`
}

function box(x: number, y: number, w: number, h: number): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${LINE}" stroke-width="2"/>`
}

function leg(x: number, y: number, h: number): string {
  return `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + h}" stroke="${LINE}" stroke-width="2"/>`
}

function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function massingSvg(key: string, title: string): string {
  const shape: Shape = SHAPES[key]
  const drawing = shape ? shape() : box(230, 160, 180, 130) + ground()

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`,
    `<rect width="${W}" height="${H}" fill="${BG}"/>`,
    drawing,
    `<text x="40" y="56" fill="${LINE}" font-family="monospace" font-size="15" letter-spacing="3">${escape(title.toUpperCase())}</text>`,
    // Подпись обязательна: это схема, и она не должна читаться как визуализация.
    `<text x="40" y="360" fill="${DIM}" font-family="monospace" font-size="12" letter-spacing="2">СХЕМА ОБЪЁМА — НЕ ВИЗУАЛИЗАЦИЯ</text>`,
    '</svg>',
  ].join('')
}

export function massingDataUri(key: string, title: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(massingSvg(key, title), 'utf8').toString('base64')}`
}
