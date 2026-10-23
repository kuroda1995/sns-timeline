/**
 * ユーザーのアイコン。画像が無い場合は表示名の1文字目を、ユーザーごとに決まった色で表示する
 */
export function Avatar({ user, size }) {
  const className = `avatar${size ? ` avatar--${size}` : ''}`
  if (user.avatarUrl) {
    return (
      <span className={className}>
        <img src={user.avatarUrl} alt="" />
      </span>
    )
  }
  const hue = (user.id * 67) % 360
  return (
    <span className={className} style={{ background: `hsl(${hue}, 55%, 50%)` }} aria-hidden="true">
      {[...user.displayName][0] ?? '?'}
    </span>
  )
}
