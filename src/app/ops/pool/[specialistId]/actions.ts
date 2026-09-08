'use server'

import { revalidatePath } from 'next/cache'
import {
  applicationSchema,
  everyDisciplineCovered,
  fieldErrors,
  fromFormData,
  signaturesWithinJurisdictions,
  specializationsWithinDisciplines,
} from '@/lib/forms'
import type { ApplicationState } from '@/app/specialists/apply/actions'
import { prisma } from '@/lib/db'
import { seatOf } from '@/lib/seat'
import { toList } from '@/lib/rows'
import { isOperator } from '@/lib/session'
import { SUBSCRIPTIONS, type Subscription } from '@/engine/taxonomy'

const MULTI = [
  'disciplines',
  'specializations',
  'typologies',
  'scaleBands',
  'materialSystems',
  'climateZones',
  'jurisdictions',
  'signsIn',
  'software',
  'docStages',
  'regulatoryTracks',
  'languages',
]

/**
 * Правка профиля специалиста бюро.
 *
 * Кабинет специалиста говорит ему: «изменить эти поля можно через бюро» — и до
 * сих пор это было обещанием без исполнителя. Ошибка в юрисдикции или в пакете
 * не исправлялась никем: человек не имеет права, а у бюро не было экрана.
 *
 * Что здесь можно и чего нельзя. Можно — двенадцать измерений таксономии:
 * это факты о человеке, и факты уточняются. Нельзя — рейтинг портфолио: он
 * ставится разбором и меняется там же, отдельным действием, чтобы правка
 * фактов не превращалась незаметно в правку балла. Нельзя ёмкость и статус
 * доступности: своим временем распоряжается специалист, и это единственное,
 * чем он управляет напрямую.
 *
 * Проверки те же, что на публичной заявке. Оператор — не повод пропускать
 * контроль: специализация не из своей дисциплины ломает отбор одинаково,
 * кто бы её ни ввёл.
 */
export async function editSpecialist(
  _prev: ApplicationState,
  formData: FormData,
): Promise<ApplicationState> {
  if (!(await isOperator())) return { errors: { form: 'The bureau panel is closed.' } }

  const id = String(formData.get('specialistId') ?? '')
  const row = await prisma.specialist.findUnique({ where: { id } })
  if (!row) return { errors: { form: 'Specialist not found.' } }

  // Имя и адрес — опознание человека, а не его характеристика. Меняются
  // отдельно и осознанно, а не заодно с уточнением специализации.
  const raw = { ...fromFormData(formData, MULTI), displayName: row.displayName, email: row.email }
  const parsed = applicationSchema.safeParse(raw)

  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw }

  const input = parsed.data

  if (!signaturesWithinJurisdictions(input)) {
    return {
      errors: { signsIn: 'Signing rights only where the person has worked.' },
      values: raw,
    }
  }

  if (!specializationsWithinDisciplines(input)) {
    return {
      errors: { specializations: 'A specialisation must belong to a declared discipline.' },
      values: raw,
    }
  }

  if (!everyDisciplineCovered(input)) {
    return {
      errors: { specializations: 'In each discipline, mark what exactly the person does.' },
      values: raw,
    }
  }

  await prisma.specialist.update({
    where: { id },
    data: {
      portfolioUrl: input.portfolioUrl,
      disciplinesJson: toList(input.disciplines),
      specializationsJson: toList(input.specializations),
      typologiesJson: toList(input.typologies),
      scaleBandsJson: toList(input.scaleBands),
      maxStoreys: input.maxStoreys,
      materialSystemsJson: toList(input.materialSystems),
      climateZonesJson: toList(input.climateZones),
      jurisdictionsJson: toList(input.jurisdictions),
      signsInJson: toList(input.signsIn),
      softwareJson: toList(input.software),
      ifcLevel: input.ifcLevel,
      docStagesJson: toList(input.docStages),
      regulatoryTracksJson: toList(input.regulatoryTracks),
      languagesJson: toList(input.languages),
      workMode: input.workMode,
      utcOffset: input.utcOffset,
      leadTimeDays: input.leadTimeDays,
      // Ёмкость и статус доступности сюда не попадают намеренно: временем
      // человека распоряжается человек. Форма их спрашивает — значение
      // отбрасывается здесь, а не прячется в разметке.
    },
  })

  revalidatePath('/ops/pool')
  revalidatePath(`/ops/pool/${id}`)

  return { submitted: true }
}

/**
 * Смена подписки на доступ к проектам.
 *
 * Отдельным действием, а не полем в форме профиля, по той же причине, по
 * которой отдельно стоит рейтинг: правка фактов о человеке не должна
 * незаметно превращаться в правку его доступа. Это два разных решения, и
 * принимаются они в разные моменты.
 */
export async function setSubscription(
  _prev: { error?: string; message?: string },
  formData: FormData,
): Promise<{ error?: string; message?: string }> {
  if (!(await isOperator())) return { error: 'The bureau panel is closed.' }

  const specialistId = String(formData.get('specialistId') ?? '')
  const value = String(formData.get('subscription') ?? '')

  if (!SUBSCRIPTIONS.includes(value as Subscription)) {
    return { error: 'Unknown subscription state.' }
  }

  const person = await prisma.specialist.update({
    where: { id: specialistId },
    data: { subscription: value },
  })

  revalidatePath(`/ops/pool/${specialistId}`)
  revalidatePath('/ops/pool')
  // И панель: человек уходит из очереди ожидающих открытия доступа или
  // встаёт в неё, а очередь, отставшая на одно нажатие, зовёт нажать ещё раз.
  revalidatePath('/ops')

  if (value === 'none') {
    return { message: 'Access closed: this person will not appear in the next selection runs.' }
  }

  /*
   * «Доступ открыт» и «человек в отборе» — разные утверждения. Открытый доступ
   * ничего не даёт тому, у кого ноль свободных часов или портфолио ниже порога:
   * оператор нажал, прочитал «открыто» и ушёл, а человек как не появлялся в
   * прогонах, так и не появляется. Что осталось в пути, считает та же функция,
   * что говорит причину ему самому.
   */
  const seat = seatOf(person)

  return {
    message: seat.inSelection
      ? 'Access open: they take part in selection from the next run. This does not reassemble teams already put together.'
      : `Access open, but they still will not appear in runs: ${seat.headline.toLowerCase()}. This does not reassemble teams already put together.`,
  }
}
