/**
 * TL-04 投稿が1件も無いときの案内。
 * 「ユーザーを探す」ボタン(SC-09 ユーザー検索への移動)は、ユーザー検索機能を実装するときに追加する。
 */
export function EmptyTimeline({ onCompose }) {
  return (
    <div className="empty">
      <h2>まだ投稿がありません</h2>
      <p>ユーザーを探してフォローしてみましょう。まずは自分で投稿してみることもできます。</p>
      <button type="button" className="btn btn--primary" onClick={onCompose}>
        投稿する
      </button>
    </div>
  )
}
