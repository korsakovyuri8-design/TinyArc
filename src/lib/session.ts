/**
 * Идентификация в пилоте.
 *
 * Осознанно простая: клиент и специалист входят по ключу доступа, бюро — по
 * паролю из окружения. Настоящая аутентификация — работа перед первым платящим
 * клиентом, а не перед прототипом. Написано так, чтобы замена была локальной:
 * всё общение с cookie живёт здесь.
 *
 * Значение cookie подписано. Без подписи знание чужого идентификатора давало бы
 * доступ: идентификаторы попадают в адреса страниц, в логи и в переписку, а
 * серверной сессии, которую можно отозвать, у нас нет.
 */

import { cookies } from 'next/headers'
import { prisma } from './db'
import { secret } from './env'
import { secretsMatch, sign as signValue, unsign as unsignValue } from './signing'

const CLIENT_COOKIE = 'bureau_client'
const SPECIALIST_COOKIE = 'bureau_specialist'
const OPS_COOKIE = 'bureau_ops'

const SESSION_DAYS = 180

type CookieOptions = Parameters<Awaited<ReturnType<typeof cookies>>['set']>[2]

function options(days: number): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: days * 24 * 60 * 60,
  }
}

function sign(value: string): string {
  return signValue(value, secret('BUREAU_SESSION_SECRET'))
}

async function read(name: string): Promise<string | null> {
  const jar = await cookies()
  return unsignValue(jar.get(name)?.value, secret('BUREAU_SESSION_SECRET'))
}

async function write(name: string, value: string, days = SESSION_DAYS): Promise<void> {
  const jar = await cookies()
  jar.set(name, sign(value), options(days))
}

// --- Клиент ----------------------------------------------------------------

export async function signInClient(projectId: string): Promise<void> {
  await write(CLIENT_COOKIE, projectId)
}

export async function signOutClient(): Promise<void> {
  const jar = await cookies()
  jar.delete(CLIENT_COOKIE)
}

export async function currentProjectId(): Promise<string | null> {
  return read(CLIENT_COOKIE)
}

/** Проект по ключу из письма. Ключ — единственный способ попасть в кабинет. */
export async function projectByKey(clientKey: string) {
  return prisma.project.findUnique({ where: { clientKey: clientKey.trim() } })
}

// --- Специалист ------------------------------------------------------------

export async function signInSpecialist(specialistId: string): Promise<void> {
  await write(SPECIALIST_COOKIE, specialistId)
}

export async function signOutSpecialist(): Promise<void> {
  const jar = await cookies()
  jar.delete(SPECIALIST_COOKIE)
}

export async function currentSpecialistId(): Promise<string | null> {
  return read(SPECIALIST_COOKIE)
}

export async function currentSpecialist() {
  const id = await currentSpecialistId()
  if (!id) return null
  return prisma.specialist.findUnique({ where: { id } })
}

export async function specialistByKey(accessKey: string) {
  return prisma.specialist.findUnique({ where: { accessKey: accessKey.trim() } })
}

// --- Бюро ------------------------------------------------------------------

export async function signInOperator(password: string): Promise<boolean> {
  const expected = secret('BUREAU_OPS_PASSWORD')

  // Сравнение постоянного времени: пароль здесь один на всех, и разница в
  // скорости ответа — это подсказка подбирающему.
  if (!secretsMatch(password, expected)) return false

  const jar = await cookies()
  // Панель живёт короткой сессией и строгим sameSite: это не кабинет, куда
  // заходят раз в месяц, а рабочий инструмент на смену.
  jar.set(OPS_COOKIE, sign('yes'), {
    ...options(1),
    sameSite: 'strict',
    maxAge: 12 * 60 * 60,
  })

  return true
}

export async function signOutOperator(): Promise<void> {
  const jar = await cookies()
  jar.delete(OPS_COOKIE)
}

export async function isOperator(): Promise<boolean> {
  return (await read(OPS_COOKIE)) === 'yes'
}
