/**
 * Подписи словарей переведены целиком.
 *
 * Проверка нужна отдельно от страниц: подпись не написана в разметке, а
 * приходит из `labels.ts` по значению из движка, и глазами её пропустить
 * проще всего. Английская форма с русскими «Монолит и железобетон» в списке
 * выглядит рабочей ровно до того момента, как в неё посмотрят.
 *
 * Требуется перевод всех словарей, а не только тех, что видны сегодня в
 * публичной части: подпись переезжает со страницы на страницу свободно, и
 * узнавать о пропуске в момент переезда — поздно.
 *
 * Подписи без кириллицы — «Revit», «Validate», «Townhouse» — из проверки
 * выпадают: они на обоих языках одинаковы, а запись «Revit» → «Revit» в
 * словаре нарушила бы правило, по которому перевод не совпадает с исходником.
 */

import { describe, expect, it } from 'vitest'
import * as labels from '@/lib/labels'
import { missing } from './dict'

/** Все подписи всех словарей одним списком. */
function everyLabel(): string[] {
  const out: string[] = []

  for (const value of Object.values(labels)) {
    if (Array.isArray(value)) {
      for (const item of value) out.push(...Object.values(item as Record<string, string>))
      continue
    }

    out.push(...Object.values(value as Record<string, string>))
  }

  return [...new Set(out)].filter((text) => /[А-Яа-яЁё]/.test(text))
}

describe('подписи таксономии', () => {
  it('переведены на английский все до одной', () => {
    expect(missing(everyLabel(), 'en')).toEqual([])
  })
})
