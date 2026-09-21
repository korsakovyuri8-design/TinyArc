import { permitOpenCountries } from '@/engine/readiness'
import type { Jurisdiction } from '@/engine/taxonomy'
import { activePool } from './matching'
import { allPartners } from './partners'

/**
 * Страны, где бюро сейчас может довести проект до разрешения.
 *
 * Считается по живому пулу и действующим фирмам-подписантам при каждом
 * открытии брифа, а не хранится списком. Список, который правят руками,
 * однажды разойдётся с пулом: подписант уйдёт, а страна останется открытой.
 */
export async function permitOpen(): Promise<Jurisdiction[]> {
  const [pool, partners] = await Promise.all([activePool(), allPartners()])
  return permitOpenCountries(pool, partners)
}
