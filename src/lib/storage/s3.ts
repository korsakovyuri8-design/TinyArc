/**
 * S3-совместимое хранилище: Cloudflare R2, AWS S3, MinIO.
 *
 * Подпись SigV4 собрана здесь руками, а не взята из SDK. Причина простая:
 * запросов ровно три — положить, забрать, удалить, — а официальный клиент
 * тянет за собой несколько мегабайт и собственную модель конфигурации. Здесь
 * же весь протокол умещается в одну функцию, и в ней видно, что именно
 * подписывается.
 *
 * Предподписанных ссылок нет намеренно. Файл всегда идёт через наш обработчик,
 * который перед выдачей проверяет право на него; ссылка, работающая сама по
 * себе, — это чужой проект в руках любого, кому её переслали (п.13).
 */

import { createHash, createHmac } from 'node:crypto'
import type { Storage, StoredFile } from './types'

export type S3Config = {
  endpoint: string
  bucket: string
  region: string
  accessKeyId: string
  secretAccessKey: string
}

export function configFromEnv(env: Record<string, string | undefined>): S3Config {
  const missing = (name: string): never => {
    throw new Error(`BUREAU_STORAGE="s3": не задан ${name}.`)
  }

  return {
    endpoint: env.BUREAU_S3_ENDPOINT?.trim() || missing('BUREAU_S3_ENDPOINT'),
    bucket: env.BUREAU_S3_BUCKET?.trim() || missing('BUREAU_S3_BUCKET'),
    // R2 подписывается регионом auto; у AWS она настоящая.
    region: env.BUREAU_S3_REGION?.trim() || 'auto',
    accessKeyId: env.BUREAU_S3_ACCESS_KEY_ID?.trim() || missing('BUREAU_S3_ACCESS_KEY_ID'),
    secretAccessKey:
      env.BUREAU_S3_SECRET_ACCESS_KEY?.trim() || missing('BUREAU_S3_SECRET_ACCESS_KEY'),
  }
}

const sha256 = (data: string | Uint8Array): string =>
  createHash('sha256').update(data).digest('hex')

const hmac = (key: Buffer | string, data: string): Buffer =>
  createHmac('sha256', key).update(data).digest()

/** Каждый сегмент пути кодируется отдельно: слэши в ключе остаются слэшами. */
function encodePath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

export class S3Storage implements Storage {
  readonly mode = 's3'

  constructor(private readonly config: S3Config) {}

  private async request(
    method: 'PUT' | 'GET' | 'DELETE',
    key: string,
    body?: Uint8Array,
    contentType?: string,
  ): Promise<Response> {
    const { endpoint, bucket, region, accessKeyId, secretAccessKey } = this.config

    const url = new URL(`${endpoint.replace(/\/$/, '')}/${bucket}/${encodePath(key)}`)
    const now = new Date()
    const stamp = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
    const date = stamp.slice(0, 8)

    const payloadHash = sha256(body ?? '')

    const headers: Record<string, string> = {
      host: url.host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': stamp,
    }
    if (contentType) headers['content-type'] = contentType

    const signedHeaders = Object.keys(headers).sort()
    const canonicalHeaders = signedHeaders.map((h) => `${h}:${headers[h]}\n`).join('')
    const signedHeaderList = signedHeaders.join(';')

    const canonicalRequest = [
      method,
      url.pathname,
      '',
      canonicalHeaders,
      signedHeaderList,
      payloadHash,
    ].join('\n')

    const scope = `${date}/${region}/s3/aws4_request`
    const toSign = [
      'AWS4-HMAC-SHA256',
      stamp,
      scope,
      sha256(canonicalRequest),
    ].join('\n')

    const signingKey = hmac(
      hmac(hmac(hmac(`AWS4${secretAccessKey}`, date), region), 's3'),
      'aws4_request',
    )
    const signature = createHmac('sha256', signingKey).update(toSign).digest('hex')

    return fetch(url, {
      method,
      headers: {
        ...headers,
        Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaderList}, Signature=${signature}`,
      },
      body: body ? Buffer.from(body) : undefined,
    })
  }

  async put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    const response = await this.request('PUT', key, bytes, contentType)

    if (!response.ok) {
      throw new Error(`Хранилище не приняло файл: ${response.status} ${await response.text()}`)
    }
  }

  async get(key: string): Promise<StoredFile | null> {
    const response = await this.request('GET', key)

    if (response.status === 404) return null
    if (!response.ok) {
      throw new Error(`Хранилище не отдало файл: ${response.status} ${await response.text()}`)
    }

    return {
      key,
      bytes: new Uint8Array(await response.arrayBuffer()),
      contentType: response.headers.get('content-type') ?? 'application/octet-stream',
    }
  }

  async remove(key: string): Promise<void> {
    const response = await this.request('DELETE', key)

    // 404 при удалении — это успех: файла и так нет.
    if (!response.ok && response.status !== 404) {
      throw new Error(`Хранилище не удалило файл: ${response.status}`)
    }
  }
}
