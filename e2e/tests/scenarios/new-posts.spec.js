// シナリオ: タイムラインを開いたまま、フォロー中の人の新しい投稿を受け取る(TL-05)
// 15秒ごとの確認は、ブラウザの時計を差し替えて(page.clock)待たずに進める。
import { NEW_POSTS_INTERVAL_MS } from '../../support/env.js'
import { expect, test } from '../../support/fixtures.js'
import { postCard } from '../../support/ui.js'

test.describe('新着投稿のお知らせ(TL-05)', () => {
  test('一番上を見ているときは、新しい投稿がそのまま一番上に入る', async ({ api, openAs }) => {
    const [alice, bob] = await Promise.all([api.signup(), api.signup({ displayName: 'ボブ' })])
    await api.follow(alice, bob.username)
    await api.createPost(bob, 'ボブの最初の投稿')

    const page = await openAs(alice, '/', { beforeGoto: (p) => p.clock.install() })
    await expect(postCard(page, 'ボブの最初の投稿')).toBeVisible()

    await api.createPost(bob, 'ボブの新しい投稿')
    // まだ確認の時刻になっていないので、表示されない
    await expect(postCard(page, 'ボブの新しい投稿')).toHaveCount(0)

    await page.clock.fastForward(NEW_POSTS_INTERVAL_MS)
    await expect(page.getByRole('article').first()).toContainText('ボブの新しい投稿')
    await expect(page.getByRole('button', { name: /新しい投稿/ })).toHaveCount(0)
  })

  test('スクロールして読んでいる途中は一覧を動かさず「新しい投稿 N件」を出し、押すと一番上に入る', async ({
    api,
    openAs,
  }) => {
    const [alice, bob] = await Promise.all([api.signup(), api.signup({ displayName: 'ボブ' })])
    await api.follow(alice, bob.username)
    await api.createPosts(bob, 10, (i) => `ボブの過去の投稿 ${i}`)

    const page = await openAs(alice, '/', { beforeGoto: (p) => p.clock.install() })
    await expect(page.getByRole('article')).toHaveCount(10)
    await page.getByRole('article').last().scrollIntoViewIfNeeded()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(80)

    await api.createPost(bob, '読んでいる途中に届いた投稿1')
    await api.createPost(bob, '読んでいる途中に届いた投稿2')
    await page.clock.fastForward(NEW_POSTS_INTERVAL_MS)

    const newPostsButton = page.getByRole('button', { name: '↑ 新しい投稿 2件' })
    await expect(newPostsButton).toBeVisible()
    // 読んでいる途中の一覧には、まだ入れない
    await expect(page.getByRole('article')).toHaveCount(10)

    await newPostsButton.click()
    await expect(page.getByRole('article')).toHaveCount(12)
    await expect(page.getByRole('article').first()).toContainText('読んでいる途中に届いた投稿2')
    await expect(newPostsButton).toBeHidden()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(80)
  })

  test('自分が投稿したものは、新着として数えない', async ({ api, openAs }) => {
    const alice = await api.signup()
    await api.createPost(alice, '前からある投稿')
    const page = await openAs(alice, '/', { beforeGoto: (p) => p.clock.install() })
    await expect(postCard(page, '前からある投稿')).toBeVisible()

    await page.getByRole('complementary').getByRole('button', { name: '投稿する' }).click()
    await page.getByRole('dialog').getByRole('textbox', { name: '本文' }).fill('自分の新しい投稿')
    await page.getByRole('dialog').getByRole('button', { name: '投稿', exact: true }).click()
    await expect(page.getByRole('article').first()).toContainText('自分の新しい投稿')

    // 確認のリクエストが終わるのを待ってから、ボタンが出ていない・二重に表示されていないことを確かめる
    const checked = page.waitForResponse((res) => res.url().includes('/api/timeline/new'))
    await page.clock.fastForward(NEW_POSTS_INTERVAL_MS)
    await checked
    await expect(page.getByRole('button', { name: /新しい投稿/ })).toHaveCount(0)
    await expect(postCard(page, '自分の新しい投稿')).toHaveCount(1)
  })
})
