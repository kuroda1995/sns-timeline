// シナリオ: 画像付きで投稿し、拡大表示・編集・削除する
// PST-01〜04・IMG-01〜04。画像のアップロード → 保存 → 配信(/uploads)→ 表示 の通しは、jsdom のテストでは確かめられない
import { expect, handleNextDialog, test } from '../../support/fixtures.js'
import { oversizedPngFile, pngFile, textFile } from '../../support/images.js'
import { chooseFiles, composer, imagesLoaded, postCard, postIdOf, sidebarComposeButton } from '../../support/ui.js'

test('画像2枚付きで投稿 → 拡大表示 → 本文を編集 → 削除すると、どこからも見えなくなる', async ({ api, openAs }) => {
  const alice = await api.signup({ displayName: 'アリス' })
  const page = await openAs(alice)
  const content = '週末に撮った写真です'
  let postId

  await test.step('投稿モーダルで本文を書き、画像を2枚選ぶとプレビューが出る', async () => {
    await sidebarComposeButton(page).click()
    const modal = composer(page)
    await expect(modal.getByRole('textbox', { name: '本文' })).toBeFocused()
    await modal.getByRole('textbox', { name: '本文' }).fill(content)
    await chooseFiles(page, modal.getByRole('button', { name: /画像を追加/ }), [pngFile(0), pngFile(1)])

    await expect(modal.getByRole('list', { name: '添付する画像' }).getByRole('listitem')).toHaveCount(2)
    await expect(modal.getByRole('button', { name: /画像を追加/ })).toHaveText('🖼 画像を追加（残り2枚）')
    await expect(modal.getByText('残り 130 文字')).toBeVisible()
  })

  await test.step('投稿すると、モーダルが閉じてタイムラインの一番上に画像付きで表示される', async () => {
    await composer(page).getByRole('button', { name: '投稿', exact: true }).click()
    await expect(composer(page)).toBeHidden()

    const card = postCard(page, content)
    await expect(page.getByRole('article').first()).toContainText(content)
    await expect(card.getByRole('button', { name: /枚目を大きく表示/ })).toHaveCount(2)
    // サーバーに保存した画像が、返されたURLから実際に配信されて表示できる
    await expect.poll(() => imagesLoaded(card.getByRole('button', { name: /枚目を大きく表示/ }).locator('img'))).toBe(true)
    postId = await postIdOf(card)
  })

  await test.step('画像を押すと拡大表示になり、左右キーで切り替え、Escキーで閉じる', async () => {
    await postCard(page, content).getByRole('button', { name: '画像 1枚目を大きく表示' }).click()
    await expect(page.getByRole('dialog', { name: '画像 1/2' })).toBeVisible()
    // 拡大表示を開いても、カードを押したことにはならない(投稿詳細へ移動しない)
    await expect(page).toHaveURL('/')

    await page.keyboard.press('ArrowRight')
    const viewer = page.getByRole('dialog', { name: '画像 2/2' })
    await expect(viewer).toBeVisible()
    await expect.poll(() => imagesLoaded(viewer.getByRole('img', { name: '画像 2枚目' }))).toBe(true)

    await page.keyboard.press('Escape')
    await expect(viewer).toBeHidden()
  })

  await test.step('編集で本文を変えると「編集済み」が付き、読み込み直しても残る', async () => {
    await postCard(page, content).getByRole('button', { name: '投稿を編集' }).click()
    const modal = composer(page, '投稿を編集')
    await expect(modal.getByRole('textbox', { name: '本文' })).toHaveValue(content)
    // 編集では画像を変えられない
    await expect(modal.getByRole('button', { name: /画像を追加/ })).toHaveCount(0)
    // 何も変えていないうちは保存できない
    await expect(modal.getByRole('button', { name: '保存' })).toBeDisabled()

    await modal.getByRole('textbox', { name: '本文' }).fill('週末に撮った写真です(海と山)')
    await modal.getByRole('button', { name: '保存' }).click()
    await expect(modal).toBeHidden()

    const card = postCard(page, '週末に撮った写真です(海と山)')
    await expect(card).toContainText('編集済み')
    await page.reload()
    await expect(card).toContainText('編集済み')
    await expect(card.getByRole('button', { name: /枚目を大きく表示/ })).toHaveCount(2)
  })

  await test.step('削除の確認でキャンセルすると、削除されない', async () => {
    const dialog = handleNextDialog(page, { accept: false })
    await postCard(page, '海と山').getByRole('button', { name: '投稿を削除' }).click()
    expect(await dialog).toBe('この投稿を削除しますか？この操作は取り消せません。')
    await expect(postCard(page, '海と山')).toBeVisible()
  })

  await test.step('削除すると一覧から消え、読み込み直しても表示されず、詳細のURLを開くと案内が出る', async () => {
    const dialog = handleNextDialog(page, { accept: true })
    await postCard(page, '海と山').getByRole('button', { name: '投稿を削除' }).click()
    await dialog
    await expect(postCard(page, '海と山')).toHaveCount(0)

    await page.reload()
    await expect(page.getByRole('heading', { name: 'まだ投稿がありません' })).toBeVisible()

    await page.goto(`/posts/${postId}`)
    await expect(page.getByText('この投稿は削除されたか、存在しません')).toBeVisible()
  })
})

