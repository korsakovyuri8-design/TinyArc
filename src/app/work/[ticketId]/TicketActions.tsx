'use client'

import { useActionState } from 'react'
import type { Discipline } from '@/engine/taxonomy'
import { ARTIFACT_KIND_LABELS, DISCIPLINE_LABELS } from '@/lib/labels'
import {
  addArtifact,
  askDiscipline,
  claimTicket,
  leaveProject,
  makeRender,
  postComment,
  raiseTicketConflict,
  submitTicket,
  type WorkState,
} from '../actions'

type Action = (prev: WorkState, formData: FormData) => Promise<WorkState>

function Status({ state }: { state: WorkState }) {
  if (state.error) {
    return (
      <div className="hint" style={{ color: 'var(--fail)', marginTop: 8 }}>
        {state.error}
      </div>
    )
  }

  if (state.message) {
    return (
      <div className="hint" style={{ color: 'var(--accent)', marginTop: 8 }}>
        {state.message}
      </div>
    )
  }

  return null
}

function Form({
  action,
  ticketId,
  label,
  solid,
  children,
}: {
  action: Action
  ticketId: string
  label: string
  solid?: boolean
  children?: React.ReactNode
}) {
  const [state, formAction, pending] = useActionState<WorkState, FormData>(action, {})

  return (
    <form action={formAction}>
      <input type="hidden" name="ticketId" value={ticketId} />
      {children}
      <button type="submit" className={solid ? 'btn btn-solid' : 'btn btn-quiet'} disabled={pending}>
        {pending ? '…' : label}
      </button>
      <Status state={state} />
    </form>
  )
}

export function ClaimWork({ ticketId }: { ticketId: string }) {
  return <Form action={claimTicket} ticketId={ticketId} label="Взять в работу" solid />
}

export function SubmitWork({ ticketId }: { ticketId: string }) {
  return <Form action={submitTicket} ticketId={ticketId} label="Предъявить работу" solid />
}

export function CommentForm({ ticketId }: { ticketId: string }) {
  return (
    <Form action={postComment} ticketId={ticketId} label="Отправить">
      <div className="field">
        <label htmlFor="body">Комментарий в тикете</label>
        <textarea
          id="body"
          name="body"
          placeholder="Вопрос по постановке, ход работы, что передаёте дальше"
        />
        <div className="hint">
          Это единственный канал: личных сообщений между специалистами в системе нет.
        </div>
      </div>
    </Form>
  )
}

export function ConflictForm({ ticketId }: { ticketId: string }) {
  return (
    <Form action={raiseTicketConflict} ticketId={ticketId} label="Передать арбитру">
      <div className="field">
        <label htmlFor="note">Расхождение по задаче</label>
        <textarea
          id="note"
          name="note"
          placeholder="Например: вентканал по разделу инженерии проходит там, где дверь по архитектуре"
          style={{ minHeight: 80 }}
        />
        <div className="hint">
          Договариваться со смежником напрямую негде и не нужно. Решает бюро.
        </div>
      </div>
    </Form>
  )
}

export function RequestForm({
  ticketId,
  disciplines,
}: {
  ticketId: string
  disciplines: Discipline[]
}) {
  if (disciplines.length === 0) return null

  return (
    <Form action={askDiscipline} ticketId={ticketId} label="Отправить запрос">
      <div className="grid grid-2" style={{ gap: 12 }}>
        <div className="field">
          <label htmlFor="discipline">Кому</label>
          <select id="discipline" name="discipline" defaultValue={disciplines[0]}>
            {disciplines.map((d) => (
              <option key={d} value={d}>
                {DISCIPLINE_LABELS[d]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="title">Что нужно</label>
          <input id="title" name="title" placeholder="Сдвинуть дверь в осях 3–4" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="body">Подробно</label>
        <textarea
          id="body"
          name="body"
          placeholder="Вентканал 200×400 идёт по стене в осях 3–4 и упирается в дверной проём. Нужно сдвинуть проём на 200 мм к оси 4."
          style={{ minHeight: 90 }}
        />
        <div className="hint">
          Станет тикетом для этой дисциплины со сроком в сутки. Переписки не будет: адресат
          должен понять запрос без вас.
        </div>
      </div>
    </Form>
  )
}

export function RenderForm({ ticketId, hint }: { ticketId: string; hint: string }) {
  return (
    <Form action={makeRender} ticketId={ticketId} label="Сгенерировать">
      <div className="field">
        <label htmlFor="name">Название</label>
        <input id="name" name="name" placeholder="Экстерьер, вечер, вид с подъезда" />
      </div>
      <div className="field">
        <label htmlFor="prompt">Что должно быть на изображении</label>
        <textarea id="prompt" name="prompt" defaultValue={hint} style={{ minHeight: 90 }} />
        <div className="hint">
          Ляжет в тикет с пометкой, что сгенерировано. Это материал для работы: предъявляете
          вы то, за что готовы отвечать.
        </div>
      </div>
    </Form>
  )
}

export function ArtifactForm({ ticketId }: { ticketId: string }) {
  return (
    <Form action={addArtifact} ticketId={ticketId} label="Приложить">
      <div className="grid grid-2" style={{ gap: 12 }}>
        <div className="field">
          <label htmlFor="name">Название файла</label>
          <input id="name" name="name" placeholder="Планы этажей, rev.B" />
        </div>
        <div className="field">
          <label htmlFor="kind">Тип</label>
          <select id="kind" name="kind" defaultValue="sheet">
            {Object.entries(ARTIFACT_KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="url">Ссылка</label>
        <input id="url" name="url" type="url" placeholder="https://" />
        <div className="hint">
          Сами файлы бюро у себя не держит — хранится ссылка (п.13).
        </div>
      </div>
    </Form>
  )
}

/**
 * Выход из роли на проекте.
 *
 * Стоит на задаче, потому что именно здесь человек понимает, что не потянет.
 * Но действие шире задачи, и текст говорит это прямо: уходит роль целиком, со
 * всеми незакрытыми задачами. Бросить одну, оставив соседние, нельзя — они
 * связаны графом, и такой проект потом никто не разберёт.
 *
 * Форма отдельная от Form: там скрытым полем идёт тикет, а здесь — проект.
 */
export function LeaveForm({ projectId }: { projectId: string }) {
  const [state, formAction, pending] = useActionState<WorkState, FormData>(leaveProject, {})

  return (
    <form action={formAction}>
      <input type="hidden" name="projectId" value={projectId} />

      <div className="field">
        <label htmlFor="reason">Почему выходите</label>
        <textarea
          id="reason"
          name="reason"
          style={{ minHeight: 70 }}
          placeholder="Заболел, выхожу не раньше чем через три недели"
        />
        <div className="hint">
          Причину увидит бюро и тот, кто придёт на замену. Оценкой она не станет — поля
          оценки специалиста в системе нет.
        </div>
      </div>

      <button type="submit" className="btn btn-quiet" disabled={pending}>
        {pending ? '…' : 'Выйти из проекта'}
      </button>

      <p className="hint" style={{ marginTop: 10 }}>
        Уйдёт роль целиком: все ваши незакрытые задачи по этому проекту перейдут следующему
        по рангу из того же прогона. Принятая работа останется вашей — она уже в ваших
        метриках, и переписывать её никто не будет.
      </p>

      <Status state={state} />
    </form>
  )
}
