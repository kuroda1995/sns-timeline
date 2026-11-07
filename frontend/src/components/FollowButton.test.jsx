import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as usersApi from '../api/usersApi.js'
import { deferred } from '../test/fixtures.js'
import { renderWithProviders } from '../test/render.jsx'
import { FollowButton } from './FollowButton.jsx'

vi.mock('../api/usersApi.js')

function Harness({ initial, onChange }) {
  const [followedByMe, setFollowedByMe] = useState(initial)
  return (
    <FollowButton
      username="taro"
      followedByMe={followedByMe}
      onChange={(next, count) => {
        onChange?.(next, count)
        setFollowedByMe(next)
      }}
    />
  )
}

describe('FollowButton', () => {
  beforeEach(() => {
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('フォローすると、通信中は押せず、終わったらフォロワー数を伝えてタイムラインを読み込み直す', async () => {
    const req = deferred()
    usersApi.follow.mockReturnValue(req.promise)
    const onChange = vi.fn()
    const { layout } = renderWithProviders(<Harness initial={false} onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'フォローする' }))

    // 楽観的更新(フォロワー数はまだ分からないので null)
    expect(onChange).toHaveBeenNthCalledWith(1, true, null)
    expect(screen.getByRole('button')).toHaveTextContent('フォロー中')
    expect(screen.getByRole('button')).toBeDisabled()
    expect(window.confirm).not.toHaveBeenCalled()

    req.resolve({ followedByMe: true, followerCount: 8 })
    await waitFor(() => expect(screen.getByRole('button')).toBeEnabled())
    expect(usersApi.follow).toHaveBeenCalledWith('taro')
    expect(onChange).toHaveBeenLastCalledWith(true, 8)
    expect(layout.timeline.invalidate).toHaveBeenCalledOnce()
  })

  it('解除するときは確認し、キャンセルしたら何もしない', async () => {
    window.confirm.mockReturnValue(false)
    renderWithProviders(<Harness initial />)

    await userEvent.click(screen.getByRole('button', { name: /フォロー中/ }))

    expect(window.confirm).toHaveBeenCalledWith('@taro さんのフォローを解除しますか？')
    expect(usersApi.unfollow).not.toHaveBeenCalled()
    expect(screen.getByRole('button')).toHaveTextContent('フォロー中')
  })

  it('確認してOKなら解除する', async () => {
    usersApi.unfollow.mockResolvedValue({ followedByMe: false, followerCount: 2 })
    renderWithProviders(<Harness initial />)

    await userEvent.click(screen.getByRole('button', { name: /フォロー中/ }))

    await waitFor(() => expect(screen.getByRole('button')).toHaveTextContent('フォローする'))
    expect(usersApi.unfollow).toHaveBeenCalledWith('taro')
  })

  it('失敗したら元に戻してお知らせする', async () => {
    usersApi.follow.mockRejectedValue(new Error('network'))
    const { layout } = renderWithProviders(<Harness initial={false} />)

    await userEvent.click(screen.getByRole('button', { name: 'フォローする' }))

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('フォローできませんでした'))
    expect(screen.getByRole('button')).toHaveTextContent('フォローする')
    expect(screen.getByRole('button')).toBeEnabled()
    expect(layout.timeline.invalidate).not.toHaveBeenCalled()
  })

  it('解除に失敗したときのメッセージ', async () => {
    usersApi.unfollow.mockRejectedValue(new Error('network'))
    renderWithProviders(<Harness initial />)

    await userEvent.click(screen.getByRole('button'))

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('フォロー解除できませんでした'))
    expect(screen.getByRole('button')).toHaveTextContent('フォロー中')
  })
})
