/**
 * Блюпринт Render.
 *
 * Проверка появилась после того, как выяснилось: файл в репозитории задавал
 * два секрета, а preflight в бою требовал восемь. Выкладка по блюпринту
 * упала бы на запуске — ровно как задумано, но человек узнал бы об этом после
 * нажатия кнопки, а не до, и разбирался бы с чужим списком в чужой панели.
 *
 * Поэтому проверяется не «в файле есть такие-то строки», а то, что стартует:
 * из блюпринта собирается окружение и прогоняется через тот же preflight,
 * который стоит на боевом запуске. Разойтись им теперь негде.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { preflight } from './env'

const blueprint = readFileSync(join(process.cwd(), 'render.yaml'), 'utf8')

/**
 * Переменные из блюпринта.
 *
 * Разбирается регулярным выражением, а не разборщиком yaml: тянуть
 * зависимость ради четырёх форм записи, которые мы сами и пишем, дороже, чем
 * читать их глазами. Форм ровно три: значение, секрет и ссылка на базу.
 */
function envFromBlueprint(): Record<string, string> {
  const env: Record<string, string> = {}
  const lines = blueprint.split('\n')

  for (let i = 0; i < lines.length; i += 1) {
    const key = /^\s*-\s*key:\s*(\S+)/.exec(lines[i])
    if (!key) continue

    const next = lines[i + 1] ?? ''
    const value = /^\s*value:\s*(.+)$/.exec(next)

    if (value) {
      env[key[1]] = value[1].trim()
      continue
    }

    // `sync: false` — Render спросит значение при выкладке. Для проверки
    // подставляем непустую строку: нас интересует, что переменную вообще
    // спросят, а не то, что человек в неё впишет.
    if (/^\s*sync:\s*false/.test(next)) {
      env[key[1]] = 'asked-at-deploy'
      continue
    }

    // fromDatabase — строку подключения даёт сама база.
    if (/^\s*fromDatabase:/.test(next)) {
      env[key[1]] = 'postgresql://bureau@db/bureau'
    }
  }

  return env
}

describe('блюпринт Render', () => {
  const env = envFromBlueprint()

  it('поднимается: preflight не находит ни одной причины отказать', () => {
    // NODE_ENV=production стоит в Dockerfile, значит в бою работают именно
    // боевые правила — их и проверяем.
    expect(preflight({ ...env, NODE_ENV: 'production' })).toEqual([])
  })

  it('спрашивает пароль панели и подпись сессий, а не оставляет умолчания', () => {
    expect(env.BUREAU_OPS_PASSWORD).toBeTruthy()
    expect(env.BUREAU_SESSION_SECRET).toBeTruthy()
  })

  it('не кладёт материалы проекта на диск контейнера: он живёт до выкладки', () => {
    expect(env.BUREAU_STORAGE).toBe('s3')
  })

  it('адрес продукта совпадает с доменом, который выпускает сертификат', () => {
    const domain = /domains:\s*\n\s*-\s*(\S+)/.exec(blueprint)?.[1]

    expect(domain).toBeTruthy()
    expect(env.BUREAU_PUBLIC_URL).toBe(`https://${domain}`)
  })

  it('база и приложение в одном регионе: иначе каждый запрос идёт через океан', () => {
    const regions = [...blueprint.matchAll(/^\s*region:\s*(\S+)/gm)].map((m) => m[1])

    expect(regions.length).toBeGreaterThan(1)
    expect(new Set(regions).size).toBe(1)
  })

  it('запуск идёт через скрипт с preflight, а не мимо него', () => {
    const command = /dockerCommand:\s*(.+)/.exec(blueprint)?.[1].trim()

    expect(command).toMatch(/scripts\/(demo-)?start\.sh/)
  })
})
