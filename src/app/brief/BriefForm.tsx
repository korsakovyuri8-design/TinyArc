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
import { readDescription, submitBrief, type BriefState } from './actions'

export function BriefForm() {
  const [state, action, pending] = useActionState<BriefState, FormData>(submitBrief, {})
  const [read, readAction, reading] = useActionState<BriefState, FormData>(readDescription, {})

  /*
   * Что показывать — последнее, что случилось. Разбор описания и отправка
   * формы наполняют одно и то же состояние, и брать значения из отправки,
   * когда человек только что нажал «прочитать», значит стереть у него на
   * глазах то, ради чего он и нажимал.
   */
  const latest = read.values || read.errors ? read : state
  const errors = latest.errors ?? {}
  const values = (latest.values ?? {}) as Record<string, string>

  return (
    <>
      <Description action={readAction} pending={reading} state={read} />
      <BriefFields action={action} pending={pending} errors={errors} values={values} />
    </>
  )
}

/**
 * Свободное описание проекта.
 *
 * Стоит над формой, а не вместо неё: человек, у которого проект в голове, а
 * не в таблице, пишет пару абзацев, и заполненными оказываются те поля,
 * которые он назвал. Остальные он видит пустыми — и это правда: угаданное
 * поле он не заметит, а пустое заполнит.
 */
function Description({
  action,
  pending,
  state,
}: {
  action: (formData: FormData) => void
  pending: boolean
  state: BriefState
}) {
  const values = (state.values ?? {}) as Record<string, string>

  return (
    <form action={action} className="panel" style={{ marginBottom: 32 }}>
      <div className="label label-accent">Describe it in your own words</div>
      <p className="muted" style={{ marginTop: 10, marginBottom: 14, maxWidth: '58ch' }}>Optional, and it fills the form in below rather than replacing it. Only what you state outright is filled in — nothing is inferred, because a guessed field is one you will not notice, and an empty one you will.</p>

      <textarea
        id="description"
        name="description"
        defaultValue={values.description ?? ''}
        placeholder="A two-storey villa on a slope near Tivat, about 240 m². We want to go as far as the building permit."
        style={{ minHeight: 96 }}
      />

      {state.errors?.description && (
        <div className="hint" style={{ color: 'var(--fail)', marginTop: 8 }}>
          {state.errors.description}
        </div>
      )}

      {state.read && (
        <div className="hint" style={{ marginTop: 10 }}>
          {state.read.missing.length > 0
            ? fill('Filled in what the text states. Still to say: {missing}.', {
                missing: state.read.missing.join(', '),
              })
            : 'Filled in what the text states. Check the fields below before sending.'}
        </div>
      )}

      <button type="submit" className="btn btn-quiet" style={{ marginTop: 14 }} disabled={pending}>
        {pending ? 'Reading…' : 'Read my description'}
      </button>
    </form>
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

          {/*
            Участок спрашивается тремя полями и все три необязательны.
            Владелец берёт их из своих бумаг; проектных величин — пятна, высоты,
            отступов — он не знает, и требовать их у него значит требовать
            проект до проекта. Без этих полей бриф принимается, а проверка на
            нормы честно говорит, чего ей не хватило.
          */}
          <Field
            label="Municipality"
            name="municipality"
            error={errors.municipality}
            hint="Planning rules live at this level, not at the country's"
          >
            <input
              id="municipality"
              name="municipality"
              type="text"
              maxLength={120}
              defaultValue={(values.municipality as string) ?? ''}
            />
          </Field>

          <Field
            label="Zone"
            name="zone"
            error={errors.zone}
            hint="As written in your documents — leave empty if you do not know it"
          >
            <input
              id="zone"
              name="zone"
              type="text"
              maxLength={60}
              defaultValue={(values.zone as string) ?? ''}
            />
          </Field>

          <Field
            label="Plot area, m²"
            name="plotAreaSqm"
            error={errors.plotAreaSqm}
            hint="With it we can tell you before assembly whether the plot holds what you ordered"
          >
            <input
              id="plotAreaSqm"
              name="plotAreaSqm"
              type="number"
              min={0}
              defaultValue={(values.plotAreaSqm as string | number) ?? ''}
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
