import { describe, expect, it } from 'vitest'
import { GATE_LABELS } from './labels'
import { failedGate } from '@/engine/filter'
import { fullPool, requirements, role } from '@/engine/fixtures'

/*
 * Подписи гейтов проверяются тестом, а не только типами.
 *
 * Типы ловят это на сборке, но сборка идёт после того, как тесты прошли, и
 * между ними успевает случиться выкладка. Один новый гейт без подписи — и
 * специалист читает про себя пустое место вместо причины отказа.
 */
describe('подписи гейтов', () => {
  it('каждый гейт, который движок умеет вернуть, назван по-человечески', () => {
    /*
     * Список берётся не из типа, а из прогона: движок прогоняется по всему
     * стенду, и каждая причина, которую он реально вернул, обязана иметь
     * подпись. Перечислять имена руками значило бы держать третий список,
     * который точно так же отстанет.
     */
    const pool = fullPool()
    const req = requirements()

    const seen = new Set<string>()
    for (const specialist of pool) {
      for (const discipline of specialist.disciplines) {
        const gate = failedGate(specialist, req, role(discipline))
        if (gate) seen.add(gate)
      }
    }

    for (const gate of seen) {
      expect(GATE_LABELS[gate as keyof typeof GATE_LABELS], gate).toBeTruthy()
    }
  })

  it('ни одна подпись не пустая', () => {
    for (const [gate, label] of Object.entries(GATE_LABELS)) {
      expect(label.trim(), gate).not.toBe('')
    }
  })
})
