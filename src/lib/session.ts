/**
 * Идентификация в пилоте.
 *
 * Осознанно простая: клиент и специалист входят по ключу доступа, бюро — по
 * паролю из окружения. Настоящая аутентификация — работа перед первым платящим
 * клиентом, а не перед прототипом. Написано так, чтобы замена была локальной:
 * всё общение с cookie живёт здесь.
 *
 * Ключ выдаётся тем же каналом, которым с человеком разговаривали: регистрации
 * как отдельного действия у специалиста нет — есть заявка и её подтверждение.
 */

import { cookies } from 'next/headers'
import { prisma } from './db'

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

// --- Клиент ----------------------------------------------------------------

export async function signInClient(projectId: string): Promise<void> {
  const jar = await cookies()
  jar.set(CLIENT_COOKIE, projectId, options(SESSION_DAYS))
}

export async function signOutClient(): Promise<void> {
  const jar = await cookies()
  jar.delete(CLIENT_COOKIE)
}

export async function currentProjectId(): Promise<string | null> {
  const jar = await cookies()
  return jar.get(CLIENT_COOKIE)?.value ?? null
}

/** Проект по ключу из письма. Ключ — единственный способ попасть в кабинет. */
export async function projectByKey(clientKey: string) {
  return prisma.project.findUnique({ where: { clientKey: clientKey.trim() } })
}

// --- Специалист ------------------------------------------------------------

export async function signInSpecialist(specialistId: string): Promise<void> {
  const jar = await cookies()
  jar.set(SPECIALIST_COOKIE, specialistId, options(SESSION_DAYS))
}

export async function signOutSpecialist(): Promise<void> {
  const jar = await cookies()
  jar.delete(SPECIALIST_COOKIE)
}

export async function currentSpecialistId(): Promise<string | null> {
  const jar = await cookies()
  return jar.get(SPECIALIST_COOKIE)?.value ?? null
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
  const expected = process.env.BUREAU_OPS_PASSWORD ?? 'bureau-ops'
  if (password !== expected) return false

  const jar = await cookies()
  jar.set(OPS_COOKIE, 'yes', { ...options(1), sameSite: 'strict', maxAge: 12 * 60 * 60 })
  return true
}

export async function signOutOperator(): Promise<void> {
  const jar = await cookies()
  jar.delete(OPS_COOKIE)
}

export async function isOperator(): Promise<boolean> {
  const jar = await cookies()
  return jar.get(OPS_COOKIE)?.value === 'yes'
}
