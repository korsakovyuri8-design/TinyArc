'use client'

import { useActionState } from 'react'
import type { Discipline } from '@/engine/taxonomy'
import { ARTIFACT_KIND_LABELS, DISCIPLINE_LABELS } from '@/lib/labels'
import { MAX_FILE_BYTES } from '@/lib/storage/limits'
import { LocaleProvider, useT } from '@/lib/i18n/context'
import { fill } from '@/lib/i18n/fill'
import type { Locale } from '@/lib/i18n/locale'
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

/**
 * Язык приходит свойством и ставится провайдером вокруг каждой формы.
 *
 * Провайдер обязан стоять выше того, кто читает контекст, а разметка формы
 * собирается в момент отрисовки родителя — поэтому у каждой формы есть внешняя
 * обёртка с языком и внутренняя часть, которая уже переводит.
 */
function Wrap({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleProvider locale={locale}>{children}</LocaleProvider>
}

function Status({ state }: { state: WorkState }) {
  const t = useT()

  if (state.error) {
    return (
      <div className="hint" style={{ color: 'var(--fail)', marginTop: 8 }}>
        {t(state.error)}
      </div>
    )
  }

  if (state.message) {
    return (
      <div className="hint" style={{ color: 'var(--accent)', marginTop: 8 }}>
        {t(state.message)}
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
  const t = useT()

  return (
    <form action={formAction}>
      <input type="hidden" name="ticketId" value={ticketId} />
      {children}
      <button type="submit" className={solid ? 'btn btn-solid' : 'btn btn-quiet'} disabled={pending}>
        {pending ? '…' : t(label)}
      </button>
      <Status state={state} />
    </form>
  )
}

export function ClaimWork({ ticketId, locale }: { ticketId: string; locale: Locale }) {
  return (
    <Wrap locale={locale}>
      <Form action={claimTicket} ticketId={ticketId} label="Взять в работу" solid />
    </Wrap>
  )
}

export function SubmitWork({ ticketId, locale }: { ticketId: string; locale: Locale }) {
  return (
    <Wrap locale={locale}>
      <Form action={submitTicket} ticketId={ticketId} label="Предъявить работу" solid />
    </Wrap>
  )
}

export function CommentForm({ ticketId, locale }: { ticketId: string; locale: Locale }) {
  return (
    <Wrap locale={locale}>
      <CommentFields ticketId={ticketId} />
    </Wrap>
  )
}

function CommentFields({ ticketId }: { ticketId: string }) {
  const t = useT()

  return (
    <Form action={postComment} ticketId={ticketId} label="Отправить">
      <div className="field">
        <label htmlFor="body">{t('Комментарий в тикете')}</label>
        <textarea
          id="body"
          name="body"
          placeholder={t('Вопрос по постановке, ход работы, что передаёте дальше')}
        />
        <div className="hint">{t('Это единственный канал: личных сообщений между специалистами в системе нет.')}</div>
      </div>
    </Form>
  )
}

export function ConflictForm({ ticketId, locale }: { ticketId: string; locale: Locale }) {
  return (
    <Wrap locale={locale}>
      <ConflictFields ticketId={ticketId} />
    </Wrap>
  )
}

function ConflictFields({ ticketId }: { ticketId: string }) {
  const t = useT()

  return (
    <Form action={raiseTicketConflict} ticketId={ticketId} label="Передать арбитру">
      <div className="field">
        <label htmlFor="note">{t('Расхождение по задаче')}</label>
        <textarea
          id="note"
          name="note"
          placeholder={t('Например: вентканал по разделу инженерии проходит там, где дверь по архитектуре')}
          style={{ minHeight: 80 }}
        />
        <div className="hint">{t('Договариваться со смежником напрямую негде и не нужно. Решает бюро.')}</div>
      </div>
    </Form>
  )
}

export function RequestForm({
  ticketId,
  disciplines,
  locale,
}: {
  ticketId: string
  disciplines: Discipline[]
  locale: Locale
}) {
  if (disciplines.length === 0) return null

  return (
    <Wrap locale={locale}>
      <RequestFields ticketId={ticketId} disciplines={disciplines} />
    </Wrap>
  )
}

function RequestFields({
  ticketId,
  disciplines,
}: {
  ticketId: string
  disciplines: Discipline[]
}) {
  const t = useT()

  return (
    <Form action={askDiscipline} ticketId={ticketId} label="Отправить запрос">
      <div className="grid grid-2" style={{ gap: 12 }}>
        <div className="field">
          <label htmlFor="discipline">{t('Кому')}</label>
          <select id="discipline" name="discipline" defaultValue={disciplines[0]}>
            {disciplines.map((d) => (
              <option key={d} value={d}>
                {t(DISCIPLINE_LABELS[d])}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="title">{t('Что нужно')}</label>
          <input id="title" name="title" placeholder={t('Сдвинуть дверь в осях 3–4')} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="body">{t('Подробно')}</label>
        <textarea
          id="body"
          name="body"
          placeholder={t('Вентканал 200×400 идёт по стене в осях 3–4 и упирается в дверной проём. Нужно сдвинуть проём на 200 мм к оси 4.')}
          style={{ minHeight: 90 }}
        />
        <div className="hint">{t('Станет тикетом для этой дисциплины со сроком в сутки. Переписки не будет: адресат должен понять запрос без вас.')}</div>
      </div>
    </Form>
  )
}

export function RenderForm({
  ticketId,
  hint,
  locale,
}: {
  ticketId: string
  hint: string
  locale: Locale
}) {
  return (
    <Wrap locale={locale}>
      <RenderFields ticketId={ticketId} hint={hint} />
    </Wrap>
  )
}

function RenderFields({ ticketId, hint }: { ticketId: string; hint: string }) {
  const t = useT()

  return (
    <Form action={makeRender} ticketId={ticketId} label="Сгенерировать">
      <div className="field">
        <label htmlFor="name">{t('Название')}</label>
        <input id="name" name="name" placeholder={t('Экстерьер, вечер, вид с подъезда')} />
      </div>
      <div className="field">
        <label htmlFor="prompt">{t('Что должно быть на изображении')}</label>
        <textarea id="prompt" name="prompt" defaultValue={hint} style={{ minHeight: 90 }} />
        <div className="hint">{t('Ляжет в тикет с пометкой, что сгенерировано. Это материал для работы: предъявляете вы то, за что готовы отвечать.')}</div>
      </div>
    </Form>
  )
}

export function ArtifactForm({ ticketId, locale }: { ticketId: string; locale: Locale }) {
  return (
    <Wrap locale={locale}>
      <ArtifactFields ticketId={ticketId} />
    </Wrap>
  )
}

function ArtifactFields({ ticketId }: { ticketId: string }) {
  const t = useT()

  return (
    <Form action={addArtifact} ticketId={ticketId} label="Приложить">
      <div className="grid grid-2" style={{ gap: 12 }}>
        <div className="field">
          <label htmlFor="name">{t('Название файла')}</label>
          <input id="name" name="name" placeholder={t('Планы этажей, rev.B')} />
        </div>
        <div className="field">
          <label htmlFor="kind">{t('Тип')}</label>
          <select id="kind" name="kind" defaultValue="sheet">
            {Object.entries(ARTIFACT_KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {t(label)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="file">{t('Файл')}</label>
        <input id="file" name="file" type="file" />
        <div className="hint">
          {fill(
            t('До {limit} МБ. Файл ложится к нам: материалы проекта принадлежат заказчику и передаются ему целиком (п.13), а ссылка на чужой диск живёт до того дня, когда там наведут порядок.'),
            { limit: Math.round(MAX_FILE_BYTES / 1024 / 1024) },
          )}
        </div>
      </div>

      <div className="field">
        <label htmlFor="url">{t('…или ссылка')}</label>
        <input id="url" name="url" type="url" placeholder="https://" />
        <div className="hint">{t('Для того, что снаружи по своей природе: облачная модель, общий диск заказчика.')}</div>
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
export function LeaveForm({ projectId, locale }: { projectId: string; locale: Locale }) {
  return (
    <Wrap locale={locale}>
      <LeaveFields projectId={projectId} />
    </Wrap>
  )
}

function LeaveFields({ projectId }: { projectId: string }) {
  const [state, formAction, pending] = useActionState<WorkState, FormData>(leaveProject, {})
  const t = useT()

  return (
    <form action={formAction}>
      <input type="hidden" name="projectId" value={projectId} />

      <div className="field">
        <label htmlFor="reason">{t('Почему выходите')}</label>
        <textarea
          id="reason"
          name="reason"
          style={{ minHeight: 70 }}
          placeholder={t('Заболел, выхожу не раньше чем через три недели')}
        />
        <div className="hint">{t('Причину увидит бюро и тот, кто придёт на замену. Оценкой она не станет — поля оценки специалиста в системе нет.')}</div>
      </div>

      <button type="submit" className="btn btn-quiet" disabled={pending}>
        {pending ? '…' : t('Выйти из проекта')}
      </button>

      <p className="hint" style={{ marginTop: 10 }}>{t('Уйдёт роль целиком: все ваши незакрытые задачи по этому проекту перейдут следующему по рангу из того же прогона. Принятая работа останется вашей — она уже в ваших метриках, и переписывать её никто не будет.')}</p>

      <Status state={state} />
    </form>
  )
}
