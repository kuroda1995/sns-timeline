// 観点: 通信に失敗したときに、利用者が状況を分かり、操作をやり直せるか
// サーバーのエラー・通信の失敗は page.route() でブラウザの通信を差し替えて起こす。
// 楽観的更新(押した瞬間に表示を変える)の「失敗したら元に戻す」は、実際の画面でしか通しで確かめられない。
import { expect, handleNextDialog, test } from '../support/fixtures.js'
import { composer, likeButton, postCard, sidebarComposeButton } from '../support/ui.js'

const serverError = (route) =>
  route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'サーバーでエラーが発生しました' }) })

test('タイムラインを読み込めなかったときはエラーを表示し、「再読み込み」で表示できる', async ({ api, openAs }) => {
  const alice = await api.signup()
  await api.createPost(alice, '読み込めるようになった投稿')
  const page = await openAs(alice, '/', {
    // 最初の1回だけ失敗させる
    beforeGoto: (p) => p.route('**/api/timeline', serverError, { times: 1 }),
  })

  await expect(page.getByText('タイムラインを読み込めませんでした')).toBeVisible()
  await expect(page.getByText('サーバーでエラーが発生しました')).toBeVisible()
  await page.getByRole('button', { name: '再読み込み' }).click()
  await expect(postCard(page, '読み込めるようになった投稿')).toBeVisible()
})

test('いいねの通信に失敗すると、表示が元に戻りメッセージが出る(LIKE-04)', async ({ api, openAs }) => {
  const alice = await api.signup()
  await api.createPost(alice, 'いいねする投稿')
  const page = await openAs(alice)
  const like = likeButton(postCard(page, 'いいねする投稿'))
  await expect(like).toHaveAccessibleName('いいね 0件')

  await page.route('**/api/posts/*/likes', (route) => route.abort('connectionrefused'))
  const alert = handleNextDialog(page, { accept: true })
  await like.click()
  expect(await alert).toBe('いいねできませんでした')
  await expect(like).toHaveAttribute('aria-pressed', 'false')
  await expect(like).toHaveAccessibleName('いいね 0件')

  // つながるようになれば、もう一度押していいねできる
  await page.unroute('**/api/posts/*/likes')
  await like.click()
  await expect(like).toHaveAccessibleName('いいね 1件')
  await page.reload()
  await expect(likeButton(postCard(page, 'いいねする投稿'))).toHaveAttribute('aria-pressed', 'true')
})

test('いいねを素早く連打しても、最後に押した状態でサーバーと画面がそろう(LIKE-03)', async ({ api, openAs }) => {
  const alice = await api.signup()
  const post = await api.createPost(alice, '連打する投稿')
  const page = await openAs(alice)
  const like = likeButton(postCard(page, '連打する投稿'))

  // 5回押す → 最後は「いいねした」状態
  for (let i = 0; i < 5; i++) await like.click()
  await expect(like).toHaveAttribute('aria-pressed', 'true')
  await expect(like).toHaveAccessibleName('いいね 1件')

  await expect
    .poll(async () => (await (await api.getPost(alice, post.id)).json()).likeCount, { message: 'サーバーのいいね数' })
    .toBe(1)
  await page.reload()
  await expect(likeButton(postCard(page, '連打する投稿'))).toHaveAccessibleName('いいね 1件')
})

test('投稿の送信に失敗しても、書いた本文は消えずにもう一度送れる', async ({ api, openAs }) => {
  const alice = await api.signup()
  const page = await openAs(alice)
  await page.route('**/api/posts', (route) =>
    route.request().method() === 'POST' ? route.abort('connectionrefused') : route.fallback(),
  )

  await sidebarComposeButton(page).click()
  const modal = composer(page)
  await modal.getByRole('textbox', { name: '本文' }).fill('電波の悪いところで書いた投稿')
  await modal.getByRole('button', { name: '投稿', exact: true }).click()
  await expect(modal.getByRole('alert')).toHaveText('サーバーに接続できませんでした。時間をおいて再度お試しください')
  await expect(modal.getByRole('textbox', { name: '本文' })).toHaveValue('電波の悪いところで書いた投稿')

  await page.unroute('**/api/posts')
  await modal.getByRole('button', { name: '投稿', exact: true }).click()
  await expect(modal).toBeHidden()
  await expect(postCard(page, '電波の悪いところで書いた投稿')).toBeVisible()
})

test('タイムラインの続きを読み込めなかったときは「もう一度読み込む」で続きを表示できる(TL-02)', async ({
  api,
  openAs,
}) => {
  const alice = await api.signup()
  await api.createPosts(alice, 25)
  const page = await openAs(alice, '/', {
    // glob の ? は「任意の1文字」になるため、クエリ付きのURLは正規表現で指定する
    beforeGoto: (p) => p.route(/\/api\/timeline\?cursor=/, serverError, { times: 1 }),
  })
  await expect(page.getByRole('article')).toHaveCount(20)

  await page.getByRole('article').last().scrollIntoViewIfNeeded()
  await page.getByRole('button', { name: 'もう一度読み込む' }).click()
  await expect(page.getByRole('article')).toHaveCount(25)
  await expect(page.getByText('これ以上投稿はありません')).toBeVisible()
})

test('APIが401を返したら(別の端末でトークンが無効になった等)、操作の途中でもログイン画面になる', async ({
  api,
  openAs,
}) => {
  const alice = await api.signup()
  await api.createPost(alice, '投稿')
  const page = await openAs(alice)
  await expect(postCard(page, '投稿')).toBeVisible()

  await page.route('**/api/posts/*/likes', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'ログインしてください' }) }),
  )
  const alert = handleNextDialog(page, { accept: true })
  await likeButton(postCard(page, '投稿')).click()
  await alert
  await expect(page).toHaveURL('/login')
})
