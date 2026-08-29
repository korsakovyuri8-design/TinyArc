'use client'

import { useActionState } from 'react'
import { approveProjectStage, sendToBureau, type ProjectState } from './actions'

/**
 * Форма разговора с бюро.
 *
 * Подпись под ней объясняет не правила, а границу: почему сказанное идёт бюро,
 * а не прямо тому, кто чертит. Человеку это не очевидно, и без объяснения
 * молчание команды в ответ читается как невнимание.
 */
export function ClientDialogue() {
  const [state, action, pending] = useActionState<ProjectState, FormData>(sendToBureau, {})

  return (
    <form action={action}>
      <div className="field">
        <label htmlFor="body">Что сказать бюро</label>
        <textarea
          id="body"
          name="body"
          style={{ minHeight: 90 }}
          placeholder="Нужно сдвинуть срок на месяц — уезжаю. Или: передумал по направлению, хочу вернуться к первому варианту."
        />
      </div>

      <button type="submit" className="btn btn-solid" disabled={pending}>
        {pending ? '…' : 'Отправить бюро'}
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
        Сказанное идёт бюро, а не команде. Так и задумано: бюро отвечает перед вами за проект
        целиком и переводит вашу просьбу в постановку задач. Просьба, отданная исполнителю
        напрямую, ломает ровно то, за что вы платите — ответственность за результат.
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
export function StageApproval({ stage, title }: { stage: string; title: string }) {
  const [state, action, pending] = useActionState<ProjectState, FormData>(
    approveProjectStage,
    {},
  )

  return (
    <form action={action}>
      <input type="hidden" name="stage" value={stage} />

      <div className="field">
        <label htmlFor={`note-${stage}`}>Что сказать, подтверждая (необязательно)</label>
        <textarea id={`note-${stage}`} name="note" style={{ minHeight: 60 }} />
      </div>

      <button type="submit" className="btn btn-solid" disabled={pending}>
        {pending ? '…' : `Подтвердить стадию «${title}»`}
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
        Подтверждение откроет команде следующую стадию. Пока его нет, работа по ней не
        начинается — это не задержка, а защита: документация по неподтверждённой концепции
        переделывается целиком. Если есть замечания, не подтверждайте, а напишите бюро ниже:
        оно превратит их в круг правок.
      </p>
    </form>
  )
}
