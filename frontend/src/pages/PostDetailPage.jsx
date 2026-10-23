import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import * as postsApi from '../api/postsApi.js'
import { CommentSection } from '../components/CommentSection.jsx'
import { PostCard } from '../components/PostCard.jsx'
import { useAppLayout } from '../layout/useAppLayout.js'

/** SC-05 投稿詳細(PST-03)と、その投稿へのコメント(CMT-01〜04) */
export function PostDetailPage() {
  const { postId } = useParams()
  const navigate = useNavigate()
  const { timeline, openComposer } = useAppLayout()
  // { postId, post, error } の形で、どの投稿を読み込んだ結果かを持つ
  const [result, setResult] = useState(null)

  useEffect(() => {
    window.scrollTo(0, 0)
    let cancelled = false
    postsApi
      .getPost(postId)
      .then((post) => {
        if (!cancelled) setResult({ postId, post, error: null })
      })
      .catch((err) => {
        if (!cancelled) setResult({ postId, post: null, error: err })
      })
    return () => {
      cancelled = true
    }
  }, [postId])

  const loaded = result?.postId === postId ? result : null

  const goBack = () => {
    // このアプリ内から開いた場合は前の画面へ、URLを直接開いた場合はタイムラインへ
    if (window.history.state?.idx > 0) navigate(-1)
    else navigate('/')
  }

  const handleEdit = (post) =>
    openComposer(post, (saved) => setResult({ postId, post: saved, error: null }))

  // いいね・コメント数の変更は、この画面とタイムラインの両方に反映する(戻ったときに表示がずれないように)
  const handlePostChange = (id, patch) => {
    setResult((r) => (r?.post?.id === id ? { ...r, post: { ...r.post, ...patch } } : r))
    timeline.patchPost(id, patch)
  }

  const handleDeleted = (id) => {
    timeline.removePost(id)
    navigate('/', { replace: true })
  }

  let body
  if (!loaded) {
    body = <p className="list-status">読み込み中…</p>
  } else if (loaded.error) {
    // 400(IDが数値でない)・404 は、どちらも「見つからない」として案内する
    const notFound = loaded.error.status === 404 || loaded.error.status === 400
    body = (
      <div className="notice">
        <strong>{notFound ? 'この投稿は削除されたか、存在しません' : '投稿を読み込めませんでした'}</strong>
        {!notFound && <p>{loaded.error.message}</p>}
      </div>
    )
  } else {
    body = (
      <>
        <PostCard
          post={loaded.post}
          detail
          onEdit={handleEdit}
          onDeleted={handleDeleted}
          onPostChange={handlePostChange}
        />
        <CommentSection
          key={postId}
          postId={postId}
          onCountChange={(commentCount) => handlePostChange(loaded.post.id, { commentCount })}
        />
      </>
    )
  }

  return (
    <>
      <header className="page-header">
        <button type="button" className="icon-btn" aria-label="戻る" onClick={goBack}>
          ←
        </button>
        <h1>投稿</h1>
      </header>
      {body}
    </>
  )
}
