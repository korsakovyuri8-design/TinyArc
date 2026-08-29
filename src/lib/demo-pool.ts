/**
 * Синтетический пул специалистов.
 *
 * Одни и те же люди питают демонстрацию алгоритма (браузер, без базы) и сид
 * (база). Так демо показывает ровно ту выборку, которая потом окажется в
 * стенде, а не отдельную красивую выдумку.
 *
 * Пул собран так, чтобы на нём было видно работу гейтов: в нём есть люди ниже
 * порога по портфолио, без права подписи, без нужного языка, без обмена
 * моделями и без свободной ёмкости. Демонстрация, где проходят все, ничего не
 * демонстрирует.
 */

import type { SpecialistProfile } from '@/engine/types'
import { DISCIPLINES, DISCIPLINE_SPECIALIZATIONS, JURISDICTION_UTC_OFFSET } from '@/engine/taxonomy'
import type {
  ClimateZone,
  Discipline,
  DocStage,
  IfcLevel,
  Jurisdiction,
  Language,
  MaterialSystem,
  RegulatoryTrack,
  ScaleBand,
  Software,
  Subscription,
  Specialization,
  Typology,
  WorkMode,
} from '@/engine/taxonomy'

export type DemoSpecialist = SpecialistProfile & {
  email: string
  accessKey: string
  portfolioUrl: string
  status: 'active' | 'pending'
}

/**
 * Линейный конгруэнтный генератор. Нужен ровно для воспроизводимости: пул
 * должен быть одинаковым в демо, в сиде и в тестах, иначе «почему у меня другая
 * команда» становится вопросом без ответа.
 */
