// 表示が中心の小さなコンポーネント(Avatar・FormField・EmptyTimeline・UserLink・AuthCheckError・ImagePreviewList)のテスト
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createAuth, renderWithProviders } from '../test/render.jsx'
import { AuthCheckError } from './AuthCheckError.jsx'
import { Avatar } from './Avatar.jsx'
import { EmptyTimeline } from './EmptyTimeline.jsx'
import { FormField } from './FormField.jsx'
import { ImagePreviewList } from './ImagePreviewList.jsx'
import { UserLink } from './UserLink.jsx'

describe('Avatar', () => {
  it('画像があれば画像を表示する', () => {
    const { container } = render(<Avatar user={{ id: 1, displayName: '花子', avatarUrl: 'http://x/a.png' }} />)

    expect(container.querySelector('img')).toHaveAttribute('src', 'http://x/a.png')
  })

  it('画像が無ければ表示名の1文字目をユーザーごとの色で表示する', () => {
    const { container } = render(<Avatar user={{ id: 3, displayName: '😀花子', avatarUrl: null }} size="large" />)
    const avatar = container.firstChild

    // 絵文字も途中で切らずに1文字として表示する
    expect(avatar).toHaveTextContent(/^😀$/)
    expect(avatar).toHaveClass('avatar', 'avatar--large')
    expect(avatar).toHaveStyle({ background: 'hsl(201, 55%, 50%)' })
  })

  it('表示名が空なら ? を表示する', () => {
    const { container } = render(<Avatar user={{ id: 1, displayName: '', avatarUrl: null }} />)

    expect(container.firstChild).toHaveTextContent('?')
  })
})

describe('FormField', () => {
  it('ラベルと入力欄を結び付け、入力した値を受け取る', async () => {
    const onChange = vi.fn()
    render(<FormField id="email" label="メールアドレス" value="" onChange={onChange} />)

    await userEvent.type(screen.getByLabelText('メールアドレス'), 'a')

    expect(onChange).toHaveBeenCalled()
    expect(screen.getByLabelText('メールアドレス')).not.toHaveAttribute('aria-invalid')
  })

  it('エラーがあれば表示し、入力欄の説明として読み上げられるようにする', () => {
    render(<FormField id="email" label="メールアドレス" error="形式が違います" value="" onChange={() => {}} />)
    const input = screen.getByLabelText('メールアドレス')

    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('形式が違います')
    expect(input).toHaveClass('is-invalid')
  })

  it('prefix を入力欄の前に表示する', () => {
    render(<FormField id="username" label="ユーザー名" prefix="@" value="" onChange={() => {}} />)

    expect(screen.getByText('@')).toBeInTheDocument()
  })
})

describe('EmptyTimeline', () => {
  it('ユーザー検索へのリンクと、投稿ボタンを表示する', async () => {
    const onCompose = vi.fn()
    renderWithProviders(<EmptyTimeline onCompose={onCompose} />)

    expect(screen.getByRole('heading', { name: 'まだ投稿がありません' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '投稿する' }))
    expect(onCompose).toHaveBeenCalledOnce()

    await userEvent.click(screen.getByRole('link', { name: 'ユーザーを探す' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/search')
  })
})

describe('UserLink', () => {
  it('プロフィールへのリンクにし、className などの属性を引き継ぐ', () => {
    renderWithProviders(
      <UserLink username="taro" className="post-card__name" title="太郎">
        太郎
      </UserLink>,
    )
    const link = screen.getByRole('link', { name: '太郎' })

    expect(link).toHaveAttribute('href', '/users/taro')
    expect(link).toHaveClass('user-link', 'post-card__name')
    expect(link).toHaveAttribute('title', '太郎')
  })
})

describe('AuthCheckError', () => {
  it('「再読み込み」でログイン情報の確認をやり直す', async () => {
    const auth = createAuth({ status: 'error' })
    renderWithProviders(<AuthCheckError />, { auth })

    expect(screen.getByRole('alert')).toHaveTextContent('サーバーに接続できませんでした')
    await userEvent.click(screen.getByRole('button', { name: '再読み込み' }))
    expect(auth.retry).toHaveBeenCalledOnce()
  })
})

describe('ImagePreviewList', () => {
  const images = [
    { id: 1, url: 'blob:1' },
    { id: 2, url: 'blob:2' },
  ]

  it('画像が無ければ何も表示しない', () => {
    const { container } = render(<ImagePreviewList images={[]} onRemove={() => {}} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('選んだ順に表示し、× で取り消す画像のIDを渡す', async () => {
    const onRemove = vi.fn()
    render(<ImagePreviewList images={images} onRemove={onRemove} />)

    expect(screen.getAllByRole('img').map((img) => img.getAttribute('alt'))).toEqual([
      '添付する画像 1枚目',
      '添付する画像 2枚目',
    ])
    await userEvent.click(screen.getByRole('button', { name: '2枚目の画像を取り消す' }))
    expect(onRemove).toHaveBeenCalledWith(2)
  })

  it('送信中は取り消せない', () => {
    render(<ImagePreviewList images={images} onRemove={() => {}} disabled />)

    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled()
  })
})
