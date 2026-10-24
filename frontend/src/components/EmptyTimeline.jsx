import { Link } from 'react-router'

/** TL-04 投稿が1件も無いときの案内。フォローする相手を探せるよう、ユーザー検索(SC-09)へ案内する */
export function EmptyTimeline({ onCompose }) {
  return (
    <div className="empty">
      <h2>まだ投稿がありません</h2>
      <p>ユーザーを探してフォローしてみましょう。まずは自分で投稿してみることもできます。</p>
      <div className="empty__actions">
        <Link to="/search" className="btn btn--primary">
          ユーザーを探す
        </Link>
        <button type="button" className="btn btn--outline" onClick={onCompose}>
          投稿する
        </button>
      </div>
    </div>
  )
}
