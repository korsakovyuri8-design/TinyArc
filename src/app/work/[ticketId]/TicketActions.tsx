'use client'

import { useActionState } from 'react'
import { ARTIFACT_KIND_LABELS } from '@/lib/labels'
import {
  addArtifact,
  claimTicket,
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
