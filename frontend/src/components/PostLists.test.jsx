// 投稿詳細のコメント欄(CommentSection)とプロフィールの投稿一覧(UserPostList)のテスト。API をモックにし、フックごと動かす
import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as commentsApi from '../api/commentsApi.js'
import * as postsApi from '../api/postsApi.js'
import * as usersApi from '../api/usersApi.js'
import { ApiError } from '../api/http.js'
import { makeComment, makePost, page, triggerIntersection } from '../test/fixtures.js'
import { renderWithProviders } from '../test/render.jsx'
import { CommentSection } from './CommentSection.jsx'
import { UserPostList } from './UserPostList.jsx'

vi.mock('../api/commentsApi.js')
vi.mock('../api/postsApi.js')
vi.mock('../api/usersApi.js')

const contents = (selector = '.post-card__content') =>
  [...document.querySelectorAll(selector)].map((el) => el.textContent)

beforeEach(() => {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  vi.spyOn(window, 'alert').mockImplementation(() => {})
})

describe('CommentSection', () => {
  it('コメントが無ければ案内を表示する', async () => {
    commentsApi.getComments.mockResolvedValue(page([]))
    renderWithProviders(<CommentSection postId={100} onCountChange={vi.fn()} />)

    expect(screen.getByText('読み込み中…')).toBeInTheDocument()
    expect(await screen.findByText('まだコメントはありません')).toBeInTheDocument()
    expect(commentsApi.getComments).toHaveBeenCalledWith(100)
  })

  it('コメントを送信すると一覧に追加し、最新のコメント数を伝える', async () => {
    commentsApi.getComments.mockResolvedValue(page([makeComment({ id: 1, content: '1つ目' })]))
    commentsApi.createComment.mockResolvedValue({
      comment: makeComment({ id: 2, content: '2つ目', isMine: true }),
      commentCount: 2,
    })
    const onCountChange = vi.fn()
    renderWithProviders(<CommentSection postId={100} onCountChange={onCountChange} />)
    await screen.findByText('1つ目')

    await userEvent.type(screen.getByRole('textbox', { name: 'コメント' }), '2つ目')
    await userEvent.click(screen.getByRole('button', { name: '送信' }))

    await waitFor(() => expect(contents()).toEqual(['1つ目', '2つ目']))
    expect(commentsApi.createComment).toHaveBeenCalledWith(100, '2つ目')
    expect(onCountChange).toHaveBeenCalledWith(2)
  })

  it('自分のコメントを削除すると一覧から消し、最新のコメント数を伝える', async () => {
    commentsApi.getComments.mockResolvedValue(
      page([makeComment({ id: 1, content: '消す', isMine: true }), makeComment({ id: 2, content: '残す' })]),
    )
    commentsApi.deleteComment.mockResolvedValue({ commentCount: 1 })
    const onCountChange = vi.fn()
    renderWithProviders(<CommentSection postId={100} onCountChange={onCountChange} />)
    await screen.findByText('消す')

    await userEvent.click(screen.getByRole('button', { name: 'コメントを削除' }))

    await waitFor(() => expect(contents()).toEqual(['残す']))
    expect(onCountChange).toHaveBeenCalledWith(1)
  })

  it('末尾までスクロールしたら、続きのコメントを古い順に追加する', async () => {
    commentsApi.getComments
      .mockResolvedValueOnce(page([makeComment({ id: 1, content: 'a' })], { nextCursor: 1, hasNext: true }))
      .mockResolvedValueOnce(page([makeComment({ id: 2, content: 'b' })]))
    renderWithProviders(<CommentSection postId={100} onCountChange={vi.fn()} />)
    await screen.findByText('a')

    act(() => triggerIntersection())

    await waitFor(() => expect(contents()).toEqual(['a', 'b']))
    expect(commentsApi.getComments).toHaveBeenLastCalledWith(100, 1)
  })

  it('読み込めなければエラーを表示し、「再読み込み」で読み込み直せる', async () => {
    commentsApi.getComments
      .mockRejectedValueOnce(new ApiError(0, 'サーバーに接続できませんでした'))
      .mockResolvedValueOnce(page([makeComment({ content: '読み込めた' })]))
    renderWithProviders(<CommentSection postId={100} onCountChange={vi.fn()} />)

    expect(await screen.findByText('コメントを読み込めませんでした（サーバーに接続できませんでした）')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '再読み込み' }))

    expect(await screen.findByText('読み込めた')).toBeInTheDocument()
  })
})

