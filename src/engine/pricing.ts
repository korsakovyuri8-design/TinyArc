/**
 * Цена стадии (концепт, п.14).
 *
 * Считается здесь, а не в базе и не на странице, по той же причине, что и
 * отбор: цену обязан уметь объяснить движок. «Сколько будет стоить», первый
 * вопрос заказчика, и ответ «бюро посчитает и скажет» возвращает нас ровно к
 * тому порядку, который мы заменяем: непрозрачная смета, которую нельзя
 * проверить и не с чем сравнить.
 *
 * Поэтому функция чистая и возвращает не число, а разбор: ставка, площадь,
 * множители и порог. Число без разбора, это счёт, который можно только
 * принять на веру.
 *
 * Цифры ниже, начальные, а не результат исследования рынка. Они рассчитаны
 * на то, чтобы их поправил пилот; менять их надо здесь, вместе с тестом, а не
 * скидкой в переписке.
 */

import { DOC_STAGE_ORDER, type DocStage, type Jurisdiction, type Typology } from './taxonomy'

/** Валюта одна: и Черногория, и Греция в евро, Сербия считает проекты в нём же. */
export const CURRENCY = 'EUR'

/**
 * Ставка за квадратный метр по стадиям.
 *
 * Разрешение дороже концепции не из-за объёма чертежей, а из-за
 * ответственности: под ним стоит подпись, и переделка после отказа органа
 * стоит дороже самой стадии.
 *
 * Ставки поставлены не от себя, а от местного ориентира. Инженерная палата
 * Черногории называет для главного проекта порядка 16 €/м² брутто; идейное
 * решение на рынке идёт отдельно и обходится примерно в 6 €/м². Наши 13 и 5 —
 * это те же работы примерно на пятую часть дешевле, и это ровно обещание
 * продукта: чуть дешевле среднего бюро, а не вдвое.
 *
 * Вдвое дешевле мы и не можем: разницу между нами и местным бюро даёт не
 * скидка, а глобальный пул (taxonomy.ts, LOCAL_ONLY_DISCIPLINES), считает
 * тот, кто свободен и берёт меньше, где бы он ни жил. Скидка съедала бы
 * гонорар, то есть саму команду. Прежние 4 и 10 были ниже местного рынка на
 * треть и не покрывали расход по стороне гонораров вовсе.
 *
 * Цифры остаются начальными и ждут пилота: правятся здесь вместе с тестом.
 */
const RATE_PER_SQM: Record<DocStage, number> = {
  concept: 5,
  permit: 13,
  tender: 8,
  construction: 6,
}

/**
 * Нижняя граница чека за стадию.
 *
 * Маленький объект не означает мало работы: посадка на участок, согласования и
 * координация команды на вилле в 120 м² стоят почти столько же, сколько на
 * вилле в 400 м². Без порога маленькие проекты работают в убыток, а отказаться
 * от них после брифа, хуже, чем назвать честную цену сразу.
 */
const FLOOR: Record<DocStage, number> = {
  concept: 900,
  permit: 2200,
  tender: 1800,
  construction: 1400,
}

/**
 * Множитель типологии.
 *
 * Растёт не с площадью, площадь уже учтена ставкой,, а с числом владельцев.
 * Общие системы, общее имущество и согласование с несколькими сторонами
 * добавляют работу, которой у отдельно стоящего дома нет вовсе.
 */
const TYPOLOGY_FACTOR: Record<Typology, number> = {
  villa: 1,
  townhouse: 1.05,
  multi_family: 1.2,
  mixed_use: 1.3,
}

/**
 * Множитель страны.
 *
 * Это уровень цен рынка, а не оценка сложности: одна и та же вилла в Греции
 * стоит дороже, чем в Сербии, потому что там дороже всё.
 *
 * Скажу прямо о качестве этих чисел, потому что они попадут в счёт заказчику.
 * За единицу взята Черногория, где ориентир есть: Инженерная палата называет
 * около 16 €/м² за главный проект. Сербия и Греция выставлены относительно неё
 * и тоже ждут пилота. **Остальные двадцать семь, оценка по общему уровню цен
 * в стране, не по расценкам проектирования.** Ни одна из них не сверена ни с
 * палатой, ни с живым проектировщиком.
 *
 * Список остаётся исчерпывающим намеренно: умолчание в единицу спрятало бы
 * незаполненную страну и выставило бы норвежский проект по черногорской цене.
 * Пусть лучше добавление страны требует явного решения о её цене.
 */
