import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as postsApi from '../api/postsApi.js'
import { ApiError } from '../api/http.js'
import { deferred, makePost } from '../test/fixtures.js'
import { renderWithProviders } from '../test/render.jsx'
import { PostComposerModal } from './PostComposerModal.jsx'

vi.mock('../api/postsApi.js')

const imageFile = (name, type = 'image/png', size = 100) => {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

function renderComposer(props = {}) {
  const handlers = { onClose: vi.fn(), onSaved: vi.fn() }
  const result = renderWithProviders(<PostComposerModal {...handlers} {...props} />)
  return { ...result, ...handlers }
}

const textarea = () => screen.getByRole('textbox', { name: '本文' })
const submitButton = () => screen.getByRole('button', { name: /^(投稿|保存|送信中…)$/ })
const fileInput = (container) => container.querySelector('input[type="file"]')

describe('PostComposerModal(投稿作成)', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('開いたら本文にフォーカスし、空のうちは投稿できない', () => {
    renderComposer()

    expect(screen.getByRole('dialog', { name: '投稿する' })).toBeInTheDocument()
    expect(textarea()).toHaveFocus()
    expect(screen.getByText('残り 140 文字')).toBeInTheDocument()
    expect(submitButton()).toBeDisabled()
  })

  it('空白・改行だけでは投稿できない', async () => {
    renderComposer()

    await userEvent.type(textarea(), '   {enter}  ')

    expect(submitButton()).toBeDisabled()
  })

  it('残りの文字数を表示し、140文字を超えたら投稿できない', async () => {
    renderComposer()

    fireEvent.change(textarea(), { target: { value: 'あ'.repeat(140) } })
    expect(screen.getByText('残り 0 文字')).toBeInTheDocument()
    expect(submitButton()).toBeEnabled()

    fireEvent.change(textarea(), { target: { value: 'あ'.repeat(141) } })
    expect(screen.getByText('残り -1 文字')).toHaveClass('is-over')
    expect(submitButton()).toBeDisabled()
  })

  it('投稿すると、通信中は「送信中…」にし、保存した投稿を渡す', async () => {
    const req = deferred()
    postsApi.createPost.mockReturnValue(req.promise)
    const { onSaved } = renderComposer()

    await userEvent.type(textarea(), 'こんにちは')
    await userEvent.click(submitButton())

    expect(postsApi.createPost).toHaveBeenCalledWith({ content: 'こんにちは', images: [] })
    expect(submitButton()).toHaveTextContent('送信中…')
    expect(submitButton()).toBeDisabled()

    const saved = makePost({ content: 'こんにちは' })
    req.resolve(saved)
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved))
  })

  it('Ctrl+Enter でも投稿できる', async () => {
    postsApi.createPost.mockResolvedValue(makePost())
    renderComposer()

    await userEvent.type(textarea(), 'こんにちは')
    await userEvent.keyboard('{Control>}{Enter}{/Control}')

    expect(postsApi.createPost).toHaveBeenCalledOnce()
  })

  it('サーバーのエラーは項目のメッセージを優先して表示し、入力内容を残す', async () => {
    postsApi.createPost.mockRejectedValue(
      new ApiError(400, '入力内容に誤りがあります', [{ field: 'content', message: '140文字以内で入力してください' }]),
    )
    const { onSaved } = renderComposer()

    await userEvent.type(textarea(), 'こんにちは')
    await userEvent.click(submitButton())

    expect(await screen.findByRole('alert')).toHaveTextContent('140文字以内で入力してください')
    expect(textarea()).toHaveValue('こんにちは')
    expect(submitButton()).toBeEnabled()
    expect(onSaved).not.toHaveBeenCalled()
  })

  describe('画像の添付', () => {
    it('画像を選ぶとプレビューを表示し、画像だけでも投稿できる', async () => {
      postsApi.createPost.mockResolvedValue(makePost())
      const { container } = renderComposer()
      const file = imageFile('a.png')

      await userEvent.upload(fileInput(container), file)

      expect(screen.getByRole('img', { name: '添付する画像 1枚目' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /画像を追加（残り3枚）/ })).toBeInTheDocument()
      await userEvent.click(submitButton())
      expect(postsApi.createPost).toHaveBeenCalledWith({ content: '', images: [file] })
    })

    it('対応していない形式・5MBを超える画像は追加せずにエラーを表示する', async () => {
      const { container } = renderComposer()
      // accept 属性で弾かれないよう、形式のチェックは applyAccept を切って確かめる
      const user = userEvent.setup({ applyAccept: false })

      await user.upload(fileInput(container), imageFile('a.svg', 'image/svg+xml'))
      expect(screen.getByRole('alert')).toHaveTextContent('jpg・png・gif・webp の画像を選んでください')

      await user.upload(fileInput(container), imageFile('big.png', 'image/png', 5 * 1024 * 1024 + 1))
      expect(screen.getByRole('alert')).toHaveTextContent('5MB以下の画像を選んでください')
      expect(screen.queryByRole('img', { name: /添付する画像/ })).not.toBeInTheDocument()
    })

    it('4枚までしか添付できず、超えた分は追加しない', async () => {
      const { container } = renderComposer()

      await userEvent.upload(fileInput(container), ['1', '2', '3', '4', '5'].map((n) => imageFile(`${n}.png`)))

      expect(screen.getAllByRole('img', { name: /添付する画像/ })).toHaveLength(4)
      expect(screen.getByRole('alert')).toHaveTextContent('画像は4枚まで添付できます')
      expect(screen.getByRole('button', { name: /画像を追加/ })).toBeDisabled()
    })

    it('× で取り消すとプレビュー用のURLを解放する', async () => {
      const revoke = vi.spyOn(URL, 'revokeObjectURL')
      const { container } = renderComposer()

      await userEvent.upload(fileInput(container), [imageFile('1.png'), imageFile('2.png')])
      const removedUrl = screen.getByRole('img', { name: '添付する画像 1枚目' }).getAttribute('src')
      await userEvent.click(screen.getByRole('button', { name: '1枚目の画像を取り消す' }))

      expect(screen.getAllByRole('img', { name: /添付する画像/ })).toHaveLength(1)
      expect(revoke).toHaveBeenCalledWith(removedUrl)
    })
  })

  describe('閉じる', () => {
    it('何も入力していなければ確認せずに閉じる', async () => {
      const { onClose } = renderComposer()

      await userEvent.click(screen.getByRole('button', { name: '閉じる' }))

      expect(window.confirm).not.toHaveBeenCalled()
      expect(onClose).toHaveBeenCalledOnce()
    })

    it('入力途中なら破棄してよいか確認し、キャンセルなら閉じない', async () => {
      window.confirm.mockReturnValue(false)
      const { onClose } = renderComposer()

      await userEvent.type(textarea(), 'a')
      await userEvent.keyboard('{Escape}')

      expect(window.confirm).toHaveBeenCalledWith('入力内容を破棄しますか？')
      expect(onClose).not.toHaveBeenCalled()
    })

    it('背景を押しても閉じる', async () => {
      const { container, onClose } = renderComposer()

      fireEvent.mouseDown(container.querySelector('.modal-backdrop'))

      expect(onClose).toHaveBeenCalledOnce()
    })

    it('開いている間は後ろの画面をスクロールさせない', () => {
      const { unmount } = renderComposer()

      expect(document.body.style.overflow).toBe('hidden')
      unmount()
      expect(document.body.style.overflow).toBe('')
    })
  })
})