describe('UserPostList', () => {
  it('投稿が無ければ案内を表示する', async () => {
    usersApi.getUserPosts.mockResolvedValue(page([]))
    renderWithProviders(<UserPostList username="taro" />)

    expect(await screen.findByText('まだ投稿がありません')).toBeInTheDocument()
    expect(usersApi.getUserPosts).toHaveBeenCalledWith('taro')
  })

  it('末尾までスクロールしたら続きを読み込み、最後まで来たらそう表示する', async () => {
    usersApi.getUserPosts
      .mockResolvedValueOnce(page([makePost({ id: 3, content: '3' }), makePost({ id: 2, content: '2' })], { nextCursor: 2, hasNext: true }))
      .mockResolvedValueOnce(page([makePost({ id: 1, content: '1' })]))
    renderWithProviders(<UserPostList username="taro" />)
    await screen.findByText('3')
    expect(screen.queryByText('これ以上投稿はありません')).not.toBeInTheDocument()

    act(() => triggerIntersection())

    await waitFor(() => expect(contents()).toEqual(['3', '2', '1']))
    expect(usersApi.getUserPosts).toHaveBeenLastCalledWith('taro', 2)
    expect(screen.getByText('これ以上投稿はありません')).toBeInTheDocument()
  })

  it('削除した投稿は、この一覧とタイムラインの両方から消す', async () => {
    usersApi.getUserPosts.mockResolvedValue(page([makePost({ id: 5, content: '消す', isMine: true })]))
    postsApi.deletePost.mockResolvedValue(null)
    const { layout } = renderWithProviders(<UserPostList username="hanako" />)
    await screen.findByText('消す')

    await userEvent.click(screen.getByRole('button', { name: '投稿を削除' }))

    expect(await screen.findByText('まだ投稿がありません')).toBeInTheDocument()
    expect(layout.timeline.removePost).toHaveBeenCalledWith(5)
  })

  it('いいねの結果は、この一覧とタイムラインの両方に反映する', async () => {
    usersApi.getUserPosts.mockResolvedValue(page([makePost({ id: 5 })]))
    postsApi.likePost.mockResolvedValue({ likeCount: 1, likedByMe: true })
    const { layout } = renderWithProviders(<UserPostList username="taro" />)

    await userEvent.click(await screen.findByRole('button', { name: 'いいね 0件' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'いいね 1件' })).toBeInTheDocument())
    expect(layout.timeline.patchPost).toHaveBeenCalledWith(5, { likeCount: 1, likedByMe: true })
  })

  it('✏️ で投稿作成モーダルを編集として開き、保存結果をこの一覧に反映する', async () => {
    const post = makePost({ id: 5, content: '編集前', isMine: true })
    usersApi.getUserPosts.mockResolvedValue(page([post]))
    const { layout } = renderWithProviders(<UserPostList username="hanako" />)

    await userEvent.click(await screen.findByRole('button', { name: '投稿を編集' }))

    expect(layout.openComposer).toHaveBeenCalledWith(post, expect.any(Function))
    const onSaved = layout.openComposer.mock.calls[0][1]
    act(() => onSaved({ ...post, content: '編集後', edited: true }))
    expect(screen.getByText('編集後')).toBeInTheDocument()
  })

  it('読み込めなければエラーを表示する', async () => {
    usersApi.getUserPosts.mockRejectedValue(new ApiError(500, 'サーバーでエラーが発生しました'))
    renderWithProviders(<UserPostList username="taro" />)

    expect(await screen.findByText('投稿を読み込めませんでした（サーバーでエラーが発生しました）')).toBeInTheDocument()
  })
})
