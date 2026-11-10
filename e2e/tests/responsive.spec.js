// 観点: スマートフォン幅(375px)で大きく崩れず、操作できるか(要件定義書 8章 No.2)
// playwright.config.js の mobile プロジェクト(幅375px・タッチ操作)でだけ実行する。
import { expect, handleNextDialog, test } from '../support/fixtures.js'
import { pngFile } from '../support/images.js'
import { hasHorizontalOverflow, postCard } from '../support/ui.js'

test('主な画面で横スクロールが出ない(長い英数字・画像4枚の投稿があっても)', async ({ api, openAs, page }) => {
  const [alice, bob] = await Promise.all([api.signup(), api.signup()])
  await api.follow(alice, bob.username)
  // 空白の無い長い文字列は、折り返せずに画面からはみ出しやすい
  const longWord = 'a'.repeat(140)
  const post = await api.createPost(bob, longWord, [0, 1, 2, 3].map(pngFile))
  await api.comment(alice, post.id, 'https://example.com/' + 'x'.repeat(100))
  await api.updateProfile(bob, { bio: 'b'.repeat(160) })

  const alicePage = await openAs(alice)
  await expect(postCard(alicePage, longWord)).toBeVisible()
  for (const path of [
    '/',
    `/posts/${post.id}`,
    `/users/${bob.username}`,
    `/users/${bob.username}/followers`,
    `/search?q=${bob.username}`,
    '/settings/profile',
  ]) {
    await alicePage.goto(path)
    await alicePage.waitForLoadState('networkidle')
    expect(await hasHorizontalOverflow(alicePage), `${path} で横スクロールが出ている`).toBe(false)
  }

  for (const path of ['/login', '/signup']) {
    await page.goto(path)
    expect(await hasHorizontalOverflow(page), `${path} で横スクロールが出ている`).toBe(false)
  }
})

test('サイドメニューの代わりに、下のメニューと ✏️ ボタンで操作できる', async ({ api, openAs }) => {
  const alice = await api.signup()
  const page = await openAs(alice)
  const bottomNav = page.getByRole('navigation', { name: 'メニュー(スマートフォン)' })

  await expect(page.getByRole('complementary')).toBeHidden()
  await expect(bottomNav).toBeVisible()

  await bottomNav.getByRole('link', { name: '検索' }).tap()
  await expect(page).toHaveURL('/search')
  // URLは先に変わり、画面の切り替え(React の transition)は少し後になるため、検索画面が出るのを待つ
  await expect(page.getByRole('heading', { name: 'ユーザー検索' })).toBeVisible()

  // 検索画面の「投稿する」は右下の ✏️ ボタンだけ。投稿するとホームに移動して一番上に出る
  await page.getByRole('button', { name: '投稿する' }).tap()
  const modal = page.getByRole('dialog', { name: '投稿する' })
  await modal.getByRole('textbox', { name: '本文' }).fill('スマホから投稿')
  await modal.getByRole('button', { name: '投稿', exact: true }).tap()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('article').first()).toContainText('スマホから投稿')

  await bottomNav.getByRole('link', { name: 'プロフィール' }).tap()
  await expect(page).toHaveURL(`/users/${alice.username}`)
  await bottomNav.getByRole('link', { name: 'ホーム' }).tap()
  await expect(page).toHaveURL('/')

  // ログアウトは確認なし
  await bottomNav.getByRole('button', { name: 'ログアウト' }).tap()
  await expect(page).toHaveURL('/login')
})

test('投稿作成モーダルは画面内に収まり、書きかけで閉じると確認が出る', async ({ api, openAs }) => {
  const alice = await api.signup()
  const page = await openAs(alice, '/search')
  await expect(page.getByRole('heading', { name: 'ユーザー検索' })).toBeVisible()
  await page.getByRole('button', { name: '投稿する' }).tap()
  const modal = page.getByRole('dialog', { name: '投稿する' })
  await modal.getByRole('textbox', { name: '本文' }).fill('書きかけ')

  const box = await modal.boundingBox()
  const viewport = page.viewportSize()
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)

  const discard = handleNextDialog(page, { accept: true })
  await modal.getByRole('button', { name: '閉じる' }).tap()
  await discard
  await expect(modal).toBeHidden()
})
