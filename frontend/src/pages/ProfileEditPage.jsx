import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import * as usersApi from '../api/usersApi.js'
import { useAuth } from '../auth/useAuth.js'
import { Avatar } from '../components/Avatar.jsx'
import { FormField } from '../components/FormField.jsx'
import { useAppLayout } from '../layout/useAppLayout.js'
import { ACCEPTED_IMAGE_TYPES, validateImageFile } from '../utils/imageUtils.js'
import { profilePath } from '../utils/paths.js'
import { countChars, isBlank } from '../utils/textUtils.js'

const MAX_DISPLAY_NAME_LENGTH = 50
const MAX_BIO_LENGTH = 160

/**
 * SC-07 プロフィール編集(USER-02)。表示名・自己紹介・アイコン画像(U-06)を変更する。
 * アイコンは選ぶとすぐに丸いプレビューを表示し、「保存」を押したときにアップロードする。
 */
export function ProfileEditPage() {
  const { user, updateUser } = useAuth()
  const { timeline } = useAppLayout()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState(user.displayName)
  const [bio, setBio] = useState(user.bio ?? '')
  // 選んだアイコン画像 { file, url } | null。url はプレビュー用(URL.createObjectURL)
  const [avatar, setAvatar] = useState(null)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef(null)

  // プレビュー用のURLは、選び直したとき・画面を離れたときに解放する
  useEffect(() => () => avatar && URL.revokeObjectURL(avatar.url), [avatar])

  const textChanged = displayName.trim() !== user.displayName || bio.trim() !== (user.bio ?? '')
  const changed = textChanged || avatar != null
  const displayNameError =
    errors.displayName ??
    (countChars(displayName.trim()) > MAX_DISPLAY_NAME_LENGTH ? '50文字以内で入力してください' : '')
  const bioLength = countChars(bio)
  const canSave =
    !saving && changed && !isBlank(displayName) && !displayNameError && countChars(bio.trim()) <= MAX_BIO_LENGTH

  // 入力し直したら、その項目と画面全体のエラーを消す
  const clearError = (field) => setErrors((e) => ({ ...e, [field]: undefined, form: undefined }))

  const handleSelectAvatar = (e) => {
    const file = e.target.files[0]
    // 同じファイルをもう一度選べるよう、選択状態を空に戻す
    e.target.value = ''
    if (!file) return
    const invalid = validateImageFile(file)
    if (invalid) {
      setErrors((current) => ({ ...current, avatar: invalid }))
      return
    }
    clearError('avatar')
    setAvatar({ file, url: URL.createObjectURL(file) })
  }

  const close = () => {
    if (saving) return
    // 変更中に × を押したら確認する
    if (changed && !window.confirm('変更を破棄しますか？')) return
    navigate(profilePath(user.username))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSave) return
    setSaving(true)
    setErrors({})
    try {
      // アイコンを先に保存する(表示名・自己紹介の保存に失敗しても、アイコンは変わった状態で画面に残す)
      if (avatar) {
        const { avatarUrl } = await usersApi.uploadAvatar(avatar.file)
        updateUser({ avatarUrl })
        setAvatar(null)
      }
      if (textChanged) {
        const profile = await usersApi.updateProfile({ displayName, bio })
        updateUser({ displayName: profile.displayName, bio: profile.bio })
      }
      // 読み込み済みのタイムラインの表示名・アイコンを新しくする
      timeline.invalidate()
      navigate(profilePath(user.username), { replace: true })
    } catch (err) {
      const fieldErrors = Object.fromEntries((err.errors ?? []).map((fe) => [fe.field, fe.message]))
      setErrors(Object.keys(fieldErrors).length > 0 ? fieldErrors : { form: err.message })
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <header className="page-header">
        <button type="button" className="icon-btn" aria-label="閉じる" onClick={close}>
          ×
        </button>
        <h1>プロフィール編集</h1>
        <button type="submit" className="btn btn--primary page-header__action" disabled={!canSave}>
          {saving ? '保存中…' : '保存'}
        </button>
      </header>

      <div className="profile-edit">
        <div className="profile-edit__avatar">
          <Avatar
            user={{
              ...user,
              displayName: displayName.trim() || user.displayName,
              avatarUrl: avatar?.url ?? user.avatarUrl,
            }}
            size="large"
          />
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(',')}
              hidden
              onChange={handleSelectAvatar}
            />
            <button
              type="button"
              className="btn btn--outline"
              disabled={saving}
              onClick={() => fileInputRef.current.click()}
            >
              画像を変更
            </button>
            <p className="field__hint">jpg・png・gif・webp、5MBまで</p>
            {errors.avatar && (
              <p className="field__error" role="alert">
                {errors.avatar}
              </p>
            )}
          </div>
        </div>

        {errors.form && (
          <p className="field__error" role="alert">
            {errors.form}
          </p>
        )}

        <FormField
          id="displayName"
          label="表示名"
          value={displayName}
          error={displayNameError}
          onChange={(e) => {
            setDisplayName(e.target.value)
            clearError('displayName')
          }}
        />

        <div className="field">
          <div className="profile-edit__label">
            <label htmlFor="bio">自己紹介</label>
            <span className={`counter${bioLength > MAX_BIO_LENGTH ? ' is-over' : ''}`} aria-live="polite">
              {bioLength}/{MAX_BIO_LENGTH}
            </span>
          </div>
          <textarea
            id="bio"
            className={`textarea${errors.bio ? ' is-invalid' : ''}`}
            value={bio}
            aria-invalid={errors.bio ? 'true' : undefined}
            onChange={(e) => {
              setBio(e.target.value)
              clearError('bio')
            }}
          />
          {errors.bio && <p className="field__error">{errors.bio}</p>}
        </div>
      </div>
    </form>
  )
}
