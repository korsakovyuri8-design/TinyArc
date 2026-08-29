/**
 * Где лежит файл артефакта.
 *
 * Один ответ на два случая. Файл в нашем хранилище отдаётся через обработчик,
 * который перед выдачей проверяет право на него; внешний живёт по своей ссылке.
 * Разводить это по местам показа значит однажды показать одно вместо другого —
 * и в лучшем случае это будет битая ссылка, а в худшем чужой файл без проверки.
 *
 * Модуль без импортов намеренно: им пользуются и серверные страницы, и формы в
 * браузере, а работа с диском в браузер не уезжает.
 */

export type ArtifactLocation = {
  id: string
  url: string
  storageKey: string | null
}

/** Адрес для показа человеку. Пустая строка — файла нет ни там, ни там. */
export function artifactHref(artifact: ArtifactLocation): string {
  if (artifact.storageKey) return `/api/files/${artifact.id}`
  return artifact.url
}

/** Наш ли это файл: от этого зависит, открывать его в новой вкладке или качать. */
export function isOurs(artifact: ArtifactLocation): boolean {
  return Boolean(artifact.storageKey)
}
