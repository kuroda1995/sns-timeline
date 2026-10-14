import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/useAuth.js'
import { FormField } from '../components/FormField.jsx'
import { omitFieldErrors, toFieldErrors, validateLogin } from '../utils/authValidation.js'

/** SC-01 ログイン(AUTH-02) */
export function LoginPage() {
  const { login } = useAuth()

  const [form, setForm] = useState({ email: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm({ ...form, [name]: value })
    // 直し始めた欄のエラーは消す(チェック自体は送信時に行う)
    setFieldErrors((errors) => omitFieldErrors(errors, [name]))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return

    const errors = validateLogin(form)
    setFieldErrors(errors)
    setFormError('')
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      // 成功するとログイン状態になり、GuestOnly が元の画面(なければホーム)へ移動させる
      await login({ email: form.email.trim(), password: form.password })
    } catch (err) {
      setFieldErrors(toFieldErrors(err.errors ?? []))
      setFormError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <main className="auth">
      <div className="auth__card">
        <h1 className="auth__logo">SNS TimeLine</h1>
        <h2 className="auth__title">ログイン</h2>

        {formError && (
          <p className="auth__error" role="alert">
            {formError}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate>
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
            autoComplete="current-password"
            value={form.password}
            onChange={handleChange}
            error={fieldErrors.password}
          />
          <button type="submit" className="btn btn--primary btn--large" disabled={submitting}>
            {submitting ? 'ログイン中…' : 'ログイン'}
          </button>
        </form>

        <p className="auth__switch">
          アカウントをお持ちでない方は <Link to="/signup">新規登録</Link>
        </p>
      </div>
    </main>
  )
}
