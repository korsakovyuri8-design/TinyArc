/**
 * Место в отборе: участвует человек прямо сейчас или нет, и что этому мешает.
 *
 * Существует потому, что пустая доска ничего не объясняет. «Задач пока нет —
 * тикеты появляются, когда движок ставит вас в команду» верно ровно для того,
 * кто в пуле. Приглашённому импортом, дозаполнившему профиль и ушедшему на
 * разбор, та же фраза обещает работу, которой не будет: движок не может
 * поставить его никуда, потому что в пуле его нет. На запуске пул набирается
 * импортом, значит этим путём проходит почти каждый первый специалист.
 *
 * Порядок проверок повторяет порядок гейтов движка (`src/engine/filter.ts`),
 * а перед ними идёт статус: пул читается уже отфильтрованным по нему, поэтому
 * в движке его нет, а для человека он первый.
 *
 * Причина называется одна, и вместе с ней — чей ход. Человек, читающий
 * «портфолио ниже порога», должен понимать, ждёт он бюро или бюро ждёт его.
 */

import { PORTFOLIO_THRESHOLD } from '@/engine/taxonomy'

export const SEAT_TONES = ['pass', 'wait', 'fail'] as const
export type SeatTone = (typeof SEAT_TONES)[number]

/** Чей ход. `null` — ничей: решение принято и не обсуждается по случаям. */
export type SeatTurn = 'you' | 'bureau' | null

export type Seat = {
  /** Участвует ли человек в отборе прямо сейчас. */
  inSelection: boolean
  /** Короткая строка: что происходит. */
  headline: string
  /** Что стоит между человеком и отбором — словами, а не именем поля. */
  body: string
  tone: SeatTone
  turn: SeatTurn
}

export type SeatInput = {
  status: string
  subscription: string
  portfolioRating: number
  weeklyCapacityHours: number
}

export function seatOf(person: SeatInput): Seat {
  /*
   * Статус впереди денег и портфолио. Приглашённый с незаполненным профилем
   * не «не прошёл по портфолио» — портфолио у него ещё не смотрели, и сказать
   * ему про порог значит отправить переделывать то, что мешает не сейчас.
   */
  if (person.status === 'invited') {
    return {
      inSelection: false,
      headline: 'Your profile is not filled in yet',
      body: 'The bureau invited you from its own records, so the profile is half empty — and an empty field is not “neutral”, it is “does not pass”. Until it is filled in you are not in the pool, and no project can reach you.',
      tone: 'wait',
      turn: 'you',
    }
  }

  if (person.status === 'pending') {
    return {
      inSelection: false,
      headline: 'Your application is with the bureau',
      body: `Selection runs over the pool, and you are not in it until the portfolio is reviewed. The threshold is ${PORTFOLIO_THRESHOLD}/10 and the bureau sets the rating — there is nothing to send and nothing to apply to in the meantime.`,
      tone: 'wait',
      turn: 'bureau',
    }
  }

  if (person.status === 'rejected') {
    return {
      inSelection: false,
      headline: 'The portfolio did not pass the threshold',
      body: `The threshold is ${PORTFOLIO_THRESHOLD}/10, and it is a rule of the product rather than an operator’s judgement: it is not argued case by case. What changes it is new work, not a new application.`,
      tone: 'fail',
      turn: null,
    }
  }

  if (person.status !== 'active') {
    return {
      inSelection: false,
      headline: 'You are out of selection',
      body: 'The bureau has taken you out of the pool. Nothing about your work has changed and no metric has moved — write to the bureau to come back.',
      tone: 'wait',
      turn: 'bureau',
    }
  }

  /*
   * Дальше — гейты движка, в его же порядке. Деньги идут раньше портфолио
   * намеренно (п.14а): отказ по деньгам не должен выглядеть отказом по
   * квалификации, а при одном сообщении первым названным он и выглядит.
   */
  if (person.subscription === 'none') {
    return {
      inSelection: false,
      headline: 'Access to projects is closed',
      body: 'While access is closed the engine does not consider you — whatever your portfolio and metrics. This is about paying for access, not about the quality of your work.',
      tone: 'fail',
      turn: 'bureau',
    }
  }

  if (person.portfolioRating < PORTFOLIO_THRESHOLD) {
    return {
      inSelection: false,
      headline: 'The portfolio is below the threshold',
      body: `Selection starts at ${PORTFOLIO_THRESHOLD}/10. The rating is set by the bureau from the work you show — not from what the profile claims.`,
      tone: 'fail',
      turn: 'bureau',
    }
  }

  /*
   * Свободное время — единственный гейт, который человек двигает сам, и
   * поэтому единственный, где ход его. Ноль часов это не поломка: так
   * выходят из отбора на время, не теряя ни ключа, ни метрик.
   */
  if (person.weeklyCapacityHours <= 0) {
    return {
      inSelection: false,
      headline: 'Your free capacity is zero',
      body: 'Availability is a multiplier, not a term added on: at zero hours the engine leaves you out of every selection. This is the one gate you move yourself — set the hours in the profile and you are back.',
      tone: 'wait',
      turn: 'you',
    }
  }

  return {
    inSelection: true,
    headline: 'You are in the pool',
    body: 'Tickets appear when the engine puts you on a project team. There is nothing to apply to — selection runs without your involvement.',
    tone: 'pass',
    turn: null,
  }
}
