/**
 * Соответствие нормам: правила юрисдикции и проверка проекта против них.
 *
 * Это слой, ради которого бюро перестаёт быть нужным. Большая часть отказов
 * органа приходится не на инженерию, а на посадку: высота, отступы, процент
 * застройки, парковка, озеленение. Всё это проверяемо арифметикой, и до сих
 * пор проверялось человеком, который держит правила в голове и берёт за это
 * часы.
 *
 * Три решения, на которых стоит весь слой.
 *
 * **Правило принадлежит области, а не стране.** Модель europewide с первого
 * дня: страна, муниципалитет, зона. Черногория нигде не зашита. Иначе вторая
 * юрисдикция означала бы переписывание, а не наполнение.
 *
 * **Слои ведут себя по-разному, и это не деталь.** Конструкции, энергетика и
 * пожарные нормы обобщаются на всю Европу (Еврокоды с национальными
 * приложениями, EPBD, EN), пишутся один раз. Зонирование не обобщается
 * никогда: оно живёт на уровне муниципалитета, а иногда квартала. Смешать их в
 * одну таблицу значит однажды применить сербский отступ в Баре.
 *
 * **Незнание называется незнанием.** У проверки четыре исхода, а не два:
 * прошло, не прошло, не хватает данных, правило устарело. Молчаливое «прошло»
 * там, где нам просто нечем проверить,, это ровно тот способ, которым база
 * норм превращается из актива в мину: комплект уходит в орган с нашей
 * подписью под непроверенным.
 */

import type { Jurisdiction } from './taxonomy'

/** Слой нормы. Определяет, обобщается она за пределы страны или нет. */
export const RULE_LAYERS = ['zoning', 'structural', 'energy', 'fire', 'accessibility'] as const
export type RuleLayer = (typeof RULE_LAYERS)[number]

/**
 * Обобщается ли слой за пределы одной страны.
 *
 * Не украшение: от этого зависит, куда класть правило и сколько стоит открыть
 * следующую страну. Зонирование придётся набирать заново в каждом
 * муниципалитете; конструкции, переиспользовать с национальным приложением.
 */
export const LAYER_GENERALISES: Record<RuleLayer, boolean> = {
  zoning: false,
  structural: true,
  energy: true,
  fire: true,
  accessibility: true,
}

/** Что именно ограничивает правило. Список закрыт: свободный текст непроверяем. */
export const RULE_SUBJECTS = [
  'storeys',
  'height_m',
  'coverage_ratio',
  'floor_area_ratio',
  'setback_front_m',
  'setback_side_m',
  'setback_rear_m',
  'parking_per_unit',
  'green_ratio',
  /*
   * Расстояние до ближайшего соседнего здания.
   *
   * Отдельно от трёх отступов, и это не дублирование: отступ меряется от
   * границы участка, а это, от чужой стены. Здание может стоять с запасом от
   * границы и всё равно оказаться слишком близко к соседнему, если тот тоже
   * отступил мало. В Италии это самый жёсткий предел вообще, десять метров
   * между окнами противостоящих зданий, и суды считают его от любой точки
   * здания, а не только от участков стены напротив окон.
   */
  'distance_to_building_m',
  /*
   * Чистая высота помещения.
   *
   * Единственное требование к помещениям, которое имеет смысл на уровне
   * проекта: остальные, площадь спальни, доля остекления, считаются по
   * каждой комнате, и в корпусе, где правило описывает объект целиком, им
   * места нет.
   */
  'ceiling_height_m',
] as const
export type RuleSubject = (typeof RULE_SUBJECTS)[number]

/** Факт проекта, которым проверяется предмет правила. */
export const SUBJECT_INPUT: Record<RuleSubject, keyof SiteFacts> = {
  storeys: 'storeys',
  height_m: 'heightM',
  coverage_ratio: 'coverageRatio',
  floor_area_ratio: 'floorAreaRatio',
  setback_front_m: 'setbackFrontM',
  setback_side_m: 'setbackSideM',
  setback_rear_m: 'setbackRearM',
  parking_per_unit: 'parkingPerUnit',
  green_ratio: 'greenRatio',
  distance_to_building_m: 'distanceToBuildingM',
  ceiling_height_m: 'ceilingHeightM',
}

export type RuleOperator = 'max' | 'min'

/**
 * Откуда правило взято.
 *
 * Обязательная часть, а не примечание. Правило без первоисточника нечем
 * защитить перед органом и нечем перепроверить, когда норма изменится,, а она
 * изменится. `checkedAt`, когда мы последний раз сверяли с первоисточником, и
 * именно он, а не дата вступления в силу, решает, доверяем ли мы записи.
 */
export type RuleSource = {
  /** Документ: закон, план, регламент. */
  document: string
  /** Статья или пункт внутри документа. */
  article: string
  /** С какого числа норма действует. ISO. */
  effectiveFrom: string
  /** Когда мы в последний раз сверили запись с первоисточником. ISO. */
  checkedAt: string
  url?: string
}

/**
 * Область действия правила.
 *
 * Уже, сильнее: правило зоны перекрывает правило муниципалитета, оно
 * перекрывает страновое. Так устроено само планирование, и так же обязана быть
 * устроена запись, иначе страновое значение будет молча применяться там, где
 * местный план говорит другое.
 */
export type RuleScope = {
  jurisdiction: Jurisdiction
  municipality?: string
  zone?: string
  /**
   * Участок: самый узкий уровень, и в Черногории, единственный обязывающий.
   *
   * Орган выдаёт условия не на зону, а на локацию: УТУ называет предельные
   * заузетость, изграђеност и спратност для конкретной парцелы и действует,
   * пока действует план, на котором выдан. Значит правило зоны, это прогноз
   * («так обычно бывает в этой зоне»), а УТУ, факт по этому проекту.
   *
   * Заведено уровнем области, а не отдельным перекрытием, и это не вкусовое
   * решение. Перекрытие означало бы вторую механику разрешения конфликтов
   * рядом с уже работающей, а факт стал бы исключением из прогноза. Здесь
   * ничего нового не появилось: «уже, сильнее» просто продолжено на шаг.
   */
  parcel?: string
}

