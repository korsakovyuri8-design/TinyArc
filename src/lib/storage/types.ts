/**
 * Хранилище файлов проекта.
 *
 * Интерфейс намеренно узкий: положить, забрать, удалить. Ни ссылок наружу, ни
 * публичных адресов — файл всегда отдаётся через наш обработчик, который перед
 * выдачей проверяет, кому она полагается. Хранилище с публичной ссылкой
 * означает, что любой, кому эту ссылку переслали, читает чужой проект, а
 * проверять это уже негде.
 */

export type StoredFile = {
  /** Ключ в хранилище. Не адрес: наружу он не выходит. */
  key: string
  bytes: Uint8Array
  contentType: string
}

export interface Storage {
  readonly mode: string
  /** Кладёт файл и возвращает ключ, по которому его потом забирать. */
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>
  get(key: string): Promise<StoredFile | null>
  remove(key: string): Promise<void>
}