test.describe('投稿の入力チェック(PST-01・IMG-01)', () => {
  test('本文は140文字まで。絵文字も1文字として数え、141文字目で投稿できなくなる', async ({ api, openAs }) => {
    const alice = await api.signup()
    const page = await openAs(alice)
    await sidebarComposeButton(page).click()
    const modal = composer(page)
    const textbox = modal.getByRole('textbox', { name: '本文' })
    const submit = modal.getByRole('button', { name: '投稿', exact: true })

    // 空・空白と改行だけでは投稿できない
    await expect(submit).toBeDisabled()
    await textbox.fill('  \n  ')
    await expect(submit).toBeDisabled()

    // "👍".length は2だが、画面とサーバーの両方で1文字として数える(サーバーと数え方がずれると、画面で通ってもサーバーで弾かれる)
    const text140 = '👍'.repeat(140)
    await textbox.fill(`${text140}👍`)
    await expect(modal.getByText('残り -1 文字')).toBeVisible()
    await expect(submit).toBeDisabled()

    await textbox.fill(text140)
    await expect(modal.getByText('残り 0 文字')).toBeVisible()
    await submit.click()
    await expect(modal).toBeHidden()
    await expect(postCard(page, text140)).toBeVisible()
  })

  test('画像は4枚まで・jpg/png/gif/webp・5MBまで。画像だけでも投稿できる', async ({ api, openAs }) => {
    const alice = await api.signup()
    const page = await openAs(alice)
    await sidebarComposeButton(page).click()
    const modal = composer(page)
    const addImage = modal.getByRole('button', { name: /画像を追加/ })
    const previews = modal.getByRole('list', { name: '添付する画像' }).getByRole('listitem')

    await chooseFiles(page, addImage, [textFile()])
    await expect(modal.getByRole('alert')).toHaveText('jpg・png・gif・webp の画像を選んでください')
    await expect(previews).toHaveCount(0)

    await chooseFiles(page, addImage, [oversizedPngFile()])
    await expect(modal.getByRole('alert')).toHaveText('5MB以下の画像を選んでください')

    // 5枚選んだら、先頭から4枚だけ入る
    await chooseFiles(page, addImage, [0, 1, 2, 3, 4].map(pngFile))
    await expect(modal.getByRole('alert')).toHaveText('画像は4枚まで添付できます')
    await expect(previews).toHaveCount(4)
    await expect(addImage).toBeDisabled()

    // 1枚取り消すと、また追加できる
    await modal.getByRole('button', { name: '4枚目の画像を取り消す' }).click()
    await expect(previews).toHaveCount(3)
    await expect(addImage).toBeEnabled()

    // 本文が空でも、画像があれば投稿できる
    await modal.getByRole('button', { name: '投稿', exact: true }).click()
    await expect(modal).toBeHidden()
    await expect(page.getByRole('article').first().getByRole('button', { name: /枚目を大きく表示/ })).toHaveCount(3)
  })

  test('書きかけでモーダルを閉じようとすると確認が出て、キャンセルすれば入力が残る', async ({ api, openAs }) => {
    const alice = await api.signup()
    const page = await openAs(alice)
    await sidebarComposeButton(page).click()
    const modal = composer(page)
    await modal.getByRole('textbox', { name: '本文' }).fill('書きかけの投稿')

    const cancel = handleNextDialog(page, { accept: false })
    await page.keyboard.press('Escape')
    expect(await cancel).toBe('入力内容を破棄しますか？')
    await expect(modal.getByRole('textbox', { name: '本文' })).toHaveValue('書きかけの投稿')

    const discard = handleNextDialog(page, { accept: true })
    await modal.getByRole('button', { name: '閉じる' }).click()
    await discard
    await expect(modal).toBeHidden()
    await expect(page.getByRole('heading', { name: 'まだ投稿がありません' })).toBeVisible()
  })
})
