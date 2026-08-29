'use client'

import { useActionState } from 'react'
import {
  CLIMATE_ZONES,
  DISCIPLINES,
  DISCIPLINE_SPECIALIZATIONS,
  DOC_STAGES,
  IFC_LEVELS,
  JURISDICTIONS,
  JURISDICTION_NAMES,
  LANGUAGES,
  LANGUAGE_NAMES,
  MATERIAL_SYSTEMS,
  REGULATORY_TRACKS,
  SCALE_BANDS,
  SOFTWARE,
  TYPOLOGIES,
  WORK_MODES,
  PORTFOLIO_THRESHOLD,
} from '@/engine/taxonomy'
import {
  CLIMATE_LABELS,
  DISCIPLINE_LABELS,
  SPECIALIZATION_LABELS,
  DOC_STAGE_LABELS,
  IFC_LABELS,
  MATERIAL_LABELS,
  REGULATORY_LABELS,
  SCALE_BAND_LABELS,
  SOFTWARE_LABELS,
  TYPOLOGY_LABELS,
  WORK_MODE_LABELS,
} from '@/lib/labels'
import { Consent } from '@/components/Consent'
import { Choices, Field, Select, Submit } from '@/components/Fields'
import { fill } from '@/lib/fill'
import type { ApplicationState } from '@/app/specialists/apply/actions'

export type SpecialistFormAction = (
  prev: ApplicationState,
  formData: FormData,
) => Promise<ApplicationState>

/**
 * Двенадцать измерений таксономии — одной формой на два входа.
 *
 * Вход первый: человек пришёл сам и подаёт заявку. Вход второй: бюро завело его
 * импортом базы, и он дозаполняет профиль по приглашению. Спрашивается одно и
 * то же, потому что движку нужно одно и то же — держать две формы значило бы
 * рано или поздно спрашивать в них разное.
 *
 * Заполненные импортом поля приходят в defaults и стоят отмеченными: человек
 * подтверждает или правит то, что бюро уже знало, а не набирает заново.
 */
type SpecialistFormProps = {
  action: SpecialistFormAction
  defaults?: Record<string, string | string[]>
  submitLabel?: string
  /** Что показать после успешной отправки. */
  done?: React.ReactNode
  /** Скрытые поля: к чему относится отправка, если запись уже существует. */
  hidden?: Record<string, string>
  /**
   * Показывать ли свободную ёмкость.
   *
   * Своим временем распоряжается специалист, и в правке из панели бюро это
   * поле было бы обманкой: видно, вводится, ни на что не влияет. Значение
   * всё равно уходит скрытым — схема проверяет форму целиком.
   */
  showCapacity?: boolean
  /** Спрашивать согласие: только там, где форму заполняет сам человек. */
  askConsent?: boolean
}

