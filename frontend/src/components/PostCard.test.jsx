import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as postsApi from '../api/postsApi.js'
import { ApiError } from '../api/http.js'
import { makePost } from '../test/fixtures.js'
import { renderWithProviders } from '../test/render.jsx'
import { PostCard } from './PostCard.jsx'

vi.mock('../api/postsApi.js')

function renderCard(post, props = {}) {
  const handlers = { onEdit: vi.fn(), onDeleted: vi.fn(), onPostChange: vi.fn() }
  const result = renderWithProviders(<PostCard post={post} {...handlers} {...props} />)
  return { ...result, ...handlers }
}

describe('PostCard', () => {
  beforeEach(() => {
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('投稿者・本文・経過時間・コメント数・いいね数を表示する', () => {
    renderCard(makePost({ content: 'はじめまして', commentCount: 2, likeCount: 5 }))

    expect(screen.getByRole('link', { name: '太郎' })).toHaveAttribute('href', '/users/taro')
    expect(screen.getByRole('link', { name: '@taro' })).toHaveAttribute('href', '/users/taro')
    expect(screen.getByText('はじめまして')).toBeInTheDocument()
    expect(screen.getByText('5分前')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'コメント 2件' })).toHaveAttribute('href', '/posts/100')
    expect(screen.getByRole('button', { name: 'いいね 5件' })).toBeInTheDocument()
  })

  it('本文の <script> はHTMLとして解釈せず、文字のまま表示する', () => {
    const { container } = renderCard(makePost({ content: '<script>alert(1)</script>' }))

    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument()
    expect(container.querySelector('script')).toBeNull()
  })

  it('編集済みなら「編集済み」と表示する', () => {
    renderCard(makePost({ edited: true }))

    expect(screen.getByText('・編集済み')).toBeInTheDocument()
  })

  it('他人の投稿には編集・削除ボタンを出さない', () => {
    renderCard(makePost({ isMine: false }))

    expect(screen.queryByRole('button', { name: '投稿を編集' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '投稿を削除' })).not.toBeInTheDocument()
  })

  it('自分の投稿の ✏️ で編集を始める', async () => {
    const post = makePost({ isMine: true })
    const { onEdit } = renderCard(post)

    await userEvent.click(screen.getByRole('button', { name: '投稿を編集' }))

    expect(onEdit).toHaveBeenCalledWith(post)
  })

  it('🗑 で確認してから削除する', async () => {
    postsApi.deletePost.mockResolvedValue(null)
    const { onDeleted } = renderCard(makePost({ id: 9, isMine: true }))

    await userEvent.click(screen.getByRole('button', { name: '投稿を削除' }))

    expect(window.confirm).toHaveBeenCalledWith('この投稿を削除しますか？この操作は取り消せません。')
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(9))
    expect(postsApi.deletePost).toHaveBeenCalledWith(9)
  })

  it('削除の確認でキャンセルしたら削除しない', async () => {
    window.confirm.mockReturnValue(false)
    renderCard(makePost({ isMine: true }))

    await userEvent.click(screen.getByRole('button', { name: '投稿を削除' }))

    expect(postsApi.deletePost).not.toHaveBeenCalled()
  })

  it('削除に失敗したらお知らせし、ボタンを押せる状態に戻す', async () => {
    postsApi.deletePost.mockRejectedValue(new ApiError(500, 'サーバーでエラーが発生しました'))
    const { onDeleted } = renderCard(makePost({ isMine: true }))

    await userEvent.click(screen.getByRole('button', { name: '投稿を削除' }))

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('サーバーでエラーが発生しました'))
    expect(onDeleted).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '投稿を削除' })).toBeEnabled()
  })

  it('すでに削除されていた(404)なら画面からも消す', async () => {
    postsApi.deletePost.mockRejectedValue(new ApiError(404, 'この投稿は削除されたか、存在しません'))
    const { onDeleted } = renderCard(makePost({ id: 9, isMine: true }))

    await userEvent.click(screen.getByRole('button', { name: '投稿を削除' }))

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(9))
    expect(window.alert).toHaveBeenCalled()
  })

  it('カードの余白を押すと投稿詳細へ移動する', async () => {
    renderCard(makePost({ id: 42 }))

    await userEvent.click(screen.getByText('こんにちは'))

    expect(screen.getByTestId('location')).toHaveTextContent('/posts/42')
  })

  it('いいねボタンを押しても投稿詳細へは移動しない', async () => {
    postsApi.likePost.mockResolvedValue({ likeCount: 1, likedByMe: true })
    const { onPostChange } = renderCard(makePost({ id: 42 }))

    await userEvent.click(screen.getByRole('button', { name: /いいね/ }))

    expect(screen.queryByTestId('location')).not.toBeInTheDocument()
    expect(onPostChange).toHaveBeenCalledWith(42, { likedByMe: true, likeCount: 1 })
  })

  it('画像だけの投稿は本文を表示せず画像を表示する', () => {
    const { container } = renderCard(makePost({ content: '', images: [{ url: 'http://x/1.png', sortOrder: 1 }] }))

    expect(container.querySelector('.post-card__content')).toBeNull()
    expect(screen.getByRole('button', { name: '画像 1枚目を大きく表示' })).toBeInTheDocument()
  })

  describe('投稿詳細(detail)', () => {
    it('日時をそのまま表示し、コメント数はリンクにしない。押しても移動しない', async () => {
      const createdAt = new Date(2026, 9, 2, 12, 34).toISOString()
      renderCard(makePost({ createdAt, commentCount: 3, edited: true }), { detail: true })
      const article = screen.getByRole('article')

      expect(within(article).getByText('2026/10/02 12:34')).toBeInTheDocument()
      expect(within(article).getByText('・ 編集済み')).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'コメント 3件' })).not.toBeInTheDocument()
      expect(screen.getByLabelText('コメント 3件')).toBeInTheDocument()

      await userEvent.click(screen.getByText('こんにちは'))
      expect(screen.queryByTestId('location')).not.toBeInTheDocument()
    })
  })
})
