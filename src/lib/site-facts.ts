/**
 * Факты участка для проверки на нормы.
 *
 * Слой перевода между тем, что хранит проект, и тем, чем считает движок
 * (`src/engine/compliance.ts`). Нужен потому, что это разные вещи: заказчик
 * знает площадь участка и пятно застройки, а норма написана про процент
 * застройки. Хранить проценты значило бы хранить вычисленное вместо
 * измеренного — и терять исходные числа, по которым потом спорят.
 *
 * Отсутствующий факт остаётся отсутствующим. Ноль вместо неизвестного здесь
 * опаснее пустоты: он проходит проверку и врёт, что участок застроен на ноль
 * процентов.
 */

import type { SiteFacts } from '@/engine/compliance'
import type { Jurisdiction } from '@/engine/taxonomy'

/** Проект в объёме, нужном для проверки. */
export type SiteInput = {
  jurisdiction: string
  municipality: string | null
  zone: string | null
  storeys: number
  areaSqm: number
  plotAreaSqm: number | null
  footprintSqm: number | null
  heightM: number | null
  setbackFrontM: number | null
  setbackSideM: number | null
  setbackRearM: number | null
  units: number | null
  parkingSpaces: number | null
  greenSqm: number | null
}

/**
 * Доля, если делимое и делитель известны и делитель не ноль.
 *
 * Участок нулевой площади — это ошибка ввода, а не участок; делить на него
 * значит получить бесконечность и показать её заказчику как процент застройки.
 */
function ratio(part: number | null, whole: number | null): number | undefined {
  if (part === null || whole === null || whole <= 0) return undefined
  return part / whole
}

function known(value: number | null): number | undefined {
  return value === null ? undefined : value
}

function text(value: string | null): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/** Собирает факты участка из проекта. */
export function siteFacts(project: SiteInput): SiteFacts {
  return {
    jurisdiction: project.jurisdiction as Jurisdiction,
    municipality: text(project.municipality),
    zone: text(project.zone),
    storeys: project.storeys,
    heightM: known(project.heightM),
    coverageRatio: ratio(project.footprintSqm, project.plotAreaSqm),
    /*
     * Плотность считается по заявленной площади здания, а не по пятну: норма
     * ограничивает именно суммарную площадь этажей. Это единственная проверка
     * посадки, доступная сразу на брифе, — и самая дорогая из пропущенных:
     * участок, который не вмещает заказанные метры, стоит узнать до сборки
     * команды, а не после оплаты концепции.
     */
    floorAreaRatio: ratio(project.areaSqm, project.plotAreaSqm),
    setbackFrontM: known(project.setbackFrontM),
    setbackSideM: known(project.setbackSideM),
    setbackRearM: known(project.setbackRearM),
    parkingPerUnit: ratio(project.parkingSpaces, project.units),
    greenRatio: ratio(project.greenSqm, project.plotAreaSqm),
  }
}
