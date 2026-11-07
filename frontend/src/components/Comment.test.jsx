// コメントの入力欄(CommentForm)とコメント1件(CommentItem)のテスト
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as commentsApi from '../api/commentsApi.js'
import { ApiError } from '../api/http.js'
import { deferred, makeComment } from '../test/fixtures.js'
import { renderWithProviders } from '../test/render.jsx'
import { CommentForm } from './CommentForm.jsx'
import { CommentItem } from './CommentItem.jsx'

vi.mock('../api/commentsApi.js')

describe('CommentForm', () => {
  const textarea = () => screen.getByRole('textbox', { name: 'コメント' })
  const submitButton = () => screen.getByRole('button', { name: /送信/ })

  it('空・空白だけ・141文字以上では送信できない', async () => {
    renderWithProviders(<CommentForm onSubmit={vi.fn()} />)

    expect(submitButton()).toBeDisabled()
    await userEvent.type(textarea(), '   ')
    expect(submitButton()).toBeDisabled()

    fireEvent.change(textarea(), { target: { value: 'あ'.repeat(141) } })
    expect(screen.getByText('残り -1 文字')).toBeInTheDocument()
    expect(submitButton()).toBeDisabled()
  })

  it('送信中は「送信中…」にし、成功したら入力欄を空に戻す', async () => {
    const req = deferred()
    const onSubmit = vi.fn(() => req.promise)
    renderWithProviders(<CommentForm onSubmit={onSubmit} />)

    await userEvent.type(textarea(), 'よろしく')
    await userEvent.click(submitButton())

    expect(onSubmit).toHaveBeenCalledWith('よろしく')
    expect(submitButton()).toHaveTextContent('送信中…')
    expect(submitButton()).toBeDisabled()

    req.resolve()
    await waitFor(() => expect(textarea()).toHaveValue(''))
  })

  it('Ctrl+Enter でも送信できる', async () => {
    const onSubmit = vi.fn().mockResolvedValue()
    renderWithProviders(<CommentForm onSubmit={onSubmit} />)

    await userEvent.type(textarea(), 'よろしく')
    await userEvent.keyboard('{Control>}{Enter}{/Control}')

    expect(onSubmit).toHaveBeenCalledOnce()
  })

  it('失敗したらエラーを表示して入力内容を残し、入力し直すとエラーを消す', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ApiError(404, 'この投稿は削除されたか、存在しません'))
    renderWithProviders(<CommentForm onSubmit={onSubmit} />)

    await userEvent.type(textarea(), 'よろしく')
    await userEvent.click(submitButton())

    expect(await screen.findByRole('alert')).toHaveTextContent('この投稿は削除されたか、存在しません')
    expect(textarea()).toHaveValue('よろしく')

    await userEvent.type(textarea(), '!')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('CommentItem', () => {
  beforeEach(() => {
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('コメント者・本文・経過時間を表示し、他人のコメントには削除ボタンを出さない', () => {
    renderWithProviders(<CommentItem comment={makeComment({ content: '<b>太字</b>' })} onDeleted={vi.fn()} />)

    expect(screen.getByRole('link', { name: '太郎' })).toHaveAttribute('href', '/users/taro')
    // HTMLとして解釈しない
    expect(screen.getByText('<b>太字</b>')).toBeInTheDocument()
    expect(screen.getByText('1分前')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'コメントを削除' })).not.toBeInTheDocument()
  })

  it('自分のコメントは確認してから削除し、最新のコメント数を伝える', async () => {
    commentsApi.deleteComment.mockResolvedValue({ commentCount: 4 })
    const onDeleted = vi.fn()
    renderWithProviders(<CommentItem comment={makeComment({ id: 3, isMine: true })} onDeleted={onDeleted} />)

    await userEvent.click(screen.getByRole('button', { name: 'コメントを削除' }))

    expect(window.confirm).toHaveBeenCalledWith('このコメントを削除しますか？この操作は取り消せません。')
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(3, 4))
  })

  it('確認でキャンセルしたら削除しない', async () => {
    window.confirm.mockReturnValue(false)
    renderWithProviders(<CommentItem comment={makeComment({ isMine: true })} onDeleted={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'コメントを削除' }))

    expect(commentsApi.deleteComment).not.toHaveBeenCalled()
  })

  it('すでに削除されていた(404)なら、件数は分からないまま画面から消す', async () => {
    commentsApi.deleteComment.mockRejectedValue(new ApiError(404, 'このコメントは削除されたか、存在しません'))
    const onDeleted = vi.fn()
    renderWithProviders(<CommentItem comment={makeComment({ id: 3, isMine: true })} onDeleted={onDeleted} />)

    await userEvent.click(screen.getByRole('button', { name: 'コメントを削除' }))

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(3, null))
    expect(window.alert).toHaveBeenCalledWith('このコメントは削除されたか、存在しません')
  })

  it('その他の失敗ではお知らせだけして、画面に残す', async () => {
    commentsApi.deleteComment.mockRejectedValue(new ApiError(500, 'サーバーでエラーが発生しました'))
    const onDeleted = vi.fn()
    renderWithProviders(<CommentItem comment={makeComment({ isMine: true })} onDeleted={onDeleted} />)

    await userEvent.click(screen.getByRole('button', { name: 'コメントを削除' }))

    await waitFor(() => expect(window.alert).toHaveBeenCalled())
    expect(onDeleted).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'コメントを削除' })).toBeEnabled()
  })
})
