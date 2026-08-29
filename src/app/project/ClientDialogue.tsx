'use client'

import { useActionState } from 'react'
import { fill } from '@/lib/fill'
import { approveProjectStage, sendToBureau, type ProjectState } from './actions'

/**
 * Форма разговора с бюро.
 *
 * Подпись под ней объясняет не правила, а границу: почему сказанное идёт бюро,
 * а не прямо тому, кто чертит. Человеку это не очевидно, и без объяснения
 * молчание команды в ответ читается как невнимание.
 */
export function ClientDialogue() {
  return (
          <DialogueForm />
  )
}

function DialogueForm() {
  const [state, action, pending] = useActionState<ProjectState, FormData>(sendToBureau, {})

  return (
    <form action={action}>
      <div className="field">
        <label htmlFor="body">What to tell the bureau</label>
        <textarea
          id="body"
          name="body"
          style={{ minHeight: 90 }}
          placeholder={'I need to push the deadline by a month — I’m travelling. Or: I’ve changed my mind on the direction and want to go back to the first option.'}
        />
      </div>

      <button type="submit" className="btn btn-solid" disabled={pending}>
        {pending ? '…' : 'Send to the bureau'}
      </button>

      {state.error && (
        <div className="hint" style={{ color: 'var(--fail)', marginTop: 10 }}>
          {state.error}
        </div>
      )}
      {state.message && (
        <div className="hint" style={{ color: 'var(--accent)', marginTop: 10 }}>
          {state.message}
        </div>
      )}

      <p className="hint" style={{ marginTop: 14 }}>
        What you write goes to the bureau, not to the team. That is deliberate: the bureau answers to you for the project as a whole and turns your request into task specifications. A request handed straight to a contributor breaks precisely what you are paying for — accountability for the result.
      </p>
    </form>
  )
}

/**
 * Подтверждение стадии.
 *
 * Кнопка стоит рядом с тем, что подтверждается, и говорит о последствии до
 * нажатия, а не после: следующая стадия откроется, и вернуть её обратно
 * бесплатно уже нельзя. Замечания уводятся в разговор с бюро — там они
 * становятся кругом правок, а не молчаливым отказом подтвердить.
 */
export function StageApproval({
  stage,
  title,
}: {
  stage: string
  title: string
}) {
  return (
          <ApprovalForm stage={stage} title={title} />
  )
}

function ApprovalForm({ stage, title }: { stage: string; title: string }) {
  const [state, action, pending] = useActionState<ProjectState, FormData>(
    approveProjectStage,
    {},
  )

  return (
    <form action={action}>
      <input type="hidden" name="stage" value={stage} />

      <div className="field">
        <label htmlFor={`note-${stage}`}>Anything to say as you confirm (optional)</label>
        <textarea id={`note-${stage}`} name="note" style={{ minHeight: 60 }} />
      </div>

      <button type="submit" className="btn btn-solid" disabled={pending}>
        {pending ? '…' : fill('Confirm the “{stage}” stage', { stage: title })}
      </button>

      {state.error && (
        <div className="hint" style={{ color: 'var(--fail)', marginTop: 10 }}>
          {state.error}
        </div>
      )}
      {state.message && (
        <div className="hint" style={{ color: 'var(--accent)', marginTop: 10 }}>
          {state.message}
        </div>
      )}

      <p className="hint" style={{ marginTop: 12 }}>
        Confirming opens the next stage for the team. Until you do, no work on it begins — that is not a delay but a safeguard: documentation built on an unconfirmed concept gets redone in full. If you have comments, do not confirm — write to the bureau below and it will turn them into a round of revisions.
      </p>
    </form>
  )
}