const JURISDICTION_FACTOR: Record<Jurisdiction, number> = {
  // Западные Балканы: есть ориентир.
  ME: 1,
  RS: 0.9,
  // Юго-Восточная и Центральная Европа.
  BG: 0.85,
  RO: 0.9,
  HU: 0.95,
  HR: 1,
  PL: 1,
  LV: 1,
  LT: 1,
  SK: 1,
  CZ: 1.05,
  EE: 1.05,
  SI: 1.1,
  PT: 1.1,
  GR: 1.15,
  CY: 1.15,
  MT: 1.2,
  ES: 1.2,
  IT: 1.3,
  // Западная Европа.
  BE: 1.5,
  AT: 1.5,
  DE: 1.5,
  FR: 1.5,
  NL: 1.6,
  FI: 1.6,
  IE: 1.7,
  SE: 1.7,
  LU: 1.8,
  IS: 1.8,
  DK: 1.9,
  LI: 1.9,
  NO: 2,
}

export type PriceBasis = {
  stage: DocStage
  currency: string
  /** Итог в целых единицах валюты: копейки в счёте за проект, это шум. */
  amount: number
  ratePerSqm: number
  areaSqm: number
  typologyFactor: number
  jurisdictionFactor: number
  floor: number
  /** Сработал ли порог: по нему видно, что цена не выведена из площади. */
  atFloor: boolean
}

export type PricedProject = {
  typology: Typology
  jurisdiction: Jurisdiction
  areaSqm: number
  targetStage: DocStage
}

/** Цена одной стадии с разбором, из которого она сложилась. */
export function priceStage(project: PricedProject, stage: DocStage): PriceBasis {
  const ratePerSqm = RATE_PER_SQM[stage]
  const typologyFactor = TYPOLOGY_FACTOR[project.typology]
  const jurisdictionFactor = JURISDICTION_FACTOR[project.jurisdiction]
  const floor = FLOOR[stage]

  const byArea = project.areaSqm * ratePerSqm * typologyFactor * jurisdictionFactor
  const amount = Math.round(Math.max(byArea, floor))

  return {
    stage,
    currency: CURRENCY,
    amount,
    ratePerSqm,
    areaSqm: project.areaSqm,
    typologyFactor,
    jurisdictionFactor,
    floor,
    atFloor: byArea < floor,
  }
}

/** Все стадии проекта до целевой включительно, с ценой каждой. */
export function priceProject(project: PricedProject): PriceBasis[] {
  return (Object.keys(DOC_STAGE_ORDER) as DocStage[])
    .filter((stage) => DOC_STAGE_ORDER[stage] <= DOC_STAGE_ORDER[project.targetStage])
    .sort((a, b) => DOC_STAGE_ORDER[a] - DOC_STAGE_ORDER[b])
    .map((stage) => priceStage(project, stage))
}

/** Сумма всех стадий проекта: то, во что обойдётся комплект целиком. */
export function totalPrice(project: PricedProject): number {
  return priceProject(project).reduce((sum, basis) => sum + basis.amount, 0)
}

/**
 * Цена доступа к подрядчикам (концепт, п.14б).
 *
 * Отдельная платная услуга поверх комплекта, и продолжение работы над тем же
 * проектом: к моменту выдачи мы знаем о стройке больше, чем кто-либо, и
 * отбор подрядчика считается тем же движком и по тем же правилам, что состав
 * команды.
 *
 * Считается из числа работ, а не из площади, и это не мелочь. Площадь уже
 * оплачена комплектом; здесь бюро делает другое, прогоняет отбор, проверяет
 * полисы и собирает короткий список по каждой работе. Работ на вилле восемь,
 * на доме с общими системами четырнадцать, и разница между ними, это ровно
 * разница в сделанном.
 *
 * Основание при этом остаётся: без него это число, которое можно только
 * принять на веру, то есть тот же порядок, который мы заменяем.
 *
 * Цифры начальные, как и у стадий: цену надо назвать раньше, чем накопится
 * статистика. Правятся здесь вместе с тестом, а не скидкой в переписке.
 */
const BUILD_ACCESS_BASE = 400
const BUILD_ACCESS_PER_TRADE = 60

export type BuildAccessBasis = {
  currency: string
  amount: number
  base: number
  perTrade: number
  trades: number
  jurisdictionFactor: number
}

export function priceBuildAccess(
  jurisdiction: Jurisdiction,
  trades: number,
): BuildAccessBasis {
  const jurisdictionFactor = JURISDICTION_FACTOR[jurisdiction]
  const amount = Math.round(
    (BUILD_ACCESS_BASE + BUILD_ACCESS_PER_TRADE * trades) * jurisdictionFactor,
  )

  return {
    currency: CURRENCY,
    amount,
    base: BUILD_ACCESS_BASE,
    perTrade: BUILD_ACCESS_PER_TRADE,
    trades,
    jurisdictionFactor,
  }
}
