'use client'

import { useActionState } from 'react'
import { postComment, submitTicket, type WorkState } from '../actions'

export function CommentForm({ ticketId }: { ticketId: string }) {
  const [state, action, pending] = useActionState<WorkState, FormData>(postComment, {})

  return (
    <form action={action}>
      <input type="hidden" name="ticketId" value={ticketId} />
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
        {state.error && (
          <div className="hint" style={{ color: 'var(--fail)' }}>
            {state.error}
          </div>
        )}
      </div>
      <button type="submit" className="btn btn-quiet" disabled={pending}>
        {pending ? 'Отправляем…' : 'Отправить'}
      </button>
    </form>
  )
}

export function SubmitWork({ ticketId }: { ticketId: string }) {
  const [state, action, pending] = useActionState<WorkState, FormData>(submitTicket, {})

  return (
    <form action={action}>
      <input type="hidden" name="ticketId" value={ticketId} />
      <button type="submit" className="btn btn-solid" disabled={pending}>
        {pending ? 'Предъявляем…' : 'Предъявить работу'}
      </button>
      {state.error && (
        <div className="hint" style={{ color: 'var(--fail)', marginTop: 8 }}>
          {state.error}
        </div>
      )}
    </form>
  )
}
