/**
 * Настройки бюро: числа, задающие политику.
 *
 * Каждый ключ объявлен здесь с причиной своего существования. Ключ без
 * объявления — это место, куда дописывают то, что не продумали, и через
 * полгода никто не помнит, что оно значит и кто его поставил.
 *
 * Пустое значение — рабочее состояние, а не недоделка. Политика, которую
 * бюро ещё не назвало, не должна подставляться числом по умолчанию: цифра,
 * взявшаяся сама, ведёт себя как решение, которого никто не принимал.
 */

import { prisma } from '../db'

/**
 * Какая доля цены стадии уходит команде.
 *
 * Из неё считается потолок на гонорары: цена комплекта × доля. Пока не
 * задана, бюджетного гейта не существует вовсе — состав собирается как
 * собирался, и об этом сказано в панели. Это честнее умолчания: доля,
 * взявшаяся из воздуха, начала бы отсеивать людей по цене, которую бюро не
 * называло.
 */
export const TEAM_SHARE = 'team_budget_share'

export class SettingRefused extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SettingRefused'
  }
}

/** Доля, идущая команде, 0…1. `null` — не задана. */
export async function teamShare(): Promise<number | null> {
  const row = await prisma.setting.findUnique({ where: { key: TEAM_SHARE } })
  if (!row) return null

  const value = Number(row.value)
  return Number.isFinite(value) && value > 0 && value <= 1 ? value : null
}

export async function setTeamShare(value: number): Promise<void> {
  /*
   * Ноль и единица отвергаются с разных сторон. Ноль означал бы, что команде
   * не достаётся ничего, — то есть ни один состав не собирается, и продукт
   * встал бы молча. Больше единицы означало бы, что бюро платит больше, чем
   * получает, и это не политика, а опечатка.
   */
  if (!Number.isFinite(value) || value <= 0 || value > 1) {
    throw new SettingRefused('The share is a number above zero and no more than one.')
  }

  await prisma.setting.upsert({
    where: { key: TEAM_SHARE },
    create: { key: TEAM_SHARE, value: String(value) },
    update: { value: String(value) },
  })
}

/** Снять долю: бюджетный гейт выключается, состав собирается как раньше. */
export async function clearTeamShare(): Promise<void> {
  await prisma.setting.deleteMany({ where: { key: TEAM_SHARE } })
}

/**
 * До какой даты доступ специалиста бесплатный.
 *
 * Пилот — состояние временное по определению: бесплатный доступ без конца
 * это не пилот, а цена. Поэтому здесь дата, а не переключатель. Переключатель
 * выключают, вспомнив о нём, — а о бесплатном никто не вспоминает: жалоб на
 * него не бывает, и он тихо переживает и пилот, и год после него.
 *
 * До этого дня новый специалист заводится с открытым доступом, после —
 * закрытым, и открывает его бюро руками (приём платежей ещё не подключён).
 * Дата на уже заведённых не отражается: истёкший пилот никого не выкидывает
 * из отбора — иначе одна настройка сняла бы с проектов живые команды, а
 * замена выпавшему не нашлась бы по тому же гейту. Кто пришёл бесплатно, тот
 * бесплатным и остаётся, пока бюро не решит иначе по каждому.
 */
export const PILOT_UNTIL = 'pilot_free_access_until'

/** Конец бесплатного доступа. `null` — бесплатного доступа нет вовсе. */
export async function pilotUntil(): Promise<Date | null> {
  const row = await prisma.setting.findUnique({ where: { key: PILOT_UNTIL } })
  if (!row) return null

  const date = new Date(row.value)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function setPilotUntil(value: Date): Promise<void> {
  /*
   * Дата в прошлом отвергается: она означала бы «пилот кончился вчера», и
   * записать её можно только по ошибке — тот, кто хочет закончить пилот
   * сегодня, снимает настройку, а не датирует её задним числом. Разница
   * важна: снятая настройка видна в панели словами, а прошедшая дата
   * выглядит настроенным пилотом и читается как работающий.
   */
  if (Number.isNaN(value.getTime())) {
    throw new SettingRefused('The date is not a date.')
  }

  if (value.getTime() <= Date.now()) {
    throw new SettingRefused('A pilot that ended is not a pilot: remove the date instead of dating it into the past.')
  }

  await prisma.setting.upsert({
    where: { key: PILOT_UNTIL },
    create: { key: PILOT_UNTIL, value: value.toISOString() },
    update: { value: value.toISOString() },
  })
}

/** Закончить пилот: новые приходят без доступа. Уже пришедших это не трогает. */
export async function clearPilotUntil(): Promise<void> {
  await prisma.setting.deleteMany({ where: { key: PILOT_UNTIL } })
}

/**
 * Какой доступ получает вновь заведённый специалист.
 *
 * Спрашивается на каждом пути, которым появляется человек: заявка и импорт
 * базы. Раньше это стояло умолчанием в схеме — то есть решение о цене
 * продукта принимала строка `@default("founding")`, которую не видно ни из
 * панели, ни из кода, который заводит человека. Умолчание в схеме кончается
 * только выкладкой, а вопрос «кому мы раздаём бесплатно» задаётся раньше, чем
 * бюро успевает собрать релиз.
 */
export async function newcomerAccess(): Promise<'founding' | 'none'> {
  return accessOnPilot(await pilotUntil(), new Date())
}

/**
 * Само решение, без базы: до какого дня бесплатно и какое сегодня число.
 *
 * Вынесено отдельно ради границы. Момент истечения проверить прогоном нельзя —
 * пилот, кончающийся ровно сейчас, на стенде не воспроизводится, — а ошибка
 * на границе стоит либо раздачи доступа лишний день, либо отказа человеку,
 * пришедшему в последний день пилота.
 */
export function accessOnPilot(until: Date | null, now: Date): 'founding' | 'none' {
  // Строго больше: день, названный концом, ещё бесплатный целиком — граница
  // хранится моментом времени, и «до 31 декабря» записывается концом суток.
  return until !== null && until.getTime() > now.getTime() ? 'founding' : 'none'
}
