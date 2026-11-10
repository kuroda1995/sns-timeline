// E2Eテストの共通の準備(fixture)。テストファイルでは @playwright/test の代わりにここから test・expect を読み込む。
//
//   api      … テストデータを準備するAPIクライアント(support/api.js)
//   openAs   … 指定したユーザーでログインした状態の画面を開く。ユーザーごとに別のブラウザ(コンテキスト)になる
//   page     … ログインしていない画面(ログイン・新規登録のテスト用)
//
// どの画面でも、次のことが起きたらテストを失敗にする(画面に出ない不具合を見逃さないため):
//   - 画面のJavaScriptで捕まえていない例外(pageerror)
//   - console.error(通信エラーでブラウザが出す "Failed to load resource" は、エラー表示のテストで起きるので除く)
//   - テストが想定していない alert・confirm(handleNextDialog で予告していないもの)
import { test as base, expect } from '@playwright/test'
import { ApiClient } from './api.js'
import { API_URL, FRONT_URL, TOKEN_STORAGE_KEY } from './env.js'

export { expect }

/** console.error のうち、問題にしないもの */
const IGNORED_CONSOLE_ERRORS = [/Failed to load resource/]

/** ブラウザのコンテキストを作るときに、プロジェクトの設定(画面サイズなど)から引き継ぐ項目 */
const CONTEXT_OPTION_KEYS = [
  'baseURL',
  'viewport',
  'deviceScaleFactor',
  'isMobile',
  'hasTouch',
  'userAgent',
  'locale',
  'timezoneId',
]

/** @type {WeakMap<import('@playwright/test').Page, PageWatcher>} */
const watchers = new WeakMap()

class PageWatcher {
  /** @param {import('@playwright/test').Page} page */
  constructor(page, label) {
    this.label = label
    /** @type {string[]} */
    this.problems = []
    /** @type {{ accept: boolean, promptText?: string, resolve: (message: string) => void }[]} */
    this.expectedDialogs = []

    page.on('pageerror', (error) => this.problems.push(`捕まえていない例外: ${error.message}`))
    page.on('console', (message) => {
      if (message.type() !== 'error') return
      if (IGNORED_CONSOLE_ERRORS.some((re) => re.test(message.text()))) return
      this.problems.push(`console.error: ${message.text()}`)
    })
    page.on('dialog', async (dialog) => {
      const expected = this.expectedDialogs.shift()
      if (!expected) {
        this.problems.push(`想定していないダイアログ(${dialog.type()}): ${dialog.message()}`)
        await dialog.dismiss()
        return
      }
      expected.resolve(dialog.message())
      if (expected.accept) await dialog.accept(expected.promptText)
      else await dialog.dismiss()
    })
  }

  assertNoProblems() {
    expect(this.problems, `${this.label} で問題が起きました`).toEqual([])
  }
}

/**
 * 次に出る alert・confirm を予告し、OK(accept)かキャンセルを押す。戻り値はダイアログのメッセージ。
 * 予告せずにダイアログが出たらテストは失敗する。
 *
 *   const dialog = handleNextDialog(page, { accept: true })
 *   await page.getByRole('button', { name: '投稿を削除' }).click()
 *   expect(await dialog).toContain('削除しますか')
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ accept: boolean }} options
 * @returns {Promise<string>}
 */
export function handleNextDialog(page, { accept }) {
  const watcher = watchers.get(page)
  if (!watcher) throw new Error('fixture で作っていない画面です')
  return new Promise((resolve) => watcher.expectedDialogs.push({ accept, resolve }))
}

/** ログイン状態にするための localStorage(画面はJWTを localStorage に保存する) */
export function storageStateFor(account) {
  return {
    cookies: [],
    origins: [{ origin: FRONT_URL, localStorage: [{ name: TOKEN_STORAGE_KEY, value: account.token }] }],
  }
}

export const test = base.extend({
  api: async ({ playwright }, use) => {
    const request = await playwright.request.newContext({ baseURL: API_URL })
    await use(new ApiClient(request))
    await request.dispose()
  },

  page: async ({ page }, use) => {
    const watcher = new PageWatcher(page, 'ログインしていない画面')
    watchers.set(page, watcher)
    await use(page)
    watcher.assertNoProblems()
  },

  openAs: async ({ browser }, use, testInfo) => {
    const contextOptions = Object.fromEntries(
      CONTEXT_OPTION_KEYS.filter((key) => testInfo.project.use[key] !== undefined).map((key) => [
        key,
        testInfo.project.use[key],
      ]),
    )
    /** @type {{ context: import('@playwright/test').BrowserContext, watchers: PageWatcher[] }[]} */
    const opened = []

    /**
     * @param {import('./api.js').Account} account
     * @param {string} [path] 最初に開くパス
     * @param {{ beforeGoto?: (page: import('@playwright/test').Page) => Promise<void> }} [options]
     *   beforeGoto … 画面を開く前に行う準備(時計の差し替え page.clock.install()、通信の差し替え page.route() など)
     */
    const openAs = async (account, path = '/', { beforeGoto } = {}) => {
      const context = await browser.newContext({ ...contextOptions, storageState: storageStateFor(account) })
      const entry = { context, watchers: [] }
      opened.push(entry)
      // 同じユーザーで2つ目のタブを開いたとき(context.newPage())にも見張る
      context.on('page', (page) => {
        const watcher = new PageWatcher(page, `@${account.username} の画面`)
        watchers.set(page, watcher)
        entry.watchers.push(watcher)
      })
      const page = await context.newPage()
      await beforeGoto?.(page)
      await page.goto(path)
      return page
    }

    await use(openAs)

    for (const { context } of opened) await context.close()
    for (const { watchers: list } of opened) list.forEach((w) => w.assertNoProblems())
  },
})
