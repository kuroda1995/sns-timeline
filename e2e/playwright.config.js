// E2Eテストの設定(設計書 7-6、e2e/README.md)
//   npx playwright test             … 全部
//   npx playwright test --ui        … 画面で1つずつ実行・確認する
//   npx playwright test scenarios   … ファイル名・フォルダ名で絞る
import { defineConfig, devices } from '@playwright/test'
import { FRONT_URL } from './support/env.js'
import { webServers } from './support/servers.js'

const isCI = !!process.env.CI

export default defineConfig({
  testDir: './tests',
  // テストはそれぞれ自分専用のユーザーを作るので、並列に実行しても互いに影響しない
  fullyParallel: true,
  // test.only の消し忘れで、CI のテストが一部しか実行されないのを防ぐ
  forbidOnly: isCI,
  // CI の共有の仮想マシンでは、まれに遅くて時間切れになることがある。1回だけ再実行し、
  // 再実行で通ったものは flaky としてレポートに残す(何度も落ちるものは不具合として扱う)
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI
    ? [['github'], ['list'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: FRONT_URL,
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    // 失敗したときだけ、操作の記録(トレース)・スクリーンショット・動画を残す(npx playwright show-report で見る)
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      // 要件定義書 8章 No.1・2: Chrome の最新版、幅1024px以上のPC
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
      testIgnore: /responsive\.spec\.js/,
    },
    {
      // 要件定義書 8章 No.2: スマートフォン幅(375px〜)でも大きく崩れないこと
      name: 'mobile',
      use: { ...devices['Pixel 7'], viewport: { width: 375, height: 740 } },
      testMatch: /responsive\.spec\.js/,
    },
  ],
  webServer: webServers('local,e2e'),
})
