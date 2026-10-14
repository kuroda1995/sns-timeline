// 認証画面の入力チェック(認証機能.md SC-01 / SC-02)。サーバー側のチェックと同じルールにする

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERNAME_PATTERN = /^[A-Za-z0-9_]+$/
// 半角英数字・記号(スペースを除くASCII)のみ。BCryptの72バイト制限のため
const PASSWORD_CHARS = /^[!-~]+$/

function validateEmail(email) {
  if (!email.trim()) return 'メールアドレスを入力してください'
  if (!EMAIL_PATTERN.test(email.trim())) return 'メールアドレスの形式で入力してください'
  if (email.trim().length > 255) return '255文字以内で入力してください'
  return null
}

/** @returns {Record<string, string>} 項目名 → エラーメッセージ(エラーが無ければ空) */
export function validateLogin({ email, password }) {
  const errors = {}
  const emailError = validateEmail(email)
  if (emailError) errors.email = emailError
  if (!password) errors.password = 'パスワードを入力してください'
  return errors
}

export function validateSignup({ username, displayName, email, password, passwordConfirm }) {
  const errors = {}

  if (!username) errors.username = 'ユーザー名を入力してください'
  else if (!USERNAME_PATTERN.test(username)) errors.username = '半角英数字と _ のみ使用できます'
  else if (username.length < 3 || username.length > 15) errors.username = '3〜15文字で入力してください'

  if (!displayName.trim()) errors.displayName = '表示名を入力してください'
  else if (displayName.trim().length > 50) errors.displayName = '50文字以内で入力してください'

  const emailError = validateEmail(email)
  if (emailError) errors.email = emailError

  if (!password) errors.password = 'パスワードを入力してください'
  else if (password.length < 8 || password.length > 72) errors.password = '8〜72文字で入力してください'
  else if (!PASSWORD_CHARS.test(password)) errors.password = '使えるのは半角英数字・記号のみです'
  else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password))
    errors.password = '英字と数字を両方含めてください'

  if (password !== passwordConfirm) errors.passwordConfirm = 'パスワードが一致しません'

  return errors
}

/** サーバーの errors([{ field, message }])を 項目名 → メッセージ の形にする(同じ項目は最初の1件) */
export function toFieldErrors(apiErrors) {
  const result = {}
  for (const { field, message } of apiErrors) {
    if (field && !result[field]) result[field] = message
  }
  return result
}

/** 指定した項目のエラーを取り除く。消すものが無ければ同じオブジェクトを返す(余計な再描画をしないため) */
export function omitFieldErrors(errors, fields) {
  if (!fields.some((field) => field in errors)) return errors
  const result = { ...errors }
  for (const field of fields) delete result[field]
  return result
}
