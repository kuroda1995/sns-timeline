// ユーザーの表示(UserRow・ProfileHeader)と検索欄(UserSearchForm)のテスト
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as usersApi from '../api/usersApi.js'
import { makeUserSummary } from '../test/fixtures.js'
import { renderWithProviders } from '../test/render.jsx'
import { ProfileHeader } from './ProfileHeader.jsx'
import { UserRow } from './UserRow.jsx'
import { UserSearchForm } from './UserSearchForm.jsx'

vi.mock('../api/usersApi.js')

describe('UserRow', () => {
  it('表示名・@ユーザー名をプロフィールへのリンクにし、自己紹介は1行目だけを表示する', () => {
    renderWithProviders(<UserRow user={makeUserSummary({ bio: '1行目\n2行目' })} onFollowChange={vi.fn()} />)

    expect(screen.getByRole('link', { name: '太郎' })).toHaveAttribute('href', '/users/taro')
    expect(screen.getByRole('link', { name: '@taro' })).toHaveAttribute('href', '/users/taro')
    expect(screen.getByText('1行目')).toBeInTheDocument()
    expect(screen.queryByText(/2行目/)).not.toBeInTheDocument()
  })

  it('自分自身の行にはフォローボタンの代わりに「あなた」と表示する', () => {
    renderWithProviders(<UserRow user={makeUserSummary({ isMe: true })} onFollowChange={vi.fn()} />)

    expect(screen.getByText('あなた')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('フォローするとユーザーIDと新しい状態を伝える', async () => {
    usersApi.follow.mockResolvedValue({ followedByMe: true, followerCount: 1 })
    const onFollowChange = vi.fn()
    renderWithProviders(<UserRow user={makeUserSummary({ id: 7 })} onFollowChange={onFollowChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'フォローする' }))

    await waitFor(() => expect(usersApi.follow).toHaveBeenCalledWith('taro'))
    expect(onFollowChange).toHaveBeenCalledWith(7, true)
  })
})

describe('ProfileHeader', () => {
  const profile = (overrides = {}) => ({
    id: 2,
    username: 'taro',
    displayName: '太郎',
    avatarUrl: null,
    bio: 'よろしく\nお願いします',
    followingCount: 3,
    followerCount: 5,
    followedByMe: false,
    isMe: false,
    createdAt: new Date(2026, 9, 15).toISOString(),
    ...overrides,
  })

  it('名前・自己紹介・登録月・フォロー数・フォロワー数を表示する', () => {
    renderWithProviders(<ProfileHeader profile={profile()} onFollowChange={vi.fn()} />)

    expect(screen.getByRole('heading', { name: '太郎' })).toBeInTheDocument()
    expect(screen.getByText('@taro')).toBeInTheDocument()
    expect(screen.getByText(/よろしく/)).toHaveTextContent('よろしく お願いします', { normalizeWhitespace: true })
    expect(screen.getByText('📅 2026年10月から利用しています')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '3 フォロー中' })).toHaveAttribute('href', '/users/taro/following')
    expect(screen.getByRole('link', { name: '5 フォロワー' })).toHaveAttribute('href', '/users/taro/followers')
  })

  it('他人のプロフィールにはフォローボタンを表示する', () => {
    renderWithProviders(<ProfileHeader profile={profile({ followedByMe: true })} onFollowChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: /フォロー中/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'プロフィール編集' })).not.toBeInTheDocument()
  })

  it('自分のプロフィールには「プロフィール編集」を表示する', () => {
    renderWithProviders(<ProfileHeader profile={profile({ isMe: true })} onFollowChange={vi.fn()} />)

    expect(screen.getByRole('link', { name: 'プロフィール編集' })).toHaveAttribute('href', '/settings/profile')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('自己紹介が空なら表示しない', () => {
    const { container } = renderWithProviders(<ProfileHeader profile={profile({ bio: '' })} onFollowChange={vi.fn()} />)

    expect(container.querySelector('.profile__bio')).toBeNull()
  })
})

describe('UserSearchForm', () => {
  const input = () => screen.getByRole('searchbox', { name: 'ユーザー名で検索' })
  const searchButton = () => screen.getByRole('button', { name: '検索' })

  let onSearch
  beforeEach(() => {
    onSearch = vi.fn()
  })

  it('開いたらすぐ入力でき、前回のキーワードを入れておく', () => {
    renderWithProviders(<UserSearchForm initialQuery="taro" onSearch={onSearch} />)

    expect(input()).toHaveFocus()
    expect(input()).toHaveValue('taro')
    expect(input()).toHaveAttribute('maxLength', '50')
  })

  it.each(['', '   ', '@', ' @ '])('空白だけ・@ だけのときは押せない: %j', async (value) => {
    renderWithProviders(<UserSearchForm initialQuery={value} onSearch={onSearch} />)

    expect(searchButton()).toBeDisabled()
  })

  it('入力しただけでは検索せず、Enterで前後の空白を取り除いたキーワードを渡す', async () => {
    renderWithProviders(<UserSearchForm initialQuery="" onSearch={onSearch} />)

    await userEvent.type(input(), '  @taro ')
    expect(onSearch).not.toHaveBeenCalled()

    await userEvent.keyboard('{Enter}')
    expect(onSearch).toHaveBeenCalledWith('@taro')
  })

  it('検索ボタンでも検索できる', async () => {
    renderWithProviders(<UserSearchForm initialQuery="jiro" onSearch={onSearch} />)

    await userEvent.click(searchButton())

    expect(onSearch).toHaveBeenCalledWith('jiro')
  })
})
