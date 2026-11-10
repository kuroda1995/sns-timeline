// シナリオ: はじめて使う人が、知り合いを見つけてやりとりする
// 要件定義書 9章「完成の目安」の流れを、新しく登録した人の目線で通しで確かめる。
// AUTH-01・SRCH-01・FLW-01・TL-01・LIKE-01・CMT-01
import { uniqueUsername } from '../../support/api.js'
import { PASSWORD } from '../../support/env.js'
import { expect, test } from '../../support/fixtures.js'
import { followingButton, likeButton, postCard } from '../../support/ui.js'

test('新規登録 → ユーザー検索 → フォロー → タイムラインでいいね・コメント → 相手の画面にも反映される', async ({
  page,
  api,
  openAs,
}) => {
  const alice = await api.signup({ displayName: 'アリス' })
  const alicePost = await api.createPost(alice, 'はじめまして、アリスです')
  const username = uniqueUsername()

  await test.step('新規登録すると、ログインした状態でホームが開き、まだ投稿が無いことが案内される', async () => {
    await page.goto('/signup')
    await page.getByLabel('ユーザー名').fill(username)
    await page.getByLabel('表示名').fill('ボブ')
    await page.getByLabel('メールアドレス').fill(`${username}@example.com`)
    await page.getByLabel('パスワード', { exact: true }).fill(PASSWORD)
    await page.getByLabel('パスワード(確認)').fill(PASSWORD)
    await page.getByRole('button', { name: '登録する' }).click()

    await expect(page).toHaveURL('/')
    await expect(page.getByRole('heading', { name: 'ホーム' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'まだ投稿がありません' })).toBeVisible()
    await expect(page.getByRole('complementary')).toContainText(`@${username}`)
  })

  await test.step('案内から検索画面へ移動し、ユーザー名で検索してフォローする', async () => {
    await page.getByRole('link', { name: 'ユーザーを探す' }).click()
    await expect(page).toHaveURL('/search')

    await page.getByRole('searchbox', { name: 'ユーザー名で検索' }).fill(alice.username)
    await page.getByRole('button', { name: '検索', exact: true }).click()

    const results = page.getByRole('region', { name: '検索結果' })
    await expect(results.getByRole('heading')).toHaveText(`「${alice.username}」の検索結果（1件）`)
    const row = results.getByRole('article').filter({ hasText: `@${alice.username}` })
    await row.getByRole('button', { name: 'フォローする' }).click()
    await expect(followingButton(row)).toBeVisible()
  })

  await test.step('ホームに戻ると、フォローした人の投稿がタイムラインに表示される', async () => {
    await page.getByRole('link', { name: 'ホーム' }).click()
    await expect(postCard(page, 'はじめまして、アリスです')).toBeVisible()
    await expect(postCard(page, 'はじめまして、アリスです')).toContainText('アリス')
  })

  await test.step('いいねすると、すぐに押した状態になり、件数が増える', async () => {
    const like = likeButton(postCard(page, 'はじめまして、アリスです'))
    await expect(like).toHaveAttribute('aria-pressed', 'false')
    await like.click()
    await expect(like).toHaveAttribute('aria-pressed', 'true')
    await expect(like).toHaveAccessibleName('いいね 1件')
  })

  await test.step('コメントのリンクから投稿詳細を開き、コメントする', async () => {
    await postCard(page, 'はじめまして、アリスです').getByRole('link', { name: 'コメント 0件' }).click()
    await expect(page).toHaveURL(`/posts/${alicePost.id}`)
    await expect(page.getByText('まだコメントはありません')).toBeVisible()

    await page.getByRole('textbox', { name: 'コメント' }).fill('よろしくお願いします！')
    await page.getByRole('button', { name: '送信' }).click()

    const comments = page.getByRole('region', { name: 'コメント' })
    await expect(comments.getByRole('article').filter({ hasText: 'よろしくお願いします！' })).toContainText('ボブ')
    await expect(page.getByRole('textbox', { name: 'コメント' })).toHaveValue('')
    await expect(page.getByLabel('コメント 1件')).toBeVisible()
  })

  await test.step('「戻る」でタイムラインに戻ると、いいね・コメント数が反映されている', async () => {
    await page.getByRole('button', { name: '戻る' }).click()
    await expect(page).toHaveURL('/')
    const card = postCard(page, 'はじめまして、アリスです')
    await expect(card.getByRole('link', { name: 'コメント 1件' })).toBeVisible()
    await expect(likeButton(card)).toHaveAccessibleName('いいね 1件')
  })

  await test.step('読み込み直しても同じ表示になる(サーバーに保存されている)', async () => {
    await page.reload()
    const card = postCard(page, 'はじめまして、アリスです')
    await expect(likeButton(card)).toHaveAttribute('aria-pressed', 'true')
    await expect(card.getByRole('link', { name: 'コメント 1件' })).toBeVisible()
  })

  await test.step('相手(アリス)の画面でも、いいね・コメント・フォロワーが見える', async () => {
    const alicePage = await openAs(alice, `/posts/${alicePost.id}`)
    const like = likeButton(postCard(alicePage, 'はじめまして、アリスです'))
    // アリス自身はいいねしていないので、押していない状態で件数だけ増えている
    await expect(like).toHaveAccessibleName('いいね 1件')
    await expect(like).toHaveAttribute('aria-pressed', 'false')
    await expect(
      alicePage.getByRole('region', { name: 'コメント' }).getByRole('article').filter({ hasText: 'よろしくお願いします！' }),
    ).toContainText(`@${username}`)

    await alicePage.goto(`/users/${alice.username}`)
    await expect(alicePage.getByRole('link', { name: '1 フォロワー' })).toBeVisible()
  })
})