describe('PostComposerModal(投稿編集)', () => {
  it('元の本文を入れた状態で開き、変更するまで保存できない。画像は追加できない', async () => {
    renderComposer({ editingPost: makePost({ content: '編集前' }) })

    expect(screen.getByRole('dialog', { name: '投稿を編集' })).toBeInTheDocument()
    expect(textarea()).toHaveValue('編集前')
    expect(submitButton()).toHaveTextContent('保存')
    expect(submitButton()).toBeDisabled()
    expect(screen.queryByRole('button', { name: /画像を追加/ })).not.toBeInTheDocument()

    // 前後に空白を足しただけでは変更とみなさない
    await userEvent.type(textarea(), '  ')
    expect(submitButton()).toBeDisabled()
  })

  it('本文を変えて保存すると updatePost を呼ぶ', async () => {
    const saved = makePost({ id: 5, content: '編集後', edited: true })
    postsApi.updatePost.mockResolvedValue(saved)
    const { onSaved } = renderComposer({ editingPost: makePost({ id: 5, content: '編集前' }) })

    await userEvent.clear(textarea())
    await userEvent.type(textarea(), '編集後')
    await userEvent.click(submitButton())

    expect(postsApi.updatePost).toHaveBeenCalledWith(5, { content: '編集後' })
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved))
  })

  it('画像付きの投稿なら本文を空にしても保存できる', async () => {
    renderComposer({ editingPost: makePost({ content: '編集前', images: [{ url: 'http://x/1.png', sortOrder: 1 }] }) })

    await userEvent.clear(textarea())

    expect(submitButton()).toBeEnabled()
  })
})
