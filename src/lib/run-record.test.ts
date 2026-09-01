/**
 * Что из прогона остаётся в записях.
 *
 * Раньше оставалось всё: пул на роли. При сотне человек это четыре с половиной
 * сотни строк на бриф, при пяти тысячах — сорок тысяч, и писались они внутри
 * одной транзакции. Замерено на живом Postgres: при тысяче сборка занимала пять
 * секунд и упиралась в предел транзакции, при пяти тысячах отказывала совсем.
 * Бриф перестал бы приниматься ровно в тот момент, когда пул наберётся.
 *
 * Проверяется здесь не скорость — её меряют отдельно, — а то, что при отборе
 * не теряется нужное: разбор по каждому, кто вошёл в команду, и ранжированный
 * хвост для замены.
 */

import { describe, expect, it } from 'vitest'
import type { Assembly, ScoredCandidate } from '@/engine/types'
import { CANDIDATES_STORED, forRecord } from './run-record'

const role = (discipline: string) =>
  ({ discipline, specializations: [], mode: 'any' }) as ScoredCandidate['role']

function candidate(
  discipline: string,
  id: string,
  rank: number,
  passed = true,
): ScoredCandidate {
  return {
    specialist: { id } as ScoredCandidate['specialist'],
    role: role(discipline),
    discipline: discipline as ScoredCandidate['discipline'],
    passed,
    failedGate: passed ? null : 'portfolio_threshold',
    breakdown: { score: 100 - rank } as ScoredCandidate['breakdown'],
    rank: passed ? rank : 0,
  }
}

function assembly(candidates: ScoredCandidate[], team: string[] = []): Assembly {
  return {
    outcome: 'ok',
    notes: '',
    gap: null,
    pooledCount: candidates.length,
    survivedCount: candidates.filter((c) => c.passed).length,
    requiredRoles: [],
    candidates,
    team: team.map((id) => {
      const found = candidates.find((c: ScoredCandidate) => c.specialist.id === id)!
      return {
        specialist: found.specialist,
        role: found.role,
        discipline: found.discipline,
        isSignatory: false,
        score: 1,
      } as Assembly['team'][number]
    }),
  }
}

describe('разбор прогона', () => {
  it('оставляет не больше потолка на роль', () => {
    const many = Array.from({ length: 200 }, (_, i) => candidate('architecture', `a${i}`, i + 1))

    expect(forRecord(assembly(many))).toHaveLength(CANDIDATES_STORED)
  })

  it('считает потолок по каждой роли отдельно', () => {
    const kept = forRecord(
      assembly([
        ...Array.from({ length: 100 }, (_, i) => candidate('architecture', `a${i}`, i + 1)),
        ...Array.from({ length: 100 }, (_, i) => candidate('structures', `s${i}`, i + 1)),
      ]),
    )

    expect(kept).toHaveLength(CANDIDATES_STORED * 2)
  })

  it('оставляет лучших, а не первых попавшихся', () => {
    const many = Array.from({ length: 100 }, (_, i) => candidate('architecture', `a${i}`, 100 - i))
    const kept = forRecord(assembly(many))

    expect(Math.max(...kept.map((c) => c.rank))).toBe(CANDIDATES_STORED)
  })

  /*
   * Не прошедших гейт не читает никто: их число записано на самом прогоне, а
   * роль, которую нечем закрыть, названа отдельно.
   */
  it('не хранит тех, кто не прошёл гейт', () => {
    const kept = forRecord(
      assembly([
        candidate('architecture', 'a1', 1),
        candidate('architecture', 'x1', 0, false),
        candidate('architecture', 'x2', 0, false),
      ]),
    )

    expect(kept.map((c) => c.specialist.id)).toEqual(['a1'])
  })

  /*
   * И главное исключение. Разбор для члена команды ищется в этом же списке:
   * человек, которого в нём не оказалось, показался бы заказчику строкой без
   * объяснения — при том что он и есть его команда.
   */
  it('оставляет вошедших в команду, даже если они за потолком', () => {
    const many = Array.from({ length: 200 }, (_, i) => candidate('architecture', `a${i}`, i + 1))
    const kept = forRecord(assembly(many, ['a150']))

    expect(kept.map((c) => c.specialist.id)).toContain('a150')
  })

  it('и не задваивает того, кто и в команде, и в первых по рангу', () => {
    const many = Array.from({ length: 50 }, (_, i) => candidate('architecture', `a${i}`, i + 1))
    const kept = forRecord(assembly(many, ['a0']))

    expect(kept.filter((c) => c.specialist.id === 'a0')).toHaveLength(1)
  })

  /*
   * Замена ищет следующего по рангу из того же прогона (п.10а). Хвост обязан
   * быть длиннее того, что движок взвешивает на роль, иначе замену искать
   * будет негде уже после первого выхода.
   */
  it('хвоста хватает на замену, а не только на состав', () => {
    expect(CANDIDATES_STORED).toBeGreaterThanOrEqual(24)
  })
})
