'use server'

import { redirect } from 'next/navigation'
import { JURISDICTION_UTC_OFFSET } from '@/engine/taxonomy'
import { prisma } from '@/lib/db'
import { allow, spend } from '@/lib/guard'
import { assistant, assistantNote } from '@/lib/assist'
import { TEXT_MAX, bounded } from '@/lib/text'
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
  /** Что помощник разобрал и чего не нашёл. Показывается над формой. */
  read?: { missing: string[]; notes: string }
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
      // Пустое поле остаётся пустым, а не превращается в пустую строку и не в
      // нулевой участок: движок отличает «не знаем» от «ноль», и эта разница
      // и есть весь смысл проверки на нормы (п.7б).
      municipality: input.municipality || null,
      zone: input.zone || null,
      plotAreaSqm: input.plotAreaSqm > 0 ? input.plotAreaSqm : null,
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
    await sendAccessKey(
      project.clientEmail,
      'client',
      project.clientKey,
    )
  } catch (error) {
    console.error('Письмо с ключом не ушло:', error)
  }

  // Сначала направление, потом кабинет: выбор нужен команде до того, как
  // откроется первый тикет, а не когда по нему уже что-то нарисовали.
  redirect('/project/direction?issued=1')
}

/**
 * Разбор свободного описания в поля формы.
 *
 * Помощник заказчика (п.12а), и до сих пор он был написан, но никем не
 * вызывался: восьмая часть слоя, которую нельзя было отличить от работающей —
 * она есть в интерфейсе, покрыта заглушкой и проходит типы.
 *
 * Заполняются только те поля, которые в тексте названы прямо. Ненайденное
 * остаётся пустым и называется словами: пустое поле человек заполнит сам, а
 * угаданное — не заметит. Ничего не отправляется: разбор возвращает форму с
 * подставленными значениями, и отправляет её человек.
 */
export async function readDescription(_prev: BriefState, formData: FormData): Promise<BriefState> {
  const raw = fromFormData(formData, MULTI)
  const text = String(formData.get('description') ?? '').trim()

  if (!text) {
    return { errors: { description: 'Write a few lines about the project first.' }, values: raw }
  }

  /*
   * Расход наружу: форма публичная, и нажатие здесь стоит денег. Предел общий
   * с остальными обращениями к модели.
   */
  const verdict = await allow('assist')
  if (!verdict.allowed) {
    return { errors: { description: retryMessage(verdict.retryAfterSeconds) }, values: raw }
  }

  try {
    const parse = await assistant().parseBrief({ text: bounded(text, TEXT_MAX.spec) })

    /*
     * Разобранное ложится поверх набранного, а не наоборот: человек нажал
     * «прочитать», и результат чтения — это то, что он хотел увидеть. Но
     * ничего не стирается: поле, которого в тексте не было, остаётся таким,
     * каким он его оставил.
     */
    const filled: Record<string, unknown> = { ...raw, description: text }
    for (const [key, value] of Object.entries(parse.fields)) {
      if (value !== undefined && value !== null && value !== '') filled[key] = String(value)
    }

    if (parse.notes) filled.briefNotes = bounded(parse.notes, TEXT_MAX.line)

    return { values: filled, read: { missing: parse.missing, notes: parse.notes } }
  } catch (error) {
    console.error('Описание не разобрано:', error)

    return {
      values: { ...raw, description: text },
      errors: {
        description: assistantNote(error, 'Fill the fields in below — nothing has been lost.'),
      },
    }
  }
}
