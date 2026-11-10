/** 計測値を単位付きの文字列にする(結果の表・テストのメッセージで使う) */
export function fmt(value, unit) {
  if (value == null) return '-'
  if (unit === 'ms') return `${Math.round(value)} ms`
  if (unit === 'KB') return `${Math.round(value)} KB`
  if (unit === 'MB') return `${value.toFixed(1)} MB`
  if (unit === '') return value.toFixed(3)
  return `${Math.round(value)} ${unit}`
}
