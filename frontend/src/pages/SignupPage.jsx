import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/useAuth.js'
import { FormField } from '../components/FormField.jsx'
import { omitFieldErrors, toFieldErrors, validateSignup } from '../utils/authValidation.js'

const INITIAL_FORM = { username: '', displayName: '', email: '', password: '', passwordConfirm: '' }

/** SC-02 新規登録(AUTH-01)。登録に成功したらそのままログイン状態になる */
export function SignupPage() {
  const { signup } = useAuth()

  const [form, setForm] = useState(INITIAL_FORM)
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm({ ...form, [name]: value })
    // 直し始めた欄のエラーは消す(チェック自体は送信時に行う)。
    // パスワードを直したら、確認欄の「一致しません」も古くなるので一緒に消す
    const fields = name === 'password' ? [name, 'passwordConfirm'] : [name]
    setFieldErrors((errors) => omitFieldErrors(errors, fields))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return

    const errors = validateSignup(form)
    setFieldErrors(errors)
    setFormError('')
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      // 成功するとログイン状態になり、GuestOnly がホームへ移動させる
      await signup({
        username: form.username,
        displayName: form.displayName.trim(),
        email: form.email.trim(),
        password: form.password,
      })
    } catch (err) {
      const serverFieldErrors = toFieldErrors(err.errors ?? [])
      setFieldErrors(serverFieldErrors)
      // 項目ごとのエラーが無いとき(サーバーに繋がらない等)は、上にまとめて表示する
      setFormError(Object.keys(serverFieldErrors).length > 0 ? '' : err.message)
      setSubmitting(false)
    }
  }

  return (
    <main className="auth">
      <div className="auth__card">
        <h1 className="auth__logo">SNS TimeLine</h1>
        <h2 className="auth__title">アカウント作成</h2>

        {formError && (
          <p className="auth__error" role="alert">
            {formError}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <FormField
            id="username"
            name="username"
            label="ユーザー名"
            prefix="@"
            autoComplete="username"
            maxLength={15}
            value={form.username}
            onChange={handleChange}
            error={fieldErrors.username}
          />
          <FormField
            id="displayName"
            name="displayName"
            label="表示名"
            autoComplete="nickname"
            maxLength={50}
            value={form.displayName}
            onChange={handleChange}
            error={fieldErrors.displayName}
          />
          <FormField
            id="email"
            name="email"
            type="email"
            label="メールアドレス"
            autoComplete="email"
            value={form.email}
            onChange={handleChange}
            error={fieldErrors.email}
          />
          <FormField
            id="password"
            name="password"
            type="password"
            label="パスワード"
            autoComplete="new-password"
            maxLength={72}
            value={form.password}
            onChange={handleChange}
            error={fieldErrors.password}
          />
          <FormField
            id="passwordConfirm"
            name="passwordConfirm"
            type="password"
            label="パスワード(確認)"
            autoComplete="new-password"
            maxLength={72}
            value={form.passwordConfirm}
            onChange={handleChange}
            error={fieldErrors.passwordConfirm}
          />
          <p className="field__hint auth__hint">
            ユーザー名は半角英数字と _ で3〜15文字。パスワードは英字と数字を含む8〜72文字(半角英数字・記号)。
          </p>
          <button type="submit" className="btn btn--primary btn--large" disabled={submitting}>
            {submitting ? '登録中…' : '登録する'}
          </button>
        </form>

        <p className="auth__switch">
          アカウントをお持ちの方は <Link to="/login">ログイン</Link>
        </p>
      </div>
    </main>
  )
}
