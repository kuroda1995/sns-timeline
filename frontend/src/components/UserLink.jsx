import { Link } from 'react-router'
import { profilePath } from '../utils/paths.js'

/**
 * 表示名・@ユーザー名・アイコンを、そのユーザーのプロフィールへのリンクにする(SRCH-03)。
 * 投稿カード・コメントで使う。
 */
export function UserLink({ username, className = '', children, ...props }) {
  return (
    <Link to={profilePath(username)} className={`user-link ${className}`.trim()} {...props}>
      {children}
    </Link>
  )
}
