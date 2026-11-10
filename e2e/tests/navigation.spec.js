// 観点: 画面の移動・ブラウザの「戻る」・URLの直接入力・無限スクロール
// IntersectionObserver による続きの読み込みや、スクロール位置の復元は jsdom では動かないため、E2E で確かめる。
import { PAGE_SIZE } from '../support/env.js'
import { expect, test } from '../support/fixtures.js'
import { postCard } from '../support/ui.js'

test('タイムラインは20件ずつ表示し、下までスクロールすると続きを読み込む(TL-01・02)', async ({ api, openAs }) => {
  const alice = await api.signup()
  await api.createPosts(alice, 45, (i) => `投稿 #${i}`)
  const page = await openAs(alice)
  const articles = page.getByRole('article')

  await expect(articles).toHaveCount(PAGE_SIZE)
  // 新しい順
  await expect(articles.first()).toContainText('投稿 #45')
  await expect(articles.nth(PAGE_SIZE - 1)).toContainText('投稿 #26')

  await articles.last().scrollIntoViewIfNeeded()
  await expect(articles).toHaveCount(PAGE_SIZE * 2)
  await articles.last().scrollIntoViewIfNeeded()
  await expect(articles).toHaveCount(45)
  await expect(page.getByText('これ以上投稿はありません')).toBeVisible()

  // 同じ投稿が2回出ていない(ページの境目で重複・欠落が無い)
  const texts = await articles.locator('p').filter({ hasText: /^投稿 #\d+$/ }).allTextContents()
  expect(texts).toEqual(Array.from({ length: 45 }, (_, i) => `投稿 #${45 - i}`))
})

test('投稿詳細から「戻る」と、読み込み済みの一覧とスクロール位置がそのまま戻る', async ({ api, openAs }) => {
  const alice = await api.signup()
  await api.createPosts(alice, 30, (i) => `投稿 #${i}`)
  const page = await openAs(alice)
  await page.getByRole('article').last().scrollIntoViewIfNeeded()
  await expect(page.getByRole('article')).toHaveCount(30)

  const target = postCard(page, '投稿 #8')
  await target.scrollIntoViewIfNeeded()
  const scrollY = await page.evaluate(() => window.scrollY)
  expect(scrollY).toBeGreaterThan(500)

  // カード(本文のあたり)を押すと詳細へ
  await target.getByText('投稿 #8').click()
  await expect(page).toHaveURL(/\/posts\/\d+$/)
  await expect(page.getByRole('heading', { name: '投稿' })).toBeVisible()

  let reloaded = false
  page.on('request', (req) => {
    if (/\/api\/timeline(\?|$)/.test(req.url())) reloaded = true
  })
  await page.goBack()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('article')).toHaveCount(30)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(scrollY, -1)
  expect(reloaded, 'タイムラインを読み込み直していない').toBe(false)
})

test('ホームを表示中に「ホーム」を押すと、最新の投稿を読み込み直す', async ({ api, openAs }) => {
  const [alice, bob] = await Promise.all([api.signup(), api.signup()])
  await api.follow(alice, bob.username)
  await api.createPost(bob, '前の投稿')
  const page = await openAs(alice)
  await expect(postCard(page, '前の投稿')).toBeVisible()

  await api.createPost(bob, 'ホームを押したら出てくる投稿')
  await page.getByRole('link', { name: 'ホーム' }).click()
  await expect(page.getByRole('article').first()).toContainText('ホームを押したら出てくる投稿')
})

test('検索結果からプロフィールを開いて「戻る」と、同じ検索結果に戻る(SRCH-01)', async ({ api, openAs }) => {
  const alice = await api.signup()
  const bob = await api.signup({ displayName: 'ボブ' })
  const page = await openAs(alice, '/search')

  await page.getByRole('searchbox', { name: 'ユーザー名で検索' }).fill(`@${bob.username}`)
  await page.getByRole('searchbox', { name: 'ユーザー名で検索' }).press('Enter')
  await expect(page).toHaveURL(`/search?q=%40${bob.username}`)
  const results = page.getByRole('region', { name: '検索結果' })
  await results.getByRole('link', { name: 'ボブ' }).click()
  await expect(page).toHaveURL(`/users/${bob.username}`)

  await page.goBack()
  await expect(page).toHaveURL(`/search?q=%40${bob.username}`)
  await expect(page.getByRole('searchbox', { name: 'ユーザー名で検索' })).toHaveValue(`@${bob.username}`)
  await expect(results.getByRole('link', { name: 'ボブ' })).toBeVisible()
})

test('検索画面を開いた直後は「新しく参加したユーザー」に最近登録した人が出る(SRCH-04)', async ({ api, openAs }) => {
  const alice = await api.signup()
  const newcomer = await api.signup({ displayName: '新人さん' })
  const page = await openAs(alice, '/search')
  const section = page.getByRole('region', { name: '新しく参加したユーザー' })
  await expect(section.getByRole('article').filter({ hasText: `@${newcomer.username}` })).toBeVisible()
  // 自分は出ない
  await expect(section.getByRole('article').filter({ hasText: `@${alice.username}` })).toHaveCount(0)
})

test.describe('URLを直接開いたとき', () => {
  test('存在しない・削除された投稿は「削除されたか、存在しません」と案内する', async ({ api, openAs }) => {
    const alice = await api.signup()
    const page = await openAs(alice, '/posts/999999999')
    await expect(page.getByText('この投稿は削除されたか、存在しません')).toBeVisible()
    // IDが数値でないURLも同じ案内にする
    await page.goto('/posts/abc')
    await expect(page.getByText('この投稿は削除されたか、存在しません')).toBeVisible()
  })

  test('存在しないユーザーは「このアカウントは存在しません」と案内する', async ({ api, openAs }) => {
    const alice = await api.signup()
    const page = await openAs(alice, '/users/no_such_user0')
    await expect(page.getByText('このアカウントは存在しません')).toBeVisible()
  })

  test('ユーザー名の大文字・小文字が違っても、同じ人のプロフィールを開ける', async ({ api, openAs }) => {
    const [alice, bob] = await Promise.all([api.signup(), api.signup({ displayName: 'ボブ' })])
    const page = await openAs(alice, `/users/${bob.username.toUpperCase()}`)
    await expect(page.getByRole('heading', { name: 'ボブ', level: 2 })).toBeVisible()
  })

  test('存在しない画面のURLはホームに移動する', async ({ api, openAs }) => {
    const alice = await api.signup()
    const page = await openAs(alice, '/no/such/page')
    await expect(page).toHaveURL('/')
  })

  test('投稿詳細のURLを直接開いて「戻る」(←)を押すと、タイムラインへ移動する', async ({ api, openAs }) => {
    const alice = await api.signup()
    const post = await api.createPost(alice, '直接開いた投稿')
    const page = await openAs(alice, `/posts/${post.id}`)
    await page.getByRole('button', { name: '戻る' }).click()
    await expect(page).toHaveURL('/')
  })
})