export function SpecialistForm({
  action: submit,
  defaults = {},
  submitLabel = 'Apply',
  done,
  hidden = {},
  showCapacity = true,
  askConsent = false,
}: SpecialistFormProps) {
  const [state, action, pending] = useActionState<ApplicationState, FormData>(submit, {})

  if (state.submitted) {
    return (
      done ?? (
        <div className="panel panel-accent">
          <div className="label label-accent">Application received</div>
          <h3 style={{ marginTop: 12 }}>Next — the portfolio review</h3>
          <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
            {fill(
              'The bureau reviews the portfolio and sets the rating. The threshold is {threshold}/10; below it an application does not pass, and that is not negotiated case by case. If you pass, the access key arrives at the address you gave.',
              { threshold: PORTFOLIO_THRESHOLD },
            )}
          </p>
        </div>
      )
    )
  }

  const errors = state.errors ?? {}
  // Значения после неудачной отправки важнее исходных: человек только что их
  // правил, и вернуть ему довведённое было бы потерей работы.
  const submitted = (state.values ?? {}) as Record<string, string>
  const values: Record<string, string> = { ...asText(defaults), ...submitted }

  /** Отмеченные значения множественного поля. */
  const list = (name: string): string[] => {
    const fromState = state.values?.[name]
    if (Array.isArray(fromState)) return fromState as string[]

    const fallback = defaults[name]
    return Array.isArray(fallback) ? fallback : []
  }

  return (
    <form action={action}>
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      <fieldset>
        <legend>Who you are</legend>

        <div className="grid grid-2">
          <Field label="Name shown to the client" name="displayName" error={errors.displayName}>
            <input id="displayName" name="displayName" defaultValue={values.displayName ?? ''} />
          </Field>

          <Field label="Email" name="email" error={errors.email} hint="The access key comes to this address">
            <input id="email" name="email" type="email" defaultValue={values.email ?? ''} />
          </Field>
        </div>

        <Field
          label="Portfolio"
          name="portfolioUrl"
          error={errors.portfolioUrl}
          hint="The main entrance to selection: what you show weighs more than what you claim"
        >
          <input
            id="portfolioUrl"
            name="portfolioUrl"
            type="url"
            placeholder="https://"
            defaultValue={values.portfolioUrl ?? ''}
          />
        </Field>
      </fieldset>

      <fieldset>
        <legend>What you handle · dimensions 1–4</legend>

        <Field label="Disciplines" error={errors.disciplines}>
          <Choices defaultValue={list('disciplines') as never[]} name="disciplines" options={DISCIPLINES} labels={DISCIPLINE_LABELS} />
        </Field>

        <Field
          label="Specialisation"
          error={errors.specializations}
          hint="Tick only what you have led yourself. A concrete-frame engineer on a timber house is not “near enough the same thing”, and the engine keeps the two apart on purpose"
        >
          <div className="stack" style={{ gap: 16 }}>
            {DISCIPLINES.filter((d) => DISCIPLINE_SPECIALIZATIONS[d].length > 0).map((d) => (
              <div key={d}>
                <div className="label" style={{ marginBottom: 8 }}>
                  {DISCIPLINE_LABELS[d]}
                </div>
                <Choices
                  name="specializations"
                  options={DISCIPLINE_SPECIALIZATIONS[d]}
                  labels={SPECIALIZATION_LABELS}
                  defaultValue={list('specializations') as never[]}
                />
              </div>
            ))}
          </div>
        </Field>

        <Field label="Typologies" error={errors.typologies}>
          <Choices defaultValue={list('typologies') as never[]} name="typologies" options={TYPOLOGIES} labels={TYPOLOGY_LABELS} />
        </Field>

        <Field label="Scale" error={errors.scaleBands}>
          <Choices defaultValue={list('scaleBands') as never[]} name="scaleBands" options={SCALE_BANDS} labels={SCALE_BAND_LABELS} />
        </Field>

        <Field
          label="Maximum storeys"
          name="maxStoreys"
          error={errors.maxStoreys}
          hint="Only what you have proven experience with"
        >
          <input
            id="maxStoreys"
            name="maxStoreys"
            type="number"
            min={1}
            max={60}
            defaultValue={values.maxStoreys ?? 3}
          />
        </Field>
      </fieldset>

      <fieldset>
        <legend>Where and in what · dimensions 5–8</legend>

        <Field label="Material systems" error={errors.materialSystems}>
          <Choices defaultValue={list('materialSystems') as never[]} name="materialSystems" options={MATERIAL_SYSTEMS} labels={MATERIAL_LABELS} />
        </Field>

        <Field label="Climate zones" error={errors.climateZones}>
          <Choices defaultValue={list('climateZones') as never[]} name="climateZones" options={CLIMATE_ZONES} labels={CLIMATE_LABELS} />
        </Field>

        <Field
          label="Jurisdictions"
          error={errors.jurisdictions}
          hint="Where you have actually taken projects through approvals"
        >
          <Choices defaultValue={list('jurisdictions') as never[]} name="jurisdictions" options={JURISDICTIONS} labels={JURISDICTION_NAMES} />
        </Field>

        <Field
          label="Signing rights"
          error={errors.signsIn}
          hint="Only countries from the list above. Without signing rights in a country the project is not taken at all"
        >
          <Choices defaultValue={list('signsIn') as never[]} name="signsIn" options={JURISDICTIONS} labels={JURISDICTION_NAMES} />
        </Field>

        <Field label="Software" error={errors.software}>
          <Choices defaultValue={list('software') as never[]} name="software" options={SOFTWARE} labels={SOFTWARE_LABELS} />
        </Field>

        <Field
          label="IFC exchange level"
          name="ifcLevel"
          error={errors.ifcLevel}
          hint="A shared format replaces a shared software suite: with IFC coordination you are compatible with any team"
        >
          <Select
            name="ifcLevel"
            options={IFC_LEVELS}
            labels={IFC_LABELS}
            defaultValue={(values.ifcLevel ?? 'exchange') as never}
          />
        </Field>
      </fieldset>

      <fieldset>
        <legend>How you work · dimensions 9–12</legend>

        <Field label="Documentation stages" error={errors.docStages}>
          <Choices defaultValue={list('docStages') as never[]} name="docStages" options={DOC_STAGES} labels={DOC_STAGE_LABELS} />
        </Field>

        <Field label="Regulatory track" error={errors.regulatoryTracks}>
          <Choices
            name="regulatoryTracks"
            options={REGULATORY_TRACKS}
            labels={REGULATORY_LABELS}
            defaultValue={
              (list('regulatoryTracks').length > 0 ? list('regulatoryTracks') : ['light']) as never[]
            }
          />
        </Field>

        <Field
          label="Languages"
          error={errors.languages}
          hint="For approvals the language of the authorities is a hard requirement"
        >
          <Choices defaultValue={list('languages') as never[]} name="languages" options={LANGUAGES} labels={LANGUAGE_NAMES} />
        </Field>

        <div className="grid grid-2">
          <Field label="Work mode" name="workMode" error={errors.workMode}>
            <Select
              name="workMode"
              options={WORK_MODES}
              labels={WORK_MODE_LABELS}
              defaultValue={(values.workMode ?? 'remote') as never}
            />
          </Field>

          <Field
            label="UTC offset"
            name="utcOffset"
            error={errors.utcOffset}
            hint="Working-day overlap is calculated from it"
          >
            <input
              id="utcOffset"
              name="utcOffset"
              type="number"
              min={-12}
              max={14}
              defaultValue={values.utcOffset ?? 1}
            />
          </Field>

          {showCapacity ? (
            <Field
              label="Free capacity, h/week"
              name="weeklyCapacityHours"
              error={errors.weeklyCapacityHours}
              hint="Zero means you are out of selection: the formula is a product"
            >
              <input
                id="weeklyCapacityHours"
                name="weeklyCapacityHours"
                type="number"
                min={0}
                max={60}
                defaultValue={values.weeklyCapacityHours ?? 20}
              />
            </Field>
          ) : (
            <input
              type="hidden"
              name="weeklyCapacityHours"
              value={values.weeklyCapacityHours ?? 20}
            />
          )}

          <Field
            label="Days before you can start on a task"
            name="leadTimeDays"
            error={errors.leadTimeDays}
          >
            <input
              id="leadTimeDays"
              name="leadTimeDays"
              type="number"
              min={0}
              max={120}
              defaultValue={values.leadTimeDays ?? 3}
            />
          </Field>
        </div>
      </fieldset>

      {errors.form && (
        <div className="note note-fail" style={{ marginBottom: 20 }}>
          {errors.form}
        </div>
      )}

      {/*
        Согласие показывается только там, где за формой сидит сам человек.
        В панели бюро форму заполняет оператор, и спрашивать согласие у него
        значило бы получать его не у того, чьи это данные.
      */}
      {askConsent && <Consent error={errors.consent} />}

      <Submit pending={pending}>{submitLabel}</Submit>
    </form>
  )
}

/** Одиночные значения defaults: множественные разбирает list(). */
function asText(defaults: Record<string, string | string[]>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(defaults).filter(([, v]) => typeof v === 'string'),
  ) as Record<string, string>
}
