'use client'

import { useMemo, useState } from 'react'
import {
  JURISDICTIONS,
  JURISDICTION_NAMES,
  LOCAL_ONLY_DISCIPLINES,
  requiredRoles,
  type Jurisdiction,
  type Terrain,
} from '@/engine/taxonomy'
import { priceProject } from '@/engine/pricing'
import { DISCIPLINE_LABELS } from '@/lib/labels'

/**
 * Песочница на первом экране.
 *
 * Считает настоящий движок, а не подобранные числа: состав ролей выводится тем
 * же `requiredRoles`, которым бюро собирает команду под реальный бриф, цена —
 * тем же `priceProject`, которым выставляется счёт. Поэтому подвинуть ползунок
 * и увидеть, как из четырёх человек становится семь,, это не демонстрация
 * идеи, а сам продукт, только без брифа.
 *
 * Расчёт идёт на клиенте, и это возможно ровно потому, что обе функции чистые:
 * они не ходят в базу и ничего не знают о пуле. Готовность здесь не
 * показывается сознательно, она зависит от живых людей, и её место в панели
 * бюро, а не в игрушке на главной.
 */

const AREAS = [120, 200, 300, 400, 600, 900] as const
const TERRAINS: { key: Terrain; label: string }[] = [
  { key: 'flat', label: 'Flat' },
  { key: 'slope', label: 'Slope' },
  { key: 'flood_prone', label: 'Flood-prone' },
]

/** Страны, которые видит человек на главной: где бюро уже работало. */
const FEATURED: Jurisdiction[] = ['ME', 'RS', 'IT', 'GR', 'ES', 'DE']

export function BriefSandbox() {
  const [areaIndex, setAreaIndex] = useState(3)
  const [terrain, setTerrain] = useState<Terrain>('slope')
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction>('ME')

  const areaSqm = AREAS[areaIndex]!

  const { roles, local, total } = useMemo(() => {
    const shape = {
      typology: 'villa' as const,
      targetStage: 'permit' as const,
      materialSystem: 'concrete' as const,
      terrain,
      gridConnection: 'grid' as const,
    }

    const required = requiredRoles(shape)

    /*
     * Роли считаются по паре «дисциплина × специализация», а не по головам:
     * один человек может закрыть две специализации, если обе у него заявлены.
     * Поэтому здесь честнее сказать «мест в команде», чем «человек».
     */
    const seats = required.length

    const stages = priceProject({
      typology: 'villa',
      jurisdiction,
      areaSqm,
      targetStage: 'permit',
    })

    return {
      roles: seats,
      local: required.filter((r) => LOCAL_ONLY_DISCIPLINES.includes(r.discipline)).length,
      total: stages.reduce((sum, s) => sum + s.amount, 0),
    }
  }, [areaSqm, terrain, jurisdiction])

  return (
    <div className="sandbox">
      <div className="sandbox-controls">
        <label>
          <span className="eyebrow">Floor area</span>
          <input
            type="range"
            min={0}
            max={AREAS.length - 1}
            value={areaIndex}
            onChange={(e) => setAreaIndex(Number(e.target.value))}
          />
          <span className="mono sandbox-value">{areaSqm} m²</span>
        </label>

        <div>
          <span className="eyebrow">Site</span>
          <div className="sandbox-choice">
            {TERRAINS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={t.key === terrain ? 'is-current' : undefined}
                onClick={() => setTerrain(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <label>
          <span className="eyebrow">Country</span>
          <select
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value as Jurisdiction)}
          >
            {FEATURED.map((j) => (
              <option key={j} value={j}>
                {JURISDICTION_NAMES[j]}
              </option>
            ))}
            <optgroup label="Everywhere else">
              {JURISDICTIONS.filter((j) => !FEATURED.includes(j)).map((j) => (
                <option key={j} value={j}>
                  {JURISDICTION_NAMES[j]}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
      </div>

      <div className="sandbox-result">
        <Readout value={String(roles)} unit="seats in the team" />
        <Readout value={String(local)} unit="must be local" />
        <Readout value={`€${total.toLocaleString('en-GB')}`} unit="to permit stage" />
      </div>

      <p className="hint sandbox-note">
        A villa to permit stage. The same functions that assemble a real team and issue a real
        invoice, only without the brief. The design team is drawn from wherever it is; survey,
        permitting and the licensed signature under each section are local to the country.
      </p>
    </div>
  )
}

function Readout({ value, unit }: { value: string; unit: string }) {
  return (
    <div className="sandbox-readout">
      {/*
        Ключ по значению перезапускает проявление на каждом изменении: число,
        которое сменилось молча, читается как опечатка, а не как пересчёт.
      */}
      <span key={value} className="mono sandbox-number">
        {value}
      </span>
      <span className="hint">{unit}</span>
    </div>
  )
}
