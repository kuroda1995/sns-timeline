// ユーザーの一覧(NewUsers・FollowList・UserSearchResults)のテスト。API をモックにし、フックごと動かす
import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import * as usersApi from '../api/usersApi.js'
import { ApiError } from '../api/http.js'
import { makeUserSummary, page, triggerIntersection } from '../test/fixtures.js'
import { renderWithProviders } from '../test/render.jsx'
import { FollowList } from './FollowList.jsx'
import { NewUsers } from './NewUsers.jsx'
import { UserSearchResults } from './UserSearchResults.jsx'

vi.mock('../api/usersApi.js')

const users = (...names) => names.map((name, i) => makeUserSummary({ id: i + 10, username: name, displayName: name }))
const usernames = () => screen.getAllByRole('article').map((row) => row.querySelector('.post-card__user').textContent)

describe('NewUsers', () => {
  it('読み込み中を表示してから、新しく参加したユーザーを表示する', async () => {
    usersApi.getNewUsers.mockResolvedValue({ items: users('taro', 'jiro') })
    renderWithProviders(<NewUsers />)

    expect(screen.getByText('読み込み中…')).toBeInTheDocument()
    await waitFor(() => expect(usernames()).toEqual(['@taro', '@jiro']))
  })

  it('他にユーザーがいなければ案内を表示する', async () => {
    usersApi.getNewUsers.mockResolvedValue({ items: [] })
    renderWithProviders(<NewUsers />)

    expect(await screen.findByText('まだ他のユーザーはいません')).toBeInTheDocument()
  })

  it('読み込めなければエラーを表示する', async () => {
    usersApi.getNewUsers.mockRejectedValue(new ApiError(500, 'サーバーでエラーが発生しました'))
    renderWithProviders(<NewUsers />)

    expect(await screen.findByText('読み込めませんでした（サーバーでエラーが発生しました）')).toBeInTheDocument()
  })

  it('フォローしたら、その人の行のボタンを「フォロー中」にする', async () => {
    usersApi.getNewUsers.mockResolvedValue({ items: users('taro', 'jiro') })
    usersApi.follow.mockResolvedValue({ followedByMe: true, followerCount: 1 })
    renderWithProviders(<NewUsers />)

    const [taroButton] = await screen.findAllByRole('button', { name: 'フォローする' })
    await userEvent.click(taroButton)

    await waitFor(() => expect(screen.getAllByRole('button')[0]).toHaveTextContent('フォロー中'))
    expect(screen.getAllByRole('button')[1]).toHaveTextContent('フォローする')
  })
})

describe('FollowList', () => {
  it.each([
    ['following', 'まだ誰もフォローしていません'],
    ['followers', 'まだフォロワーはいません'],
  ])('%s が0人なら案内を表示する', async (kind, message) => {
    usersApi.getFollowList.mockResolvedValue(page([]))
    renderWithProviders(<FollowList username="hanako" kind={kind} />)

    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(usersApi.getFollowList).toHaveBeenCalledWith('hanako', kind)
  })

  it('末尾までスクロールしたら次のページを読み込み、重複した人は1回だけ表示する', async () => {
    usersApi.getFollowList
      .mockResolvedValueOnce(page(users('taro', 'jiro'), { nextCursor: 50, hasNext: true }))
      .mockResolvedValueOnce(page(users('jiro', 'saburo').map((u, i) => ({ ...u, id: 11 + i })), { hasNext: false }))
    renderWithProviders(<FollowList username="hanako" kind="following" />)
    await waitFor(() => expect(usernames()).toEqual(['@taro', '@jiro']))

    act(() => triggerIntersection())

    await waitFor(() => expect(usernames()).toEqual(['@taro', '@jiro', '@saburo']))
    expect(usersApi.getFollowList).toHaveBeenLastCalledWith('hanako', 'following', 50)
  })

  it('続きを読み込めなければ「もう一度読み込む」で読み込み直せる', async () => {
    usersApi.getFollowList
      .mockResolvedValueOnce(page(users('taro'), { nextCursor: 50, hasNext: true }))
      .mockRejectedValueOnce(new ApiError(0, 'サーバーに接続できませんでした'))
      .mockResolvedValueOnce(page(users('taro', 'jiro').slice(1), { hasNext: false }))
    renderWithProviders(<FollowList username="hanako" kind="followers" />)
    await screen.findByText('@taro')

    act(() => triggerIntersection())
    expect(await screen.findByText('サーバーに接続できませんでした')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'もう一度読み込む' }))
    await waitFor(() => expect(usernames()).toEqual(['@taro', '@jiro']))
  })

  it('読み込めなければエラーを表示する', async () => {
    usersApi.getFollowList.mockRejectedValue(new ApiError(404, 'ユーザーが見つかりません'))
    renderWithProviders(<FollowList username="nobody" kind="following" />)

    expect(await screen.findByText('一覧を読み込めませんでした（ユーザーが見つかりません）')).toBeInTheDocument()
  })
})

describe('UserSearchResults', () => {
  it('検索中を表示してから、件数と結果を表示する', async () => {
    usersApi.searchUsers.mockResolvedValue({ items: users('taro', 'taro_y'), page: 0, hasNext: false })
    renderWithProviders(<UserSearchResults q="taro" />)

    expect(screen.getByText('検索中…')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: '「taro」の検索結果（2件）' })).toBeInTheDocument()
    expect(usersApi.searchUsers).toHaveBeenCalledWith('taro')
  })

  it('21件以上あれば「20件以上」と表示し、続きを読み込んでも見出しは変えない', async () => {
    usersApi.searchUsers
      .mockResolvedValueOnce({ items: users('a1', 'a2'), page: 0, hasNext: true })
      .mockResolvedValueOnce({ items: users('a1', 'a2', 'a3').slice(2), page: 1, hasNext: false })
    renderWithProviders(<UserSearchResults q="a" />)
    expect(await screen.findByRole('heading', { name: '「a」の検索結果（20件以上）' })).toBeInTheDocument()

    act(() => triggerIntersection())

    await waitFor(() => expect(usernames()).toEqual(['@a1', '@a2', '@a3']))
    expect(usersApi.searchUsers).toHaveBeenLastCalledWith('a', 1)
    expect(screen.getByRole('heading')).toHaveTextContent('20件以上')
  })

  it('見つからなければ案内を表示する', async () => {
    usersApi.searchUsers.mockResolvedValue({ items: [], page: 0, hasNext: false })
    renderWithProviders(<UserSearchResults q="zzz" />)

    expect(await screen.findByText('「zzz」に一致するユーザーは見つかりませんでした')).toBeInTheDocument()
  })

  it('検索できなければエラーを表示する', async () => {
    usersApi.searchUsers.mockRejectedValue(new ApiError(400, '50文字以内で入力してください'))
    renderWithProviders(<UserSearchResults q="x" />)

    expect(await screen.findByText('検索できませんでした（50文字以内で入力してください）')).toBeInTheDocument()
  })
})
