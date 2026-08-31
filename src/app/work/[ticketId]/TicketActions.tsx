'use client'

import { useActionState, useState } from 'react'
import type { Discipline } from '@/engine/taxonomy'
import { ARTIFACT_KIND_LABELS, DISCIPLINE_LABELS } from '@/lib/labels'
import { MAX_FILE_BYTES } from '@/lib/storage/limits'
import { fill } from '@/lib/fill'
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
  return (
          <Form action={claimTicket} ticketId={ticketId} label="Take it on" solid />
  )
}

export function SubmitWork({ ticketId }: { ticketId: string }) {
  return (
          <Form action={submitTicket} ticketId={ticketId} label="Hand in the work" solid />
  )
}

export function CommentForm({ ticketId }: { ticketId: string }) {

  return (
    <Form action={postComment} ticketId={ticketId} label="Send">
      <div className="field">
        <label htmlFor="body">Comment on the ticket</label>
        <textarea
          id="body"
          name="body"
          placeholder="A question about the brief, how the work is going, what you are handing on"
        />
        <div className="hint">This is the only channel: there are no private messages between specialists in the system.</div>
      </div>
    </Form>
  )
}

export function ConflictForm({ ticketId }: { ticketId: string }) {

  return (
    <Form action={raiseTicketConflict} ticketId={ticketId} label="Refer to the arbiter">
      <div className="field">
        <label htmlFor="note">The disagreement on this task</label>
        <textarea
          id="note"
          name="note"
          placeholder="For example: the duct in the MEP set runs where the architectural set has a door"
          style={{ minHeight: 80 }}
        />
        <div className="hint">There is nowhere to settle it with the adjacent discipline directly, and no need. The bureau decides.</div>
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

  return (
    <Form action={askDiscipline} ticketId={ticketId} label="Send the request">
      <div className="grid grid-2" style={{ gap: 12 }}>
        <div className="field">
          <label htmlFor="discipline">To whom</label>
          <select id="discipline" name="discipline" defaultValue={disciplines[0]}>
            {disciplines.map((d) => (
              <option key={d} value={d}>
                {DISCIPLINE_LABELS[d]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="title">What you need</label>
          <input id="title" name="title" placeholder="Move the door on gridlines 3–4" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="body">In detail</label>
        <textarea
          id="body"
          name="body"
          placeholder="A 200×400 duct runs along the wall on gridlines 3–4 and hits the door opening. The opening needs to move 200 mm towards gridline 4."
          style={{ minHeight: 90 }}
        />
        <div className="hint">It becomes a ticket for that discipline with a one-day deadline. There will be no exchange: the recipient has to understand the request without you.</div>
      </div>
    </Form>
  )
}

export function RenderForm({ ticketId, hint }: { ticketId: string; hint: string }) {

  return (
    <Form action={makeRender} ticketId={ticketId} label="Generate">
      <div className="field">
        <label htmlFor="name">Name</label>
        <input id="name" name="name" placeholder="Exterior, evening, view from the approach" />
      </div>
      <div className="field">
        <label htmlFor="prompt">What the image should show</label>
        <textarea id="prompt" name="prompt" defaultValue={hint} style={{ minHeight: 90 }} />
        <div className="hint">It goes onto the ticket marked as generated. It is material to work from: what you hand in is what you are prepared to answer for.</div>
      </div>
    </Form>
  )
}

/**
 * Слишком большой файл останавливается здесь, а не на сервере.
 *
 * Проверка на сервере осталась и остаётся главной — форму обходят. Но она
 * срабатывает после того, как файл целиком доехал: на плохой связи это
 * несколько минут ожидания ради отказа, который был известен сразу. Хуже
 * того, тело серверного действия ограничено платформой, и файл сверх её
 * предела не доходит до нашей проверки вовсе — человек получает пятисотку
 * вместо объяснения.
 */
export function ArtifactForm({ ticketId }: { ticketId: string }) {
  const [tooBig, setTooBig] = useState('')

  return (
    <Form action={addArtifact} ticketId={ticketId} label="Attach">
      <div className="grid grid-2" style={{ gap: 12 }}>
        <div className="field">
          <label htmlFor="name">File name</label>
          <input id="name" name="name" placeholder="Floor plans, rev.B" />
        </div>
        <div className="field">
          <label htmlFor="kind">Kind</label>
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
        <label htmlFor="file">File</label>
        <input
          id="file"
          name="file"
          type="file"
          onChange={(event) => {
            const chosen = event.currentTarget.files?.[0]

            if (chosen && chosen.size > MAX_FILE_BYTES) {
              // Поле очищается: иначе отправка уйдёт с файлом, который заведомо
              // не примут, и человек прождёт её впустую.
              event.currentTarget.value = ''
              setTooBig(
                fill(
                  'That file is {size} MB — over the {limit} MB limit. That is an archive, not a drawing: keep it elsewhere and give a link.',
                  {
                    size: Math.round(chosen.size / 1024 / 1024),
                    limit: Math.round(MAX_FILE_BYTES / 1024 / 1024),
                  },
                ),
              )
              return
            }

            setTooBig('')
          }}
        />
        {tooBig ? (
          <div className="hint" style={{ color: 'var(--fail)' }}>
            {tooBig}
          </div>
        ) : null}
        <div className="hint">
          {fill(
            'Up to {limit} MB. The file is stored by us: project materials belong to the client and are handed over in full (§13), whereas a link to someone else’s drive lives until the day they tidy it up.',
            { limit: Math.round(MAX_FILE_BYTES / 1024 / 1024) },
          )}
        </div>
      </div>

      <div className="field">
        <label htmlFor="url">…or a link</label>
        <input id="url" name="url" type="url" placeholder="https://" />
        <div className="hint">For what is external by nature: a cloud model, the client’s shared drive.</div>
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
        <label htmlFor="reason">Why you are leaving</label>
        <textarea
          id="reason"
          name="reason"
          style={{ minHeight: 70 }}
          placeholder="Ill; I cannot start for another three weeks"
        />
        <div className="hint">The bureau and whoever replaces you will see the reason. It does not become a rating — there is no field for rating a specialist in the system.</div>
      </div>

      <button type="submit" className="btn btn-quiet" disabled={pending}>
        {pending ? '…' : 'Leave the project'}
      </button>

      <p className="hint" style={{ marginTop: 10 }}>The whole role goes: every open task of yours on this project passes to the next by rank from the same run. Accepted work stays yours — it is already in your metrics, and no one will rewrite it.</p>

      <Status state={state} />
    </form>
  )
}
