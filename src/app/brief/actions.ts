'use server'

import { localeHref } from '@/lib/i18n/redirect'
import { redirect } from 'next/navigation'
import { JURISDICTION_UTC_OFFSET } from '@/engine/taxonomy'
import { prisma } from '@/lib/db'
import { allow, spend } from '@/lib/guard'
import { retryMessage } from '@/lib/rate-limit'
import { accessKey, briefSchema, fieldErrors, fromFormData } from '@/lib/forms'
import { LEGAL_VERSION } from '@/lib/legal'
import { toList } from '@/lib/rows'
import { sendAccessKey } from '@/lib/mail'
import { prepareDirections } from '@/lib/services/direction'
import { runAssembly } from '@/lib/services/matching'
import { signInClient } from '@/lib/session'

export type BriefState = {
  errors?: Record<string, string>
  values?: Record<string, unknown>
}

const MULTI = ['software', 'languages']

export async function submitBrief(_prev: BriefState, formData: FormData): Promise<BriefState> {
  // Одна отправка запускает прогон по всему пулу и пишет сотни строк. Без
  // ограничения публичная форма стоит отправителю нажатия, а нам — прогона.
  const verdict = await allow('brief')
  if (!verdict.allowed) {
    return { errors: { form: retryMessage(verdict.retryAfterSeconds) }, values: fromFormData(formData, MULTI) }
  }

  const raw = fromFormData(formData, MULTI)
  const parsed = briefSchema.safeParse(raw)

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values: raw }
  }

  const input = parsed.data

  // Форма прошла проверки — дальше начинается дорогое: прогон по всему пулу и
  // сотни строк в базе. Вот за это и списывается бюджет, а не за опечатку.
  await spend('brief')

  const project = await prisma.project.create({
    data: {
      clientKey: accessKey('brief'),
      // Согласие вместе с редакцией: см. src/lib/legal.ts.
      consentAt: new Date(),
      consentVersion: LEGAL_VERSION,
      title: input.title,
      clientName: input.clientName,
      clientEmail: input.clientEmail,
      typology: input.typology,
      storeys: input.storeys,
      areaSqm: input.areaSqm,
      jurisdiction: input.jurisdiction,
      climateZone: input.climateZone,
      materialSystem: input.materialSystem,
      regulatoryTrack: input.regulatoryTrack,
      targetStage: input.targetStage,
      terrain: input.terrain,
      gridConnection: input.gridConnection,
      softwareJson: toList(input.software),
      languagesJson: toList(input.languages),
      requiredHoursPerWeek: input.requiredHoursPerWeek,
      horizonDays: input.horizonDays,
      // Часовой пояс — это пояс стройки, а не клиента: спрашивать его незачем.
      utcOffset: JURISDICTION_UTC_OFFSET[input.jurisdiction],
      briefNotes: input.briefNotes,
    },
  })

  // Сборка запускается сразу: клиент должен увидеть решение движка, а не
  // сообщение «мы с вами свяжемся».
  await runAssembly(project.id)

  // Направления готовятся после сборки и на неё не влияют: состав команды
  // определяется инженерией проекта, а не тем, какой облик ближе клиенту.
  await prepareDirections(project.id)

  await signInClient(project.id)

  // Письмо — это удобство, а не единственный путь: ключ показывается на
  // экране следующим шагом. Поэтому упавшая почта не должна ронять бриф,
  // над которым человек только что сидел двадцать минут.
  try {
    await sendAccessKey(project.clientEmail, 'client', project.clientKey)
  } catch (error) {
    console.error('Письмо с ключом не ушло:', error)
  }

  // Сначала направление, потом кабинет: выбор нужен команде до того, как
  // откроется первый тикет, а не когда по нему уже что-то нарисовали.
  redirect(await localeHref('/project/direction?issued=1'))
}