function lcg(seed: number): () => number {
  let state = seed >>> 0

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

const FIRST_NAMES: Record<Jurisdiction, string[]> = {
  ME: ['Milo', 'Ana', 'Vuk', 'Jelena', 'Nikola', 'Tijana', 'Marko', 'Ivana'],
  RS: ['Stefan', 'Milica', 'Dušan', 'Jovana', 'Nemanja', 'Katarina', 'Filip', 'Sara'],
  GR: ['Dimitris', 'Eleni', 'Yannis', 'Sofia', 'Kostas', 'Maria', 'Nikos', 'Georgia'],
}

const LAST_NAMES: Record<Jurisdiction, string[]> = {
  ME: ['Popović', 'Vujović', 'Radulović', 'Marković', 'Đukanović', 'Kovačević'],
  RS: ['Jovanović', 'Petrović', 'Nikolić', 'Ilić', 'Stanković', 'Pavlović'],
  GR: ['Papadopoulos', 'Georgiou', 'Nikolaou', 'Vasiliou', 'Antoniou', 'Christou'],
}

const SOFTWARE_MIXES: Software[][] = [
  ['revit'],
  ['archicad'],
  ['revit', 'autocad'],
  ['archicad', 'autocad'],
  ['rhino', 'archicad'],
  ['tekla', 'revit'],
  ['autocad'],
  ['rhino'],
]

const LANGUAGE_BASE: Record<Jurisdiction, Language> = { ME: 'cnr', RS: 'sr', GR: 'el' }
const CLIMATE_BASE: Record<Jurisdiction, ClimateZone> = {
  ME: 'mediterranean',
  RS: 'continental',
  GR: 'mediterranean',
}

function pick<T>(random: () => number, items: readonly T[]): T {
  return items[Math.floor(random() * items.length) % items.length]
}

function some<T>(random: () => number, items: readonly T[], chance: number): T[] {
  // Пустой список — это не «выбери хоть что-нибудь»: дисциплина без
  // специализаций существует (сметы, технология, энергоэффективность), и
  // добор из пустого массива положил бы в профиль undefined.
  if (items.length === 0) return []

  const chosen = items.filter(() => random() < chance)
  return chosen.length > 0 ? chosen : [pick(random, items)]
}

// Список берётся из таксономии: пул, перечисленный руками, отстаёт от матрицы
// ролей на каждую новую дисциплину — и отстаёт молча. Проекты просто перестают
// собираться, а по стенду это выглядит как нехватка людей, а не как забытая строка.
const ALL_DISCIPLINES: Discipline[] = [...DISCIPLINES]
const ALL_TYPOLOGIES: Typology[] = ['villa', 'townhouse', 'multi_family', 'mixed_use']
const ALL_SCALES: ScaleBand[] = ['upto_250', '250_1000', '1000_3000', '3000_plus']
const ALL_MATERIALS: MaterialSystem[] = ['concrete', 'masonry', 'timber', 'steel', 'hybrid']
const IFC_MIX: IfcLevel[] = ['none', 'import', 'exchange', 'coordination', 'coordination']
// Большинство подписано: подписка — не редкость, а условие входа. Без неё
// остаются единицы, и по ним видно, как выглядит этот отказ.
const SUBSCRIPTION_MIX: Subscription[] = ['founding', 'founding', 'founding', 'active', 'none']
const STAGE_MIX: DocStage[][] = [
  ['concept'],
  ['concept', 'permit'],
  ['concept', 'permit', 'tender'],
  ['concept', 'permit', 'tender', 'construction'],
  ['permit', 'tender', 'construction'],
]

/** По три специалиста на каждую дисциплину в каждой из трёх стран. */
export const PER_DISCIPLINE_PER_JURISDICTION = 3
export const DEMO_POOL_SIZE = 3 * ALL_DISCIPLINES.length * PER_DISCIPLINE_PER_JURISDICTION

/**
 * Пул целиком. Детерминирован: одно и то же зерно — один и тот же список.
 *
 * Пул строится по рынку, а не случайной россыпью: под каждую страну заводится
 * покрытие по всем дисциплинам. Так делает и живое бюро — страну открывают,
 * когда собран пул, а не наоборот (п.20, п.21).
 *
 * Первый в каждой тройке заведомо проходит гейты: он держит покрытие. Двое
 * других зашумлены — среди них есть и ниже порога по портфолио, и без права
 * подписи, и без свободной ёмкости, и без нужного обмена моделями.
 */
export function demoPool(seed = 20260824): DemoSpecialist[] {
  const random = lcg(seed)
  const jurisdictions: Jurisdiction[] = ['ME', 'RS', 'GR']
  const people: DemoSpecialist[] = []

  let index = 0

  for (const home of jurisdictions) {
    for (const discipline of ALL_DISCIPLINES) {
      for (let slot = 0; slot < PER_DISCIPLINE_PER_JURISDICTION; slot += 1) {
        index += 1
        const reliable = slot === 0

        const first = pick(random, FIRST_NAMES[home])
        const last = pick(random, LAST_NAMES[home])

        /*
         * Специализации. Надёжный берёт свою дисциплину целиком — он и есть
         * покрытие рынка, и роли с режимом «нужны все» (MEP обязан вести
         * отопление, электрику и воду) закрываются именно им. Остальные берут
         * кусок: так в пуле появляются те, у кого дисциплина та, а
         * специализация не та.
         */
        const own = DISCIPLINE_SPECIALIZATIONS[discipline]
        const specializations: Specialization[] = reliable ? [...own] : some(random, own, 0.5)

        const disciplines: Discipline[] = [discipline]
        // Часть людей ведёт две дисциплины: универсал должен встречаться, иначе
        // ветка «один закрывает несколько слотов» никогда не показывается.
        if (!reliable && random() < 0.25) {
          const extra = pick(random, ALL_DISCIPLINES)
          if (extra !== discipline) {
            disciplines.push(extra)
            specializations.push(...some(random, DISCIPLINE_SPECIALIZATIONS[extra], 0.5))
          }
        }

        const portfolioRating = reliable
          ? Math.round((8.2 + random() * 1.6) * 10) / 10
          : Math.round((5.5 + random() * 4.3) * 10) / 10

        const languages: Language[] = [LANGUAGE_BASE[home]]
        if (reliable || random() < 0.8) languages.push('en')
        if (random() < 0.3) languages.push('ru')

        const alsoWorksIn = jurisdictions.filter((j) => j !== home && random() < 0.3)

        // Право подписи держит первый в тройке: без подписи в стране проект не
        // берётся вовсе, и покрытие по ней обязано быть (п.10).
        const signs = reliable || random() < 0.35 ? [home] : []

        const delivered = random() < 0.5 ? Math.floor(random() * 14) : 0
        const onTime = delivered === 0 ? 0 : Math.round(delivered * (0.6 + random() * 0.4))
        const firstTimeRight = delivered === 0 ? 0 : Math.round(onTime * (0.5 + random() * 0.5))

        people.push({
          id: `demo-${String(index).padStart(2, '0')}`,
          displayName: `${first} ${last}`,
          email:
            `${first}.${last}`
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/[^a-z.]/g, '') + `.${index}@example.com`,
          accessKey: `seed-key-${String(index).padStart(2, '0')}`,
          portfolioUrl: `https://example.com/portfolio/${index}`,
          status: !reliable && random() < 0.15 ? 'pending' : 'active',

          disciplines,
          specializations,
          typologies: reliable ? [...ALL_TYPOLOGIES] : some(random, ALL_TYPOLOGIES, 0.5),
          scaleBands: reliable ? [...ALL_SCALES] : some(random, ALL_SCALES, 0.45),
          maxStoreys: reliable ? 5 : 1 + Math.floor(random() * 5),
          materialSystems: reliable
            ? [...ALL_MATERIALS]
            : some(random, ALL_MATERIALS, 0.4),
          climateZones:
            random() < 0.7
              ? [CLIMATE_BASE[home]]
              : [CLIMATE_BASE[home], pick(random, ['continental', 'alpine', 'arid'] as ClimateZone[])],
          jurisdictions: [home, ...alsoWorksIn],
          signsIn: signs,
          /*
           * Технологический шлюз жёсткий: пакет проекта обязан совпасть, и
           * команда обязана говорить на одном языке. Поэтому тот, кто держит
           * покрытие рынка, работает в нескольких пакетах — так и отбирают
           * людей в живой пул. Остальные берут узкий набор и на шлюзе сыплются.
           */
          software: reliable ? ['revit', 'archicad', 'autocad'] : pick(random, SOFTWARE_MIXES),
          // Координация по IFC у надёжного: он не должен ломать обмен в команде.
          ifcLevel: reliable ? 'coordination' : pick(random, IFC_MIX),
          docStages: reliable ? ['concept', 'permit', 'tender', 'construction'] : pick(random, STAGE_MIX),
          regulatoryTracks: (reliable || random() < 0.7 ? ['light'] : ['standard']) as RegulatoryTrack[],
          languages,
          workMode: (random() < 0.7 ? 'remote' : 'hybrid') as WorkMode,
          utcOffset: reliable
            ? JURISDICTION_UTC_OFFSET[home]
            : pick(random, [1, 1, 2, 2, 3, 0, 4]),
          weeklyCapacityHours: reliable
            ? pick(random, [20, 25, 30, 40])
            : pick(random, [0, 5, 10, 12, 16, 20, 25, 30, 40]),
          leadTimeDays: reliable ? Math.floor(random() * 6) : Math.floor(random() * 21),
          portfolioRating,
          delivery: {
            deliveredTickets: delivered,
            onTimeTickets: onTime,
            firstTimeRightTickets: firstTimeRight,
            responseMinutesTotal: delivered * Math.floor(30 + random() * 900),
            revisionRoundsTotal: Math.max(0, delivered - firstTimeRight) + Math.floor(random() * 3),
          },
          /*
           * Держащий покрытие подписан, среди зашумлённых встречаются без
           * подписки. Иначе гейт доступа не показан на стенде вовсе, а
           * посмотреть на него надо: это единственный гейт, который снимается
           * не работой над профилем, а оплатой.
           */
          subscription: reliable ? 'founding' : pick(random, SUBSCRIPTION_MIX),
        })
      }
    }
  }

  return people
}

/** Пул, из которого движок вообще выбирает: подтверждённые специалисты. */
export function demoActivePool(seed?: number): SpecialistProfile[] {
  return demoPool(seed).filter((s) => s.status === 'active')
}
