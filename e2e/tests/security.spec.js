// 観点: 他人が書いた内容を安全に表示できるか・他人のものを操作できないか(要件定義書 8章 No.6・7)
// XSS は「サーバーが保存した文字列を、実際のブラウザで表示したときにスクリプトが動かないか」なので E2E で確かめる。
// APIを直接呼んだときの認可(他人の投稿の編集は403など)は、バックエンドの ApiIntegrationTest で確かめている。
import { expect, test } from '../support/fixtures.js'
import { postCard } from '../support/ui.js'

// どれもHTMLとして解釈されると window.__xss に値が入る
const PAYLOADS = {
  post: `<img src="x" onerror="window.__xss='post'">投稿`,
  comment: `<script>window.__xss='comment'</script>コメント`,
  bio: `<svg onload="window.__xss='bio'"></svg>自己紹介`,
  displayName: `<b onmouseover="window.__xss='name'">ボブ</b>`,
}

test('投稿・コメント・自己紹介・表示名に書いたHTMLは実行されず、書いた文字のまま表示される', async ({
  api,
  openAs,
}) => {
  const [alice, bob] = await Promise.all([api.signup(), api.signup()])
  await api.updateProfile(bob, { displayName: PAYLOADS.displayName, bio: PAYLOADS.bio })
  const post = await api.createPost(bob, PAYLOADS.post)
  await api.comment(bob, post.id, PAYLOADS.comment)
  await api.follow(alice, bob.username)

  const page = await openAs(alice)
  const xss = () => page.evaluate(() => window.__xss ?? null)

  await test.step('タイムライン', async () => {
    const card = postCard(page, PAYLOADS.post)
    await expect(card).toBeVisible()
    await expect(card).toContainText(PAYLOADS.displayName)
    await card.getByText(PAYLOADS.displayName).hover()
    await expect(card.locator('img[src="x"]')).toHaveCount(0)
    expect(await xss()).toBeNull()
  })

  await test.step('投稿詳細(コメント)', async () => {
    await page.goto(`/posts/${post.id}`)
    await expect(page.getByText(PAYLOADS.comment)).toBeVisible()
    expect(await xss()).toBeNull()
  })

  await test.step('プロフィール(自己紹介)', async () => {
    await page.goto(`/users/${bob.username}`)
    await expect(page.getByText(PAYLOADS.bio)).toBeVisible()
    await expect(page.locator('svg[onload]')).toHaveCount(0)
    expect(await xss()).toBeNull()
  })

  await test.step('検索結果', async () => {
    await page.goto(`/search?q=${bob.username}`)
    await expect(page.getByRole('region', { name: '検索結果' })).toContainText(PAYLOADS.bio)
    expect(await xss()).toBeNull()
  })
})

test('他人の投稿・コメントには編集・削除ボタンが出ず、自分のものにだけ出る', async ({ api, openAs }) => {
  const [alice, bob] = await Promise.all([api.signup(), api.signup()])
  const bobPost = await api.createPost(bob, 'ボブの投稿')
  await api.comment(bob, bobPost.id, 'ボブのコメント')
  await api.comment(alice, bobPost.id, 'アリスのコメント')
  await api.createPost(alice, 'アリスの投稿')
  await api.follow(alice, bob.username)

  const page = await openAs(alice)
  await expect(postCard(page, 'ボブの投稿').getByRole('button', { name: /投稿を(編集|削除)/ })).toHaveCount(0)
  await expect(postCard(page, 'アリスの投稿').getByRole('button', { name: /投稿を(編集|削除)/ })).toHaveCount(2)

  await page.goto(`/posts/${bobPost.id}`)
  const comments = page.getByRole('region', { name: 'コメント' })
  await expect(comments.getByRole('article').filter({ hasText: 'ボブのコメント' }).getByRole('button')).toHaveCount(0)
  await expect(
    comments.getByRole('article').filter({ hasText: 'アリスのコメント' }).getByRole('button', { name: 'コメントを削除' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /投稿を(編集|削除)/ })).toHaveCount(0)
})

test('他人のプロフィール編集画面は無く、/settings/profile は常に自分のプロフィールを編集する', async ({
  api,
  openAs,
}) => {
  const [alice, bob] = await Promise.all([api.signup({ displayName: 'アリス' }), api.signup({ displayName: 'ボブ' })])
  const page = await openAs(alice, `/users/${bob.username}`)
  await expect(page.getByRole('link', { name: 'プロフィール編集' })).toHaveCount(0)
  await page.goto('/settings/profile')
  await expect(page.getByLabel('表示名')).toHaveValue('アリス')
})
