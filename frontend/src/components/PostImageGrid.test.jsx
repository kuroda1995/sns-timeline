// 投稿の画像(PostImageGrid)と、押したときの拡大表示(ImageViewer)のテスト
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ImageViewer } from './ImageViewer.jsx'
import { PostImageGrid } from './PostImageGrid.jsx'

const images = (n) => Array.from({ length: n }, (_, i) => ({ url: `http://x/${i + 1}.png`, sortOrder: i + 1 }))

describe('PostImageGrid', () => {
  it.each([undefined, []])('画像が無ければ何も表示しない: %j', (value) => {
    const { container } = render(<PostImageGrid images={value} />)

    expect(container).toBeEmptyDOMElement()
  })

  it.each([1, 2, 3, 4])('%i枚なら枚数に応じた並べ方にする', (n) => {
    const { container } = render(<PostImageGrid images={images(n)} />)

    expect(container.firstChild).toHaveClass(`image-grid--${n}`)
    expect(screen.getAllByRole('button')).toHaveLength(n)
  })

  it('画像を押すとその画像を拡大表示し、× で閉じる', async () => {
    render(<PostImageGrid images={images(3)} />)

    await userEvent.click(screen.getByRole('button', { name: '画像 2枚目を大きく表示' }))

    const dialog = screen.getByRole('dialog', { name: '画像 2/3' })
    expect(dialog.querySelector('img')).toHaveAttribute('src', 'http://x/2.png')

    await userEvent.click(screen.getByRole('button', { name: '閉じる' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('ImageViewer', () => {
  function renderViewer({ count = 3, index = 0 } = {}) {
    const props = { images: images(count), index, onChangeIndex: vi.fn(), onClose: vi.fn() }
    const result = render(<ImageViewer {...props} />)
    return { ...result, ...props }
  }

  it('開いたら閉じるボタンにフォーカスし、後ろの画面をスクロールさせない', () => {
    const { unmount } = renderViewer()

    expect(screen.getByRole('button', { name: '閉じる' })).toHaveFocus()
    expect(document.body.style.overflow).toBe('hidden')

    unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('‹ › で前後の画像に切り替え、端から反対の端へ回り込む', async () => {
    const { onChangeIndex } = renderViewer({ count: 3, index: 0 })

    await userEvent.click(screen.getByRole('button', { name: '前の画像' }))
    expect(onChangeIndex).toHaveBeenLastCalledWith(2)
    await userEvent.click(screen.getByRole('button', { name: '次の画像' }))
    expect(onChangeIndex).toHaveBeenLastCalledWith(1)
  })

  it('左右キーで切り替え、Escキーで閉じる', () => {
    const { onChangeIndex, onClose } = renderViewer({ count: 3, index: 2 })

    fireEvent.keyDown(document, { key: 'ArrowRight' })
    expect(onChangeIndex).toHaveBeenLastCalledWith(0)
    fireEvent.keyDown(document, { key: 'ArrowLeft' })
    expect(onChangeIndex).toHaveBeenLastCalledWith(1)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('1枚だけなら切り替えボタンを出さず、左右キーも無視する', () => {
    const { onChangeIndex } = renderViewer({ count: 1 })

    expect(screen.queryByRole('button', { name: '次の画像' })).not.toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'ArrowRight' })
    expect(onChangeIndex).not.toHaveBeenCalled()
  })

  it('背景を押すと閉じるが、画像を押しても閉じない。クリックは外側に伝えない', async () => {
    const outerClick = vi.fn()
    const onClose = vi.fn()
    render(
      // 投稿カード(押すと詳細へ移動する)の中に置かれた場合
      <div onClick={outerClick}>
        <ImageViewer images={images(2)} index={0} onChangeIndex={() => {}} onClose={onClose} />
      </div>,
    )

    await userEvent.click(screen.getByRole('img'))
    expect(onClose).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalledOnce()
    expect(outerClick).not.toHaveBeenCalled()
  })
})
