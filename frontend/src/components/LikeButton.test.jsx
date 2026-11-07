import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as postsApi from '../api/postsApi.js'
import { deferred, makePost } from '../test/fixtures.js'
import { LikeButton } from './LikeButton.jsx'

vi.mock('../api/postsApi.js')

/** 画面と同じく、onChange で受け取った内容を投稿に反映する親 */
function Harness({ initial, onChange }) {
  const [post, setPost] = useState(initial)
  return (
    <LikeButton
      post={post}
      onChange={(postId, patch) => {
        onChange?.(postId, patch)
        setPost((p) => ({ ...p, ...patch }))
      }}
    />
  )
}

const button = () => screen.getByRole('button', { name: /いいね/ })

describe('LikeButton', () => {
  beforeEach(() => {
    vi.spyOn(window, 'alert').mockImplementation(() => {})
  })

  it('いいね数が0のときは数字を表示しない', () => {
    render(<Harness initial={makePost({ likeCount: 0 })} />)

    expect(button()).toHaveAccessibleName('いいね 0件')
    expect(button()).toHaveTextContent(/^♡$/)
    expect(button()).toHaveAttribute('aria-pressed', 'false')
  })

  it('押すとサーバーの返事を待たずに表示を切り替え、返ってきた件数で上書きする', async () => {
    const req = deferred()
    postsApi.likePost.mockReturnValue(req.promise)
    render(<Harness initial={makePost({ id: 5, likeCount: 3 })} />)

    await userEvent.click(button())

    // 楽観的更新
    expect(button()).toHaveAttribute('aria-pressed', 'true')
    expect(button()).toHaveTextContent('♥4')
    expect(postsApi.likePost).toHaveBeenCalledWith(5)

    // 他の人のいいねも含めた最新の件数
    req.resolve({ likeCount: 10, likedByMe: true })
    await waitFor(() => expect(button()).toHaveTextContent('♥10'))
  })

  it('いいね済みなら取り消す', async () => {
    postsApi.unlikePost.mockResolvedValue({ likeCount: 0, likedByMe: false })
    render(<Harness initial={makePost({ likeCount: 1, likedByMe: true })} />)

    await userEvent.click(button())

    await waitFor(() => expect(button()).toHaveAttribute('aria-pressed', 'false'))
    expect(postsApi.unlikePost).toHaveBeenCalledOnce()
    expect(button()).toHaveAccessibleName('いいね 0件')
  })

  it('失敗したら元の表示に戻してお知らせする', async () => {
    postsApi.likePost.mockRejectedValue(new Error('network'))
    render(<Harness initial={makePost({ likeCount: 3 })} />)

    await userEvent.click(button())

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('いいねできませんでした'))
    expect(button()).toHaveAttribute('aria-pressed', 'false')
    expect(button()).toHaveTextContent('♡3')
  })

  it('通信中に連打されても同時にリクエストを出さず、最後に押した状態にそろえる', async () => {
    const first = deferred()
    postsApi.likePost.mockReturnValueOnce(first.promise)
    postsApi.unlikePost.mockResolvedValue({ likeCount: 3, likedByMe: false })
    render(<Harness initial={makePost({ likeCount: 3 })} />)

    // いいね → (通信中に)取り消し → いいね → 取り消し: 最後は「いいねしていない」
    await userEvent.click(button())
    await userEvent.click(button())
    await userEvent.click(button())
    await userEvent.click(button())
    expect(postsApi.likePost).toHaveBeenCalledOnce()
    expect(button()).toHaveAttribute('aria-pressed', 'false')

    first.resolve({ likeCount: 4, likedByMe: true })

    // 1件目が終わってから、最後の状態(取り消し)を1回だけ送る
    await waitFor(() => expect(postsApi.unlikePost).toHaveBeenCalledOnce())
    await waitFor(() => expect(button()).toHaveTextContent('♡3'))
    expect(postsApi.likePost).toHaveBeenCalledOnce()
  })

  it('押した結果を投稿IDと一緒に親へ伝える', async () => {
    postsApi.likePost.mockResolvedValue({ likeCount: 1, likedByMe: true })
    const onChange = vi.fn()
    render(<Harness initial={makePost({ id: 7 })} onChange={onChange} />)

    await userEvent.click(button())

    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(7, { likeCount: 1, likedByMe: true }))
  })
})
