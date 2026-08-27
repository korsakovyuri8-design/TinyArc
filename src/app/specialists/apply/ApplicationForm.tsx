'use client'

import { useActionState } from 'react'
import {
  CLIMATE_ZONES,
  DISCIPLINES,
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
  DOC_STAGE_LABELS,
  IFC_LABELS,
  MATERIAL_LABELS,
  REGULATORY_LABELS,
  SCALE_BAND_LABELS,
  SOFTWARE_LABELS,
  TYPOLOGY_LABELS,
  WORK_MODE_LABELS,
} from '@/lib/labels'
import { Choices, Field, Select, Submit } from '@/components/Fields'
import { submitApplication, type ApplicationState } from './actions'

export function ApplicationForm() {
  const [state, action, pending] = useActionState<ApplicationState, FormData>(
    submitApplication,
    {},
  )

  if (state.submitted) {
    return (
      <div className="panel panel-accent">
        <div className="label label-accent">Заявка принята</div>
        <h3 style={{ marginTop: 12 }}>Дальше — разбор портфолио</h3>
        <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
          Портфолио смотрит бюро и ставит рейтинг. Порог — {PORTFOLIO_THRESHOLD}/10; ниже него
          заявка не проходит, и это не обсуждается отдельно с каждым. Если проходите — ключ
          доступа придёт на указанный адрес.
        </p>
      </div>
    )
  }

  const errors = state.errors ?? {}
  const values = (state.values ?? {}) as Record<string, string>

  return (
    <form action={action}>
      <fieldset>
        <legend>Кто вы</legend>

        <div className="grid grid-2">
          <Field label="Имя для клиента" name="displayName" error={errors.displayName}>
            <input id="displayName" name="displayName" defaultValue={values.displayName ?? ''} />
          </Field>

          <Field label="Почта" name="email" error={errors.email} hint="Сюда придёт ключ доступа">
            <input id="email" name="email" type="email" defaultValue={values.email ?? ''} />
          </Field>
        </div>

        <Field
          label="Портфолио"
          name="portfolioUrl"
          error={errors.portfolioUrl}
          hint="Главный вход отбора: показанное весит больше заявленного"
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
        <legend>Что вы ведёте · измерения 1–4</legend>

        <Field label="Дисциплины" error={errors.disciplines}>
          <Choices name="disciplines" options={DISCIPLINES} labels={DISCIPLINE_LABELS} />
        </Field>

        <Field label="Типологии" error={errors.typologies}>
          <Choices name="typologies" options={TYPOLOGIES} labels={TYPOLOGY_LABELS} />
        </Field>

        <Field label="Масштаб" error={errors.scaleBands}>
          <Choices name="scaleBands" options={SCALE_BANDS} labels={SCALE_BAND_LABELS} />
        </Field>

        <Field
          label="Максимальная этажность"
          name="maxStoreys"
          error={errors.maxStoreys}
          hint="Только та, на которую есть подтверждённый опыт"
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
        <legend>Где и в чём · измерения 5–8</legend>

        <Field label="Материальные системы" error={errors.materialSystems}>
          <Choices name="materialSystems" options={MATERIAL_SYSTEMS} labels={MATERIAL_LABELS} />
        </Field>

        <Field label="Климатические зоны" error={errors.climateZones}>
          <Choices name="climateZones" options={CLIMATE_ZONES} labels={CLIMATE_LABELS} />
        </Field>

        <Field
          label="Юрисдикции"
          error={errors.jurisdictions}
          hint="Где вы реально проходили согласования"
        >
          <Choices name="jurisdictions" options={JURISDICTIONS} labels={JURISDICTION_NAMES} />
        </Field>

        <Field
          label="Право подписи"
          error={errors.signsIn}
          hint="Только страны из списка выше. Без подписи в стране проект не берётся вовсе"
        >
          <Choices name="signsIn" options={JURISDICTIONS} labels={JURISDICTION_NAMES} />
        </Field>

        <Field label="Софт" error={errors.software}>
          <Choices name="software" options={SOFTWARE} labels={SOFTWARE_LABELS} />
        </Field>

        <Field
          label="Уровень обмена по IFC"
          name="ifcLevel"
          error={errors.ifcLevel}
          hint="Общий формат заменяет общий пакет: с координацией по IFC вы совместимы с любой командой"
        >
          <Select name="ifcLevel" options={IFC_LEVELS} labels={IFC_LABELS} defaultValue="exchange" />
        </Field>
      </fieldset>

      <fieldset>
        <legend>Как вы работаете · измерения 9–12</legend>

        <Field label="Стадии документации" error={errors.docStages}>
          <Choices name="docStages" options={DOC_STAGES} labels={DOC_STAGE_LABELS} />
        </Field>

        <Field label="Регуляторный трек" error={errors.regulatoryTracks}>
          <Choices
            name="regulatoryTracks"
            options={REGULATORY_TRACKS}
            labels={REGULATORY_LABELS}
            defaultValue={['light']}
          />
        </Field>

        <Field
          label="Языки"
          error={errors.languages}
          hint="Для согласований язык органов — жёсткое требование"
        >
          <Choices name="languages" options={LANGUAGES} labels={LANGUAGE_NAMES} />
        </Field>

        <div className="grid grid-2">
          <Field label="Режим" name="workMode" error={errors.workMode}>
            <Select
              name="workMode"
              options={WORK_MODES}
              labels={WORK_MODE_LABELS}
              defaultValue="remote"
            />
          </Field>

          <Field
            label="Смещение от UTC"
            name="utcOffset"
            error={errors.utcOffset}
            hint="По нему считается пересечение рабочего дня"
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

          <Field
            label="Свободная ёмкость, ч/нед"
            name="weeklyCapacityHours"
            error={errors.weeklyCapacityHours}
            hint="Ноль означает, что в отборе вы не участвуете: формула — произведение"
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

          <Field
            label="Срок выхода на задачу, дней"
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

      <Submit pending={pending}>Подать заявку</Submit>
    </form>
  )
}
