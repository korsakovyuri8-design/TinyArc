/**
 * Что панель говорит тому, кто нажал кнопку.
 *
 * Раньше она говорила «письмо ушло» всегда: и при выключенной почте, и когда
 * отправка провалилась. Оператор закрывал карточку, считая дело сделанным, а
 * человек на той стороне ничего не получал. Отсюда четыре исхода вместо двух
 * и тест на каждый: обещание «мы написали» должно звучать ровно там, где
 * письмо действительно ушло.
 */

import { describe, expect, it } from 'vitest'
import { deliveryNote, type Delivery } from './notify'

describe('deliveryNote', () => {
  it('обещает письмо только тогда, когда оно ушло', () => {
    expect(deliveryNote('sent', 'The specialist')).toBe('The specialist has been told by email.')
  })

  it('при выключенной почте отправляет звать руками', () => {
    const note = deliveryNote('stub', 'The specialist')

    expect(note).toContain('off')
    expect(note).toContain('yourself')
    expect(note).not.toContain('has been told')
  })

  it('провал отправки называется провалом', () => {
    const note = deliveryNote('failed', 'The client')

    expect(note).toContain('did not go out')
    expect(note).toContain('yourself')
    expect(note).not.toContain('has been told')
  })

  it('там, где повода нет, письма не обещают', () => {
    expect(deliveryNote('skipped', 'The client')).not.toContain('has been told')
  })

  it('ни один исход не оставляет фразу без адресата', () => {
    const outcomes: Delivery[] = ['sent', 'stub', 'failed', 'skipped']

    for (const outcome of outcomes) {
      const note = deliveryNote(outcome, 'The specialist')
      expect(note.toLowerCase()).toContain('specialist')
      expect(note.endsWith('.')).toBe(true)
    }
  })
})
