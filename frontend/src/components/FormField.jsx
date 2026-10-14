/** ラベル・入力欄・エラーメッセージのセット */
export function FormField({ id, label, error, prefix, ...inputProps }) {
  const errorId = `${id}-error`
  const input = (
    <input
      id={id}
      className={`input${error ? ' is-invalid' : ''}`}
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={error ? errorId : undefined}
      {...inputProps}
    />
  )

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {prefix ? (
        <div className="input-prefix">
          <span>{prefix}</span>
          {input}
        </div>
      ) : (
        input
      )}
      {error && (
        <p id={errorId} className="field__error">
          {error}
        </p>
      )}
    </div>
  )
}
