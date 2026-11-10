// ブラウザ性能テストの設定(設計書 7-5、perf/README.md「ブラウザ性能テスト」)
//   npm run perf                      … 全部(desktop → slow-mobile の順)
//   npm run perf -- --project=desktop … PCの条件だけ
// 事前に性能テスト専用DBを起動し、seed.sql でテストデータを投入しておく(perf/README.md)。
// バックエンドは perf プロファイル(専用DBに接続)で、画面は本番と同じビルドで起動する。
import { defineConfig, devices } from '@playwright/test'
import { webServers } from './support/servers.js'

export default defineConfig({
  testDir: './perf',
  // 同時に動かすと互いのCPUを取り合って値がぶれるため、1つずつ順に実行する
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 300_000,
  reporter: [['list'], ['./perf/support/perf-reporter.js'], ['html', { open: 'never', outputFolder: 'playwright-report-perf' }]],
  outputDir: 'test-results-perf',
  use: {
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      // 要件定義書 8章 No.1・2(Chrome・PC)。要件の合否はこの条件で判定する
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, enforceBudgets: true },
    },
    {
      // 参考: スマートフォン・モバイル回線。Lighthouse のモバイルの計測と同じ条件
      // (往復の遅延150ms・下り1.6Mbps・上り750kbps・CPUを4倍遅く)
      name: 'slow-mobile',
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 375, height: 740 },
        throttle: { latencyMs: 150, downloadKbps: 1.6 * 1024, uploadKbps: 750, cpuSlowdown: 4 },
        enforceBudgets: false,
      },
    },
  ],
  webServer: webServers('local,perf'),
})
