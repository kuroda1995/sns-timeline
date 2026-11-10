// シナリオ: プロフィールを整え、フォロー・フォロワーの関係を確かめる
// USER-01・02、FLW-01〜04
import { expect, handleNextDialog, test } from '../../support/fixtures.js'
import { pngFile } from '../../support/images.js'
import { chooseFiles, followingButton, imagesLoaded, postCard } from '../../support/ui.js'

test('プロフィール(表示名・自己紹介・アイコン)を変えると、プロフィール・サイドメニュー・タイムラインに反映される', async ({
  api,
  openAs,
}) => {
  const alice = await api.signup({ displayName: 'アリス' })
  await api.createPost(alice, 'プロフィールを変える前の投稿')
  const page = await openAs(alice, `/users/${alice.username}`)

  await test.step('自分のプロフィールには「プロフィール編集」が出て、編集画面を開ける', async () => {
    await expect(page.getByRole('heading', { name: 'アリス', level: 2 })).toBeVisible()
    await expect(page.getByRole('button', { name: 'フォローする' })).toHaveCount(0)
    await page.getByRole('link', { name: 'プロフィール編集' }).click()
    await expect(page).toHaveURL('/settings/profile')
    await expect(page.getByLabel('表示名')).toHaveValue('アリス')
    await expect(page.getByRole('button', { name: '保存' })).toBeDisabled()
  })

  await test.step('表示名・自己紹介(改行あり)・アイコンを変えて保存する', async () => {
    await page.getByLabel('表示名').fill('アリス🌸')
    await page.getByLabel('自己紹介').fill('写真が好きです。\n週末は山に行きます。')
    await expect(page.getByText('19/160')).toBeVisible()
    await chooseFiles(page, page.getByRole('button', { name: '画像を変更' }), [pngFile(2)])
    await page.getByRole('button', { name: '保存' }).click()
    await expect(page).toHaveURL(`/users/${alice.username}`)
  })

  await test.step('プロフィールとサイドメニューに新しい内容が表示される', async () => {
    const profile = page.getByRole('region', { name: 'プロフィール' })
    await expect(profile.getByRole('heading', { name: 'アリス🌸' })).toBeVisible()
    await expect(profile).toContainText('写真が好きです。\n週末は山に行きます。')
    await expect.poll(() => imagesLoaded(profile.locator('img'))).toBe(true)
    await expect(page.getByRole('complementary')).toContainText('アリス🌸')
  })

  await test.step('タイムラインの自分の投稿も、新しい表示名・アイコンになる', async () => {
    await page.getByRole('link', { name: 'ホーム' }).click()
    const card = postCard(page, 'プロフィールを変える前の投稿')
    await expect(card).toContainText('アリス🌸')
    await expect.poll(() => imagesLoaded(card.locator('img'))).toBe(true)
  })

  await test.step('読み込み直しても残っている', async () => {
    await page.goto(`/users/${alice.username}`)
    await expect(page.getByRole('region', { name: 'プロフィール' })).toContainText('週末は山に行きます。')
  })
})

test('プロフィールからフォロー → フォロワー一覧に載る → フォロー解除(確認あり)で一覧から外れる', async ({
  api,
  openAs,
}) => {
  const [alice, bob] = await Promise.all([api.signup({ displayName: 'アリス' }), api.signup({ displayName: 'ボブ' })])
  const page = await openAs(bob, `/users/${alice.username}`)
  const followers = page.getByRole('link', { name: /フォロワー$/ })

  await test.step('フォローすると、ボタンとフォロワー数がすぐに変わる', async () => {
    await expect(followers).toHaveAccessibleName('0 フォロワー')
    await page.getByRole('button', { name: 'フォローする' }).click()
    await expect(followingButton(page)).toBeVisible()
    await expect(followers).toHaveAccessibleName('1 フォロワー')
  })

  await test.step('フォロワー一覧に自分が「あなた」として載る', async () => {
    await followers.click()
    await expect(page).toHaveURL(`/users/${alice.username}/followers`)
    const me = page.getByRole('article').filter({ hasText: `@${bob.username}` })
    await expect(me).toContainText('あなた')
    await expect(me.getByRole('button')).toHaveCount(0)
  })

  await test.step('自分(ボブ)のフォロー中一覧にアリスが載る', async () => {
    await page.goto(`/users/${bob.username}/following`)
    await expect(page.getByRole('article').filter({ hasText: `@${alice.username}` })).toBeVisible()
  })

  await test.step('フォロー解除は確認が出て、キャンセルすると何も変わらない', async () => {
    await page.goto(`/users/${alice.username}`)
    // マウスを乗せると「フォロー解除」に変わる
    await page.getByRole('button', { name: 'フォロー中' }).hover()
    await expect(page.getByRole('button', { name: 'フォロー解除' })).toBeVisible()

    const cancel = handleNextDialog(page, { accept: false })
    await page.getByRole('button', { name: 'フォロー解除' }).click()
    expect(await cancel).toBe(`@${alice.username} さんのフォローを解除しますか？`)
    await expect(followingButton(page)).toBeVisible()
    await expect(followers).toHaveAccessibleName('1 フォロワー')
  })

  await test.step('OK を押すとフォロー解除され、読み込み直しても解除されたまま', async () => {
    const ok = handleNextDialog(page, { accept: true })
    await followingButton(page).click()
    await ok
    await expect(page.getByRole('button', { name: 'フォローする' })).toBeVisible()
    await expect(followers).toHaveAccessibleName('0 フォロワー')

    await page.reload()
    await expect(page.getByRole('button', { name: 'フォローする' })).toBeVisible()
    await page.getByRole('link', { name: /フォロワー$/ }).click()
    await expect(page.getByRole('article').filter({ hasText: `@${bob.username}` })).toHaveCount(0)
  })
})
