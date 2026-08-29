/**
 * Права из политики: обезличить профиль и удалить данные проекта.
 *
 * Политика обещала оба действия с самого начала, а сделать их было нечем.
 * Обещание без механизма — это не политика, а текст; на первом же обращении
 * оно превращается в ручную правку базы, то есть в необратимую ошибку под
 * давлением времени.
 *
 * Оба действия необратимы и оба оставляют дату: по ней видно, что
 * обязательство исполнено, и когда. Ничего «мягкого удаления» здесь нет —
 * данные, которые человек попросил стереть, не должны лежать под флагом.
 *
 * Что остаётся, названо прямо и не по недосмотру:
 *
 * — метрики поставки специалиста. Они уже обезличены и держат историю
 *   проектов, в которых он участвовал; удалить их значит переписать чужие
 *   проекты задним числом;
 * — счета. Их хранение — обязанность перед страной регистрации, и человек
 *   не может её снять с нас своим обращением;
 * — тикеты и их приёмка. По ним считаются метрики других людей.
 *
 * Журнал уведомлений остаётся, но без адреса. Он хранит адрес затем, чтобы на
 * жалобу «мне ничего не приходило» можно было ответить фактом, — а после
 * обезличивания жаловаться некому, и живой адрес в нём становится ровно тем,
 * что человек просил стереть. Строка при этом не удаляется: пара «повод и
 * его цель» гасит повторные письма, и снять её значит однажды написать
 * человеку, которого больше нет, ещё раз.
 */

import { randomBytes } from 'node:crypto'
import { prisma } from '../db'
import { artifactKey, storage } from '../storage'

/** Ключ, который заведомо никому не подойдёт. */
function deadKey(prefix: string): string {
  return `${prefix}-${randomBytes(9).toString('hex')}`
}

export class NotErasable extends Error {}

/**
 * Обезличить профиль специалиста.
 *
 * Личное уходит: имя, почта, ссылка на портфолио и сами работы. Ключ
 * заменяется на заведомо непригодный — доступ закрывается тем же действием, и
 * это важнее аккуратности: обезличенный профиль, в который можно войти старым
 * ключом, обезличен только на экране.
 *
 * Статус `removed` выводит человека из отбора, потому что в выборку попадает
 * только `active`. Отдельной проверки для этого не нужно, и её отсутствие —
 * не упущение: гейт по статусу уже стоит первым.
 */
export async function anonymiseSpecialist(id: string): Promise<void> {
  const row = await prisma.specialist.findUnique({ where: { id }, select: { removedAt: true } })
  if (!row) throw new NotErasable('Specialist not found.')
  if (row.removedAt) throw new NotErasable('This profile is already anonymised.')

  const person = await prisma.specialist.findUniqueOrThrow({
    where: { id },
    select: { email: true },
  })
  const dead = `${deadKey('removed')}@removed.invalid`

  await prisma.$transaction([
    prisma.portfolioItem.deleteMany({ where: { specialistId: id } }),
    // Адрес уходит и из журнала уведомлений: он там для ответа на жалобу,
    // а жаловаться после обезличивания уже некому.
    prisma.notification.updateMany({
      where: { email: person.email },
      data: { email: dead },
    }),
    prisma.specialist.update({
      where: { id },
      data: {
        displayName: 'Former specialist',
        email: dead,
        accessKey: deadKey('removed'),
        portfolioUrl: '',
        status: 'removed',
        subscription: 'none',
        availabilityStatus: 'busy',
        weeklyCapacityHours: 0,
        removedAt: new Date(),
      },
    }),
  ])
}

/**
 * Удалить данные проекта.
 *
 * Только после закрытия: пока проект идёт, удалять его данные значит
 * остановить работу людей, которые в этот момент по ним чертят. Отдельного
 * согласия команды на это не требуется — материалы принадлежат заказчику
 * (п.13), — но и удалить их посреди выпуска нельзя.
 *
 * Файлы стираются из хранилища, а не только из базы: строка без файла — это
 * не удаление, а потеря ссылки на него.
 */
export async function eraseProject(id: string): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id },
    select: { status: true, dataErasedAt: true },
  })

  if (!project) throw new NotErasable('Project not found.')
  if (project.dataErasedAt) throw new NotErasable('The data of this project is already erased.')
  if (project.status !== 'delivered' && project.status !== 'rejected') {
    throw new NotErasable('The project is still running: its data is erased after it closes.')
  }

  const artifacts = await prisma.artifact.findMany({
    where: { ticket: { projectId: id }, storageKey: { not: null } },
    select: { id: true, storageKey: true },
  })

  for (const artifact of artifacts) {
    // Промах по одному файлу не отменяет удаления остальных: хранилище может
    // не знать ключа, если файл уже убрали руками.
    await storage()
      .remove(artifact.storageKey ?? artifactKey(id, artifact.id))
      .catch((error) => console.error('Файл не удалён из хранилища:', error))
  }

  const client = await prisma.project.findUniqueOrThrow({
    where: { id },
    select: { clientEmail: true },
  })
  const dead = `${deadKey('erased')}@removed.invalid`

  await prisma.$transaction([
    prisma.artifact.deleteMany({ where: { ticket: { projectId: id } } }),
    // Тот же случай, что и у специалиста: журнал остаётся, адрес — нет.
    prisma.notification.updateMany({
      where: { email: client.clientEmail },
      data: { email: dead },
    }),
    prisma.ticketComment.deleteMany({ where: { ticket: { projectId: id } } }),
    prisma.clientMessage.deleteMany({ where: { projectId: id } }),
    prisma.designDirection.deleteMany({ where: { projectId: id } }),
    prisma.ticket.updateMany({ where: { projectId: id }, data: { spec: '', conflictNote: '' } }),
    prisma.project.update({
      where: { id },
      data: {
        clientName: 'Erased at the client’s request',
        clientEmail: dead,
        clientKey: deadKey('erased'),
        briefNotes: '',
        dataErasedAt: new Date(),
      },
    }),
  ])
}
