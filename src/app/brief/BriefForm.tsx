'use client'

import { useActionState } from 'react'
import { fill } from '@/lib/fill'
import {
  CLIMATE_ZONES,
  DOC_STAGES,
  GRID_CONNECTIONS,
  JURISDICTIONS,
  JURISDICTION_NAMES,
  LANGUAGES,
  LANGUAGE_NAMES,
  MATERIAL_SYSTEMS,
  MAX_STOREYS,
  REGULATORY_TRACKS,
  SOFTWARE,
  TERRAINS,
  TYPOLOGIES,
} from '@/engine/taxonomy'
import {
  CLIMATE_LABELS,
  DOC_STAGE_LABELS,
  GRID_LABELS,
  TERRAIN_LABELS,
  MATERIAL_LABELS,
  REGULATORY_LABELS,
  SOFTWARE_LABELS,
  TYPOLOGY_LABELS,
} from '@/lib/labels'
import { Consent } from '@/components/Consent'
import { Choices, Field, Select, Submit } from '@/components/Fields'
import { submitBrief, type BriefState } from './actions'

export function BriefForm() {
  const [state, action, pending] = useActionState<BriefState, FormData>(submitBrief, {})
  const errors = state.errors ?? {}
  const values = (state.values ?? {}) as Record<string, string>

  return (
          <BriefFields action={action} pending={pending} errors={errors} values={values} />
  )
}

/**
 * Поля отдельным компонентом, потому что переводчик берётся из контекста, а
 * провайдер обязан стоять выше того, кто его читает.
 */
function BriefFields({
  action,
  pending,
  errors,
  values,
}: {
  action: (formData: FormData) => void
  pending: boolean
  errors: Record<string, string>
  values: Record<string, string>
}) {

  return (
    <form action={action}>
      <fieldset>
        <legend>Project</legend>

        <Field label="Name" name="title" error={errors.title}>
          <input id="title" name="title" defaultValue={values.title ?? ''} placeholder="Villa in Tivat" />
        </Field>

        <div className="grid grid-2">
          <Field label="Typology" name="typology" error={errors.typology}>
            <Select name="typology" options={TYPOLOGIES} labels={TYPOLOGY_LABELS} defaultValue="villa" />
          </Field>

          <Field
            label="Storeys"
            name="storeys"
            error={errors.storeys}
            hint={fill('Bureau takes buildings up to {n} storeys', { n: MAX_STOREYS })}
          >
            <input id="storeys" name="storeys" type="number" min={1} max={60} defaultValue={values.storeys ?? 2} />
          </Field>

          <Field label="Floor area, m²" name="areaSqm" error={errors.areaSqm}>
            <input id="areaSqm" name="areaSqm" type="number" min={10} defaultValue={values.areaSqm ?? 400} />
          </Field>

          <Field label="Country" name="jurisdiction" error={errors.jurisdiction}>
            <Select
              name="jurisdiction"
              options={JURISDICTIONS}
              labels={JURISDICTION_NAMES}
              defaultValue="ME"
            />
          </Field>

          <Field label="Climate zone" name="climateZone" error={errors.climateZone}>
            <Select
              name="climateZone"
              options={CLIMATE_ZONES}
              labels={CLIMATE_LABELS}
              defaultValue="mediterranean"
            />
          </Field>

          <Field label="Structural system" name="materialSystem" error={errors.materialSystem}>
            <Select
              name="materialSystem"
              options={MATERIAL_SYSTEMS}
              labels={MATERIAL_LABELS}
              defaultValue="concrete"
            />
          </Field>

          <Field
            label="Regulatory track"
            name="regulatoryTrack"
            error={errors.regulatoryTrack}
            hint="Bureau works in light-regulation zones"
          >
            <Select
              name="regulatoryTrack"
              options={REGULATORY_TRACKS}
              labels={REGULATORY_LABELS}
              defaultValue="light"
            />
          </Field>

          <Field label="Documentation stage" name="targetStage" error={errors.targetStage}>
            <Select
              name="targetStage"
              options={DOC_STAGES}
              labels={DOC_STAGE_LABELS}
              defaultValue="permit"
            />
          </Field>

          <Field
            label="Site"
            name="terrain"
            error={errors.terrain}
            hint="A slope requires grading design; flood risk requires separate approvals"
          >
            <Select name="terrain" options={TERRAINS} labels={TERRAIN_LABELS} defaultValue="flat" />
          </Field>

          <Field
            label="Utilities"
            name="gridConnection"
            error={errors.gridConnection}
            hint="Off-grid is different engineering, not the same engineering with a footnote"
          >
            <Select
              name="gridConnection"
              options={GRID_CONNECTIONS}
              labels={GRID_LABELS}
              defaultValue="grid"
            />
          </Field>
        </div>
      </fieldset>

      <fieldset>
        <legend>Working conditions</legend>

        <Field
          label="Software"
          error={errors.software}
          hint="For reference only: tick this if you already have a model from a previous consultant. It does not constrain the team — the team converges on one package by itself"
        >
          <Choices name="software" options={SOFTWARE} labels={SOFTWARE_LABELS} />
        </Field>

        <Field label="Languages" error={errors.languages} hint="What you are comfortable working in">
          <Choices name="languages" options={LANGUAGES} labels={LANGUAGE_NAMES} defaultValue={['en']} />
        </Field>

        <div className="grid grid-2">
          <Field
            label="Workload, h/week"
            name="requiredHoursPerWeek"
            error={errors.requiredHoursPerWeek}
            hint="How much of a specialist’s time the project needs"
          >
            <input
              id="requiredHoursPerWeek"
              name="requiredHoursPerWeek"
              type="number"
              min={1}
              max={40}
              defaultValue={values.requiredHoursPerWeek ?? 10}
            />
          </Field>

          <Field
            label="Start within, days"
            name="horizonDays"
            error={errors.horizonDays}
            hint="How soon the team must start work"
          >
            <input
              id="horizonDays"
              name="horizonDays"
              type="number"
              min={7}
              max={365}
              defaultValue={values.horizonDays ?? 45}
            />
          </Field>
        </div>
      </fieldset>

      <fieldset>
        <legend>Contact</legend>

        <div className="grid grid-2">
          <Field label="How to address you" name="clientName" error={errors.clientName}>
            <input id="clientName" name="clientName" defaultValue={values.clientName ?? ''} />
          </Field>

          <Field
            label="Email"
            name="clientEmail"
            error={errors.clientEmail}
            hint="Your access key will be sent here"
          >
            <input id="clientEmail" name="clientEmail" type="email" defaultValue={values.clientEmail ?? ''} />
          </Field>
        </div>

        <Field
          label="What matters about the site"
          name="briefNotes"
          error={errors.briefNotes}
          hint="The team sees this scoped to their task, not in full"
        >
          <textarea id="briefNotes" name="briefNotes" defaultValue={values.briefNotes ?? ''} />
        </Field>
      </fieldset>

      {errors.form && (
        <div className="note note-fail" style={{ marginBottom: 20 }}>
          {errors.form}
        </div>
      )}

      <Consent error={errors.consent} />

      <div className="row" style={{ gap: 16 }}>
        <Submit pending={pending}>Assemble the team</Submit>
        <span className="dim" style={{ fontSize: '0.85rem' }}>
          The engine answers immediately — no “we’ll get back to you”
        </span>
      </div>
    </form>
  )
}