export type Rule = {
  id: string
  layer: RuleLayer
  scope: RuleScope
  subject: RuleSubject
  operator: RuleOperator
  value: number
  source: RuleSource
}

/**
 * Что мы знаем об участке и объёме.
 *
 * Половины этих полей бриф сегодня не спрашивает, и это не упущение модели, а
 * найденное ею требование к продукту: проверить посадку, не зная площади
 * участка, нельзя. Отсутствующее поле даёт исход `needs_input` с именем того,
 * чего не хватило,, заказчику это говорит, что принести, а нам, что добавить
 * в бриф.
 */
export type SiteFacts = {
  jurisdiction: Jurisdiction
  municipality?: string
  zone?: string
  /** Кадастровый номер парцелы: то, на что выдан УТУ. */
  parcel?: string
  storeys?: number
  heightM?: number
  /** Доля пятна застройки от площади участка, 0…1. */
  coverageRatio?: number
  /** Отношение суммарной площади этажей к площади участка. */
  floorAreaRatio?: number
  setbackFrontM?: number
  setbackSideM?: number
  setbackRearM?: number
  parkingPerUnit?: number
  /** Доля озеленения от площади участка, 0…1. */
  greenRatio?: number
  /** До ближайшего соседнего здания, метров. Не до границы, до чужой стены. */
  distanceToBuildingM?: number
  /** Чистая высота помещения, метров. */
  ceilingHeightM?: number
}

export type Verdict = 'pass' | 'fail' | 'needs_input'

export type Finding = {
  rule: Rule
  verdict: Verdict
  /** Устарела ли сверка с первоисточником. Устаревшее правило не блокирует. */
  stale: boolean
  /** Значение проекта, если оно было. */
  actual?: number
  /** Имя недостающего факта, когда проверить было нечем. */
  missing?: string
}

/**
 * Через сколько дней без сверки правило перестаёт считаться проверенным.
 *
 * Год, не про частоту изменений, а про то, за какой срок незамеченное
 * изменение успевает уйти в комплект. Устаревшее правило не исчезает и не
 * блокирует: оно показывается с пометкой, потому что «правила нет» и «правило
 * не сверено», разные сообщения бюро.
 */
export const STALE_AFTER_DAYS = 365

const DAY = 86_400_000

export function isStale(source: RuleSource, now: Date): boolean {
  const checked = Date.parse(source.checkedAt)
  if (Number.isNaN(checked)) return true
  return now.getTime() - checked > STALE_AFTER_DAYS * DAY
}

/** Насколько узко правило: чем больше, тем сильнее. */
function specificity(scope: RuleScope): number {
  if (scope.parcel) return 4
  if (scope.zone) return 3
  if (scope.municipality) return 2
  return 1
}

function applies(rule: Rule, facts: SiteFacts): boolean {
  const { scope } = rule
  if (scope.jurisdiction !== facts.jurisdiction) return false
  if (scope.municipality && scope.municipality !== facts.municipality) return false
  if (scope.zone && scope.zone !== facts.zone) return false
  if (scope.parcel && scope.parcel !== facts.parcel) return false
  return true
}

/**
 * Правила, действующие на участке, по одному на предмет.
 *
 * Побеждает самое узкое. При равной узости, то, что вступило в силу позже:
 * два действующих правила одного уровня на один предмет означают, что старое
 * заменено, а мы этого ещё не записали.
 */
export function rulesFor(all: Rule[], facts: SiteFacts): Rule[] {
  const strongest = new Map<RuleSubject, Rule>()

  for (const rule of all) {
    if (!applies(rule, facts)) continue

    const current = strongest.get(rule.subject)
    if (!current) {
      strongest.set(rule.subject, rule)
      continue
    }

    const better =
      specificity(rule.scope) - specificity(current.scope) ||
      Date.parse(rule.source.effectiveFrom) - Date.parse(current.source.effectiveFrom)

    if (better > 0) strongest.set(rule.subject, rule)
  }

  return [...strongest.values()].sort((a, b) => a.subject.localeCompare(b.subject))
}

/** Проверяет проект против правил участка. */
export function check(all: Rule[], facts: SiteFacts, now = new Date()): Finding[] {
  return rulesFor(all, facts).map((rule) => {
    const field = SUBJECT_INPUT[rule.subject]
    const actual = facts[field]
    const stale = isStale(rule.source, now)

    if (typeof actual !== 'number') {
      return { rule, verdict: 'needs_input' as const, stale, missing: field }
    }

    const passed = rule.operator === 'max' ? actual <= rule.value : actual >= rule.value

    return { rule, verdict: passed ? ('pass' as const) : ('fail' as const), stale, actual }
  })
}

/**
 * Что останавливает подачу.
 *
 * Блокирует только сверенное правило: устаревшее говорит о нашей работе, а не
 * о проекте заказчика, и останавливать его им нечестно. Такое правило —
 * задача бюро сверить, и она видна в панели, а не молчит.
 */
export function blocking(findings: Finding[]): Finding[] {
  return findings.filter((f) => f.verdict === 'fail' && !f.stale)
}

/** Чего не хватило, чтобы проверить. Именами полей, без повторов. */
export function missingInputs(findings: Finding[]): string[] {
  return [...new Set(findings.flatMap((f) => (f.missing ? [f.missing] : [])))].sort()
}
