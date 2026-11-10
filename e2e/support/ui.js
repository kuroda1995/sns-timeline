// 画面の部品の探し方(ロール・ラベル・文字で探す。CSSのクラス名には頼らない)。
// 画面の作りが変わったときに、直す場所をここにまとめる。

/** @typedef {import('@playwright/test').Page} Page */

/** 投稿カード(本文の一部で探す)。タイムライン・投稿詳細では投稿とコメントが article になる */
export function postCard(page, text) {
  return page.getByRole('article').filter({ hasText: text })
}

/** 左のサイドメニュー(PC幅)の「投稿する」ボタン */
export function sidebarComposeButton(page) {
  return page.getByRole('complementary').getByRole('button', { name: '投稿する' })
}

/** 投稿作成・編集のモーダル */
export function composer(page, title = '投稿する') {
  return page.getByRole('dialog', { name: title })
}

/** いいねボタン(アクセシブルな名前は「いいね N件」) */
export function likeButton(card) {
  return card.getByRole('button', { name: /^いいね \d+件$/ })
}

/**
 * フォロー中のボタン。マウスが乗っている間は「フォロー解除」に表示が変わる(CSS の :hover)ため、
 * 押した直後(マウスが乗ったまま)でも見つかるよう、どちらの名前でも探す
 */
export function followingButton(scope) {
  return scope.getByRole('button', { name: /^フォロー(中|解除)$/ })
}

/** カードの中の投稿詳細へのリンクから、投稿IDを読み取る */
export async function postIdOf(card) {
  const href = await card.locator('a[href^="/posts/"]').first().getAttribute('href')
  return Number(href.split('/').pop())
}

/** ファイル選択ダイアログを開くボタンを押し、ファイルを選ぶ */
export async function chooseFiles(page, button, files) {
  const chooser = page.waitForEvent('filechooser')
  await button.click()
  await (await chooser).setFiles(files)
}

/** 画像が読み込まれて表示されているか(壊れた画像・読み込み失敗なら false) */
export async function imagesLoaded(locator) {
  return locator.evaluateAll((imgs) => imgs.length > 0 && imgs.every((img) => img.complete && img.naturalWidth > 0))
}

/** 横スクロールが出ていないか(要件定義書 8章 No.2) */
export async function hasHorizontalOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
}
