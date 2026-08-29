'use client'

/**
 * Поля форм. Вынесены отдельно, потому что бриф клиента и заявка специалиста
 * спрашивают об одном и том же словаре — и должны спрашивать одинаково.
 *
 * Перевод идёт здесь, а не у вызывающего. Подписи, подсказки и значения
 * словарей проходят через одно место, и ни одно поле не может остаться
 * непереведённым по забывчивости: язык берётся из контекста формы.
 */


export function Field({
  label,
  name,
  error,
  hint,
  children,
}: {
  label: string
  name?: string
  error?: string
  hint?: string
  children: React.ReactNode
}) {

  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      {children}
      {hint && !error && <div className="hint">{hint}</div>}
      {error && (
        <div className="hint" style={{ color: 'var(--fail)' }}>
          {error}
        </div>
      )}
    </div>
  )
}

export function Choices<T extends string>({
  name,
  options,
  labels,
  defaultValue = [],
}: {
  name: string
  options: readonly T[]
  labels: Record<T, string>
  defaultValue?: readonly T[]
}) {

  return (
    <div className="choices">
      {options.map((option) => (
        <label key={option} className="choice">
          <input
            type="checkbox"
            name={name}
            value={option}
            defaultChecked={defaultValue.includes(option)}
          />
          {labels[option]}
        </label>
      ))}
    </div>
  )
}

export function Select<T extends string>({
  name,
  options,
  labels,
  defaultValue,
}: {
  name: string
  options: readonly T[]
  labels: Record<T, string>
  defaultValue?: T
}) {

  return (
    <select id={name} name={name} defaultValue={defaultValue}>
      {options.map((option) => (
        <option key={option} value={option}>
          {labels[option]}
        </option>
      ))}
    </select>
  )
}

export function Submit({ pending, children }: { pending: boolean; children: React.ReactNode }) {

  return (
    <button type="submit" className="btn btn-solid" disabled={pending}>
      {pending ? 'Working…' : children}
    </button>
  )
}
