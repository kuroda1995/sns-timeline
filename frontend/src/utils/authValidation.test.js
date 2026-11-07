import { describe, expect, it } from 'vitest'
import { omitFieldErrors, toFieldErrors, validateLogin, validateSignup } from './authValidation.js'

const VALID_SIGNUP = {
  username: 'hanako_01',
  displayName: '花子',
  email: 'hanako@example.com',
  password: 'password123',
  passwordConfirm: 'password123',
}

describe('validateLogin', () => {
  it('正しく入力されていればエラーなし', () => {
    expect(validateLogin({ email: 'hanako@example.com', password: 'x' })).toEqual({})
  })

  it('未入力の項目にエラーを出す', () => {
    expect(validateLogin({ email: '  ', password: '' })).toEqual({
      email: 'メールアドレスを入力してください',
      password: 'パスワードを入力してください',
    })
  })

  it.each(['hanako', 'hanako@', 'hanako@example', 'han ako@example.com'])(
    'メールアドレスの形式でなければエラー: %s',
    (email) => {
      expect(validateLogin({ email, password: 'x' }).email).toBe('メールアドレスの形式で入力してください')
    },
  )

  it('前後の空白は無視してメールアドレスを判定する', () => {
    expect(validateLogin({ email: ' hanako@example.com ', password: 'x' })).toEqual({})
  })

  it('メールアドレスが256文字以上ならエラー', () => {
    const email = `${'a'.repeat(244)}@example.com` // 256文字
    expect(validateLogin({ email, password: 'x' }).email).toBe('255文字以内で入力してください')
    expect(validateLogin({ email: email.slice(1), password: 'x' })).toEqual({})
  })
})

describe('validateSignup', () => {
  it('正しく入力されていればエラーなし', () => {
    expect(validateSignup(VALID_SIGNUP)).toEqual({})
  })

  it('すべて未入力ならすべての項目にエラー', () => {
    const errors = validateSignup({ username: '', displayName: '', email: '', password: '', passwordConfirm: '' })
    expect(Object.keys(errors)).toEqual(['username', 'displayName', 'email', 'password'])
  })

  describe('ユーザー名', () => {
    it.each([
      ['ab', '3〜15文字で入力してください'],
      ['a'.repeat(16), '3〜15文字で入力してください'],
      ['はなこ', '半角英数字と _ のみ使用できます'],
      ['hana-ko', '半角英数字と _ のみ使用できます'],
    ])('%s はエラー', (username, message) => {
      expect(validateSignup({ ...VALID_SIGNUP, username }).username).toBe(message)
    })

    it.each(['abc', 'a'.repeat(15), 'Taro_99'])('%s はOK', (username) => {
      expect(validateSignup({ ...VALID_SIGNUP, username }).username).toBeUndefined()
    })
  })

  describe('表示名', () => {
    it('空白だけはエラー', () => {
      expect(validateSignup({ ...VALID_SIGNUP, displayName: '   ' }).displayName).toBe('表示名を入力してください')
    })

    it('50文字まではOK、51文字はエラー', () => {
      expect(validateSignup({ ...VALID_SIGNUP, displayName: 'あ'.repeat(50) }).displayName).toBeUndefined()
      expect(validateSignup({ ...VALID_SIGNUP, displayName: 'あ'.repeat(51) }).displayName).toBe(
        '50文字以内で入力してください',
      )
    })
  })

  describe('パスワード', () => {
    const withPassword = (password) => validateSignup({ ...VALID_SIGNUP, password, passwordConfirm: password })

    it.each([
      ['abc1234', '8〜72文字で入力してください'],
      [`a1${'b'.repeat(71)}`, '8〜72文字で入力してください'],
      ['パスワード12345678', '使えるのは半角英数字・記号のみです'],
      ['pass word1', '使えるのは半角英数字・記号のみです'],
      ['password', '英字と数字を両方含めてください'],
      ['12345678', '英字と数字を両方含めてください'],
    ])('%s はエラー', (password, message) => {
      expect(withPassword(password).password).toBe(message)
    })

    it.each(['abcdefg1', `a1${'b'.repeat(70)}`, 'P@ss-w0rd!'])('%s はOK', (password) => {
      expect(withPassword(password).password).toBeUndefined()
    })

    it('確認用と一致しなければエラー', () => {
      expect(validateSignup({ ...VALID_SIGNUP, passwordConfirm: 'password124' }).passwordConfirm).toBe(
        'パスワードが一致しません',
      )
    })
  })
})

describe('toFieldErrors', () => {
  it('項目名 → メッセージの形にし、同じ項目は最初の1件だけ使う', () => {
    expect(
      toFieldErrors([
        { field: 'username', message: '既に使われています' },
        { field: 'username', message: '2件目' },
        { field: 'email', message: 'メールの誤り' },
        { field: null, message: '項目なし' },
      ]),
    ).toEqual({ username: '既に使われています', email: 'メールの誤り' })
  })
})

describe('omitFieldErrors', () => {
  it('指定した項目のエラーを取り除いた新しいオブジェクトを返す', () => {
    const errors = { email: 'a', password: 'b', username: 'c' }
    const result = omitFieldErrors(errors, ['email', 'password'])

    expect(result).toEqual({ username: 'c' })
    expect(errors).toEqual({ email: 'a', password: 'b', username: 'c' })
  })

  it('消すものが無ければ同じオブジェクトを返す(余計な再描画をしない)', () => {
    const errors = { username: 'c' }
    expect(omitFieldErrors(errors, ['email'])).toBe(errors)
  })
})
