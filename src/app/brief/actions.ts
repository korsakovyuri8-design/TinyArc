'use server'

import { redirect } from 'next/navigation'
import { JURISDICTION_UTC_OFFSET } from '@/engine/taxonomy'
import { prisma } from '@/lib/db'
import { accessKey, briefSchema, fieldErrors, fromFormData } from '@/lib/forms'
import { toList } from '@/lib/rows'
import { runAssembly } from '@/lib/services/matching'
import { signInClient } from '@/lib/session'

export type BriefState = {
  errors?: Record<string, string>
  values?: Record<string, unknown>
}

const MULTI = ['software', 'languages']

export async function submitBrief(_prev: BriefState, formData: FormData): Promise<BriefState> {
  const raw = fromFormData(formData, MULTI)
  const parsed = briefSchema.safeParse(raw)

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values: raw }
  }

  const input = parsed.data

  const project = await prisma.project.create({
    data: {
      clientKey: accessKey('brief'),
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
  await signInClient(project.id)

  redirect('/project')
}
