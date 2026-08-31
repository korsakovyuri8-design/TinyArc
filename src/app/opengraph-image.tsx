import { ImageResponse } from 'next/og'

/**
 * Карточка ссылки: то, что видит человек, которому продукт переслали.
 *
 * Ссылка без картинки приходит в мессенджер серой строкой — а именно так
 * продукт и показывают первому заказчику и инвестору. Собирается кодом, а не
 * лежит файлом: заголовок и обещание меняются вместе с продуктом, и картинка,
 * нарисованная однажды, разошлась бы с ним молча.
 *
 * Гарнитуры здесь системные намеренно. Playfair и DM Sans пришлось бы
 * подгружать файлами на каждую сборку картинки ради текста в две строки;
 * взамен взяты вес и разрядка, по которым узнаётся тот же тон.
 */
export const alt = 'TinyArc Cloud Bureau — the bureau that ends the bureau'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#f7f3ed',
          padding: 80,
          color: '#1a1614',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 30 }}>
          <span style={{ letterSpacing: '0.04em' }}>TinyArc</span>
          <span style={{ color: '#9c7a3c' }}>/</span>
          <span style={{ letterSpacing: '0.04em' }}>Bureau</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div style={{ fontSize: 82, lineHeight: 1.05, maxWidth: 900 }}>
            The bureau that ends the bureau
          </div>
          <div style={{ fontSize: 30, color: '#5b554c', maxWidth: 860, lineHeight: 1.35 }}>
            An algorithm selects specialists on facts, assembles a team for the project and
            runs it through to the documentation set.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 20,
            fontSize: 24,
            color: '#7f622e',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
          }}
        >
          <span>Filter</span>
          <span style={{ color: '#0a7a8a' }}>·</span>
          <span>Score</span>
          <span style={{ color: '#0a7a8a' }}>·</span>
          <span>Relay</span>
        </div>
      </div>
    ),
    size,
  )
}
