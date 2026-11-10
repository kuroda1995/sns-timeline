// 観点: ログイン状態(セッション)の扱い(AUTH-02〜05)
// シナリオでは「正しくログインできる」流れしか通らないため、失敗・ログアウト・トークンが無効なとき・
// 複数タブ・サーバーにつながらないときを確かめる。localStorage・別タブの storage イベントは、実際のブラウザでしか確かめられない。
import { TOKEN_STORAGE_KEY } from '../support/env.js'
import { expect, test } from '../support/fixtures.js'

test.describe('ログイン(AUTH-02)', () => {
  test('入力が空のまま送信すると、項目ごとにエラーが出てサーバーには送らない', async ({ page }) => {
    let requested = false
    page.on('request', (req) => {
      if (req.url().includes('/api/auth/login')) requested = true
    })
    await page.goto('/login')
    await page.getByRole('button', { name: 'ログイン' }).click()

    await expect(page.getByLabel('メールアドレス')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByText('メールアドレスを入力してください')).toBeVisible()
    await expect(page.getByText('パスワードを入力してください')).toBeVisible()
    expect(requested).toBe(false)
  })

  test('パスワードが違うとエラーが出て、ログイン画面のまま', async ({ page, api }) => {
    const alice = await api.signup()
    await page.goto('/login')
    await page.getByLabel('メールアドレス').fill(alice.email)
    await page.getByLabel('パスワード').fill('wrongPass999')
    await page.getByRole('button', { name: 'ログイン' }).click()

    await expect(page.getByRole('alert')).toHaveText('メールアドレスまたはパスワードが正しくありません')
    await expect(page).toHaveURL('/login')
    await expect(page.getByRole('button', { name: 'ログイン' })).toBeEnabled()
  })

  test('ログインしていないときに開いた画面は、ログイン後にその画面へ戻る(AUTH-05)', async ({ page, api }) => {
    const [alice, bob] = await Promise.all([api.signup(), api.signup({ displayName: 'ボブ' })])
    await page.goto(`/users/${bob.username}`)
    await expect(page).toHaveURL('/login')

    await page.getByLabel('メールアドレス').fill(alice.email)
    await page.getByLabel('パスワード').fill(alice.password)
    await page.getByRole('button', { name: 'ログイン' }).click()

    await expect(page).toHaveURL(`/users/${bob.username}`)
    await expect(page.getByRole('heading', { name: 'ボブ', level: 2 })).toBeVisible()
  })

  test('ログイン済みでログイン画面・新規登録画面を開くと、ホームに移動する', async ({ api, openAs }) => {
    const alice = await api.signup()
    const page = await openAs(alice, '/login')
    await expect(page).toHaveURL('/')
    await page.goto('/signup')
    await expect(page).toHaveURL('/')
  })
})

test.describe('新規登録(AUTH-01)', () => {
  test('登録済みのユーザー名(大文字小文字の違いも含む)では登録できず、その欄にエラーが出る', async ({ page, api }) => {
    const alice = await api.signup()
    await page.goto('/signup')
    await page.getByLabel('ユーザー名').fill(alice.username.toUpperCase())
    await page.getByLabel('表示名').fill('なりすまし')
    await page.getByLabel('メールアドレス').fill(`other_${alice.email}`)
    await page.getByLabel('パスワード', { exact: true }).fill('abcd1234')
    await page.getByLabel('パスワード(確認)').fill('abcd1234')
    await page.getByRole('button', { name: '登録する' }).click()

    await expect(page.getByText('このユーザー名は既に使われています')).toBeVisible()
    await expect(page.getByLabel('ユーザー名')).toHaveAttribute('aria-invalid', 'true')
    await expect(page).toHaveURL('/signup')
  })

  test('パスワードのルール違反・確認との不一致は、送信前に画面でエラーになる', async ({ page }) => {
    await page.goto('/signup')
    await page.getByLabel('パスワード', { exact: true }).fill('abcdefgh')
    await page.getByLabel('パスワード(確認)').fill('abcdefgx')
    await page.getByRole('button', { name: '登録する' }).click()

    await expect(page.getByText('英字と数字を両方含めてください')).toBeVisible()
    await expect(page.getByText('パスワードが一致しません')).toBeVisible()
  })
})

test.describe('ログアウト・ログイン状態の確認(AUTH-03・04)', () => {
  test('ログアウトするとログイン画面になり、ブラウザの「戻る」でもログイン後の画面は見られない', async ({
    api,
    openAs,
  }) => {
    const alice = await api.signup()
    await api.createPost(alice, 'ログアウト前に見ていた投稿')
    const page = await openAs(alice)
    await expect(page.getByText('ログアウト前に見ていた投稿')).toBeVisible()
    // 「戻る」で戻れる履歴を作る(ホーム → 検索 の順に開き、検索画面でログアウトする)
    await page.getByRole('link', { name: '検索' }).click()
    await expect(page.getByRole('heading', { name: 'ユーザー検索' })).toBeVisible()

    await page.getByRole('complementary').getByRole('button', { name: 'ログアウト' }).click()
    await expect(page).toHaveURL('/login')
    expect(await page.evaluate((key) => localStorage.getItem(key), TOKEN_STORAGE_KEY)).toBeNull()

    // ログアウトした画面(検索)はログイン画面に置き換わるので、1つ前のホームに戻ろうとする
    await page.goBack()
    await expect(page).toHaveURL('/login')
    await expect(page.getByText('ログアウト前に見ていた投稿')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'ログイン' })).toBeVisible()
  })

  test('別のタブでログアウトすると、開いている他のタブもログイン画面になる', async ({ api, openAs }) => {
    const alice = await api.signup()
    const first = await openAs(alice)
    const second = await first.context().newPage()
    await second.goto(`/users/${alice.username}`)
    await expect(second.getByRole('link', { name: 'プロフィール編集' })).toBeVisible()

    await first.getByRole('complementary').getByRole('button', { name: 'ログアウト' }).click()
    await expect(first).toHaveURL('/login')
    await expect(second).toHaveURL('/login')
  })

  test('保存されたトークンが無効(改ざん・期限切れ)なら、ログイン画面になりトークンは消える', async ({ openAs }) => {
    const page = await openAs({ username: 'invalid', token: 'invalid.jwt.token' }, '/')
    await expect(page).toHaveURL('/login')
    expect(await page.evaluate((key) => localStorage.getItem(key), TOKEN_STORAGE_KEY)).toBeNull()
  })

  test('起動時にサーバーへつながらないときは、ログアウトせずに再読み込みを案内する', async ({ api, openAs }) => {
    const alice = await api.signup()
    const page = await openAs(alice, '/', {
      beforeGoto: (p) => p.route('**/api/auth/me', (route) => route.abort('connectionrefused')),
    })
    await expect(page.getByRole('alert')).toContainText('サーバーに接続できませんでした')
    // トークンが無効とは限らないので、消さない
    expect(await page.evaluate((key) => localStorage.getItem(key), TOKEN_STORAGE_KEY)).toBe(alice.token)

    // サーバーにつながるようになったら、「再読み込み」でそのまま使える
    await page.unroute('**/api/auth/me')
    await page.getByRole('button', { name: '再読み込み' }).click()
    await expect(page.getByRole('heading', { name: 'ホーム' })).toBeVisible()
  })
})
