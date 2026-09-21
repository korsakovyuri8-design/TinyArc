import type { Jurisdiction } from './taxonomy'

/**
 * Кто выдаёт право подписи и где его можно проверить.
 *
 * Здесь намеренно нет списков кодов лицензий, хотя именно их просят завести
 * первым делом. Коды живут меньше, чем справочник: Сербия в 2019 году приняла
 * новый правильник, объединила часть лицензий (310 с 316, 313 с 314) и ввела
 * шифры с буквами, и теперь у одного человека в реестре лежат номера обоих
 * поколений сразу. Зашитый список кодов в этот день стал бы неверным молча,
 * а анкета начала бы отвергать настоящие номера.
 *
 * Поэтому здесь орган и реестр: они меняются раз в десятилетие, а не раз в
 * поправку. Номер специалист вводит как есть, любого формата, и бюро
 * проверяет его по ссылке руками. Проверка глазами в реестре честнее, чем
 * проверка регулярным выражением по справочнику, которому полгода.
 */
export type LicenceAuthority = {
  /** Как орган называется на своём языке: под этим именем его и ищут. */
  name: string
  /** Английское имя, если местное не читается снаружи. */
  nameEn?: string
  /** Публичный реестр, где номер проверяется. */
  registryUrl?: string
  /** Что именно спросить у человека этой страны. */
  hint?: string
}

/**
 * Страны, по которым орган выяснен по источникам.
 *
 * Пусто не значит «лицензий нет»: значит, что мы их не проверяли. Тридцать
 * стран движка, это тридцать отдельных разборов, такой же работы, как корпус
 * норм, и выдумывать недостающие адреса нельзя: анкета, отправляющая человека
 * в несуществующий реестр, хуже анкеты, которая честно просит назвать орган
 * самому.
 */
export const LICENCE_AUTHORITIES: Partial<Record<Jurisdiction, LicenceAuthority[]>> = {
  ME: [
    {
      name: 'Inženjerska komora Crne Gore',
      nameEn: 'Chamber of Engineers of Montenegro',
      registryUrl: 'https://www.ingkomora.me',
      hint: 'The ministry issues the licence itself, but entry in the chamber register comes first: qualification at level VII-1 or above, three years of practice and a passed professional exam.',
    },
    {
      name: 'Komora arhitekata i planera Crne Gore',
      nameEn: 'Chamber of Architects and Planners of Montenegro',
      registryUrl: 'https://www.kaipcg.me',
    },
  ],
  RS: [
    {
      name: 'Inženjerska komora Srbije',
      nameEn: 'Serbian Chamber of Engineers',
      registryUrl: 'https://ingkomora.rs/registar',
      hint: 'The register shows a status as well as a number: it stays active only while professional indemnity cover is in force.',
    },
  ],
}

/**
 * Проверенные органы страны. Принимает любой код ISO, а не только юрисдикцию:
 * лицензию спрашивают и у человека из страны, где бюро проектов не берёт.
 */
export function authoritiesFor(country: string): LicenceAuthority[] {
  return LICENCE_AUTHORITIES[country as Jurisdiction] ?? []
}

/**
 * Одна заявленная лицензия.
 *
 * `authority` свободной строкой, а не выбором из справочника: в странах,
 * которых в справочнике нет, человек назовёт свой орган сам, и это
 * единственный способ вообще узнать, как там всё устроено. Пул заполняет
 * справочник быстрее, чем мы его разберём.
 */
export type DeclaredLicence = {
  /**
   * Страна, выдавшая лицензию, код ISO. Не обязательно юрисдикция движка:
   * лицензия архитектора из Бразилии бразильская, даже если проект он ведёт
   * черногорский.
   */
  jurisdiction: string
  /** Орган, выдавший лицензию. */
  authority: string
  /** Номер или обозначение, как он записан в документе. */
  number: string
  /** Ссылка на запись в реестре, если реестр публичный. */
  registryUrl?: string
}

/**
 * Проверенная лицензия или только заявленная.
 *
 * Бюро ставит эту отметку руками, посмотрев реестр. Автоматически её не
 * выставляет ничто: реестры не дают программного доступа, а «похоже на
 * настоящий номер» это не проверка.
 */
export type LicenceStatus = 'declared' | 'verified' | 'rejected'
