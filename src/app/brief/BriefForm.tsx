'use client'

import { useActionState } from 'react'
import {
  CLIMATE_ZONES,
  DOC_STAGES,
  JURISDICTIONS,
  JURISDICTION_NAMES,
  LANGUAGES,
  LANGUAGE_NAMES,
  MATERIAL_SYSTEMS,
  MAX_STOREYS,
  REGULATORY_TRACKS,
  SOFTWARE,
  TYPOLOGIES,
} from '@/engine/taxonomy'
import {
  CLIMATE_LABELS,
  DOC_STAGE_LABELS,
  MATERIAL_LABELS,
  REGULATORY_LABELS,
  SOFTWARE_LABELS,
  TYPOLOGY_LABELS,
} from '@/lib/labels'
import { Choices, Field, Select, Submit } from '@/components/Fields'
import { submitBrief, type BriefState } from './actions'

export function BriefForm() {
  const [state, action, pending] = useActionState<BriefState, FormData>(submitBrief, {})
  const errors = state.errors ?? {}
  const values = (state.values ?? {}) as Record<string, string>

  return (
    <form action={action}>
      <fieldset>
        <legend>Проект</legend>

        <Field label="Название" name="title" error={errors.title}>
          <input id="title" name="title" defaultValue={values.title ?? ''} placeholder="Вилла в Тивате" />
        </Field>

        <div className="grid grid-2">
          <Field label="Типология" name="typology" error={errors.typology}>
            <Select name="typology" options={TYPOLOGIES} labels={TYPOLOGY_LABELS} defaultValue="villa" />
          </Field>

          <Field
            label="Этажей"
            name="storeys"
            error={errors.storeys}
            hint={`Bureau ведёт здания до ${MAX_STOREYS} этажей`}
          >
            <input id="storeys" name="storeys" type="number" min={1} max={60} defaultValue={values.storeys ?? 2} />
          </Field>

          <Field label="Площадь, м²" name="areaSqm" error={errors.areaSqm}>
            <input id="areaSqm" name="areaSqm" type="number" min={10} defaultValue={values.areaSqm ?? 400} />
          </Field>

          <Field label="Страна" name="jurisdiction" error={errors.jurisdiction}>
            <Select
              name="jurisdiction"
              options={JURISDICTIONS}
              labels={JURISDICTION_NAMES}
              defaultValue="ME"
            />
          </Field>

          <Field label="Климатическая зона" name="climateZone" error={errors.climateZone}>
            <Select
              name="climateZone"
              options={CLIMATE_ZONES}
              labels={CLIMATE_LABELS}
              defaultValue="mediterranean"
            />
          </Field>

          <Field label="Материальная система" name="materialSystem" error={errors.materialSystem}>
            <Select
              name="materialSystem"
              options={MATERIAL_SYSTEMS}
              labels={MATERIAL_LABELS}
              defaultValue="concrete"
            />
          </Field>

          <Field
            label="Регуляторный трек"
            name="regulatoryTrack"
            error={errors.regulatoryTrack}
            hint="Bureau работает в зонах лёгкого регулирования"
          >
            <Select
              name="regulatoryTrack"
              options={REGULATORY_TRACKS}
              labels={REGULATORY_LABELS}
              defaultValue="light"
            />
          </Field>

          <Field label="Стадия документации" name="targetStage" error={errors.targetStage}>
            <Select
              name="targetStage"
              options={DOC_STAGES}
              labels={DOC_STAGE_LABELS}
              defaultValue="permit"
            />
          </Field>
        </div>
      </fieldset>

      <fieldset>
        <legend>Условия работы</legend>

        <Field
          label="Софт"
          error={errors.software}
          hint="Если нет требований — не отмечайте ничего: обмен пойдёт по IFC"
        >
          <Choices name="software" options={SOFTWARE} labels={SOFTWARE_LABELS} />
        </Field>

        <Field label="Языки" error={errors.languages} hint="На чём вам удобно разговаривать">
          <Choices name="languages" options={LANGUAGES} labels={LANGUAGE_NAMES} defaultValue={['en']} />
        </Field>

        <div className="grid grid-2">
          <Field
            label="Занятость, ч/нед"
            name="requiredHoursPerWeek"
            error={errors.requiredHoursPerWeek}
            hint="Сколько времени специалиста нужно проекту"
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
            label="Горизонт, дней"
            name="horizonDays"
            error={errors.horizonDays}
            hint="За сколько дней команда должна выйти на задачу"
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
        <legend>Контакт</legend>

        <div className="grid grid-2">
          <Field label="Как к вам обращаться" name="clientName" error={errors.clientName}>
            <input id="clientName" name="clientName" defaultValue={values.clientName ?? ''} />
          </Field>

          <Field
            label="Почта"
            name="clientEmail"
            error={errors.clientEmail}
            hint="Ключ доступа к кабинету придёт сюда"
          >
            <input id="clientEmail" name="clientEmail" type="email" defaultValue={values.clientEmail ?? ''} />
          </Field>
        </div>

        <Field
          label="Что важно знать про участок"
          name="briefNotes"
          error={errors.briefNotes}
          hint="Команде это выдаётся в объёме задачи, а не целиком"
        >
          <textarea id="briefNotes" name="briefNotes" defaultValue={values.briefNotes ?? ''} />
        </Field>
      </fieldset>

      <div className="row" style={{ gap: 16 }}>
        <Submit pending={pending}>Собрать команду</Submit>
        <span className="dim" style={{ fontSize: '0.85rem' }}>
          Движок посчитает сразу — без «мы с вами свяжемся»
        </span>
      </div>
    </form>
  )
}
