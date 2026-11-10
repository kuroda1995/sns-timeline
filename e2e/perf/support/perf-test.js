// ブラウザ性能テストの共通部分(計測の仕組み・回線とCPUの制限・結果の記録)。
//
// 時間の測り方:
//   - ページを開く: ナビゲーションの開始(performance.now() の 0)から、条件を満たした最初の描画フレームまで
//   - 操作: 押した瞬間(pointerdown)から、条件を満たした最初の描画フレームまで(Core Web Vitals の INP と同じ考え方)
//   どちらもブラウザの中の時計で測るため、Playwright とブラウザの間の通信の時間は含まない。
//   「描画フレーム」は requestAnimationFrame で毎フレーム条件を確かめて判定する(誤差は1フレーム = 約16ms)。
import { test as base, expect } from '@playwright/test'
import { API_URL, FRONT_URL, TOKEN_STORAGE_KEY } from '../../support/env.js'
import { BUDGETS } from './budgets.js'
import { fmt } from './format.js'

export { expect }

/** 1つの計測項目を何回測るか(中央値を使う) */
export const ITERATIONS = Number(process.env.PERF_ITERATIONS ?? 5)

/** タイムラインの1ページ目(20件)が表示された */
export const TIMELINE_READY = "document.querySelectorAll('main article').length >= 20"

/**
 * ページの中に入れる計測用のスクリプト(page.addInitScript)。画面のスクリプトより先に動く。
 * @param {{ readyWhen?: string }} options readyWhen … 「表示が終わった」とみなす条件(JavaScriptの式)
 */
function installPerfObserver({ readyWhen }) {
  const perf = { lcp: null, cls: 0, longTasks: [], inputAt: null, readyAt: null }
  window.__perf = perf
  const observe = (type, onEntry) => {
    try {
      new PerformanceObserver((list) => list.getEntries().forEach(onEntry)).observe({ type, buffered: true })
    } catch {
      // 対応していないブラウザでは測らない
    }
  }
  observe('largest-contentful-paint', (e) => (perf.lcp = e.startTime))
  observe('layout-shift', (e) => {
    if (!e.hadRecentInput) perf.cls += e.value
  })
  observe('longtask', (e) => perf.longTasks.push({ start: e.startTime, duration: e.duration }))

  // 操作の開始(押した瞬間)。null に戻してから操作すると、その操作の時刻が入る
  for (const type of ['pointerdown', 'keydown']) {
    addEventListener(
      type,
      () => {
        if (perf.inputAt == null) perf.inputAt = performance.now()
      },
      { capture: true },
    )
  }

  /** 条件(JavaScriptの式)を満たした最初のフレームの時刻。30秒たっても満たさなければ失敗にする */
  perf.waitUntil = (source) => {
    const condition = new Function(`return (${source})`)
    const startedAt = performance.now()
    return new Promise((resolve, reject) => {
      const tick = () => {
        let ok = false
        try {
          ok = !!condition()
        } catch {
          // 画面がまだできていない
        }
        if (ok) resolve(performance.now())
        else if (performance.now() - startedAt > 30_000) reject(new Error(`30秒たっても条件を満たしませんでした: ${source}`))
        else requestAnimationFrame(tick)
      }
      tick()
    })
  }

  /** 一番下までスクロールする(キー入力はフォーカスの位置で効かないことがあるため、直接スクロールして時刻を記録する) */
  perf.scrollToBottom = () => {
    perf.inputAt = performance.now()
    window.scrollTo(0, document.documentElement.scrollHeight)
  }
  if (readyWhen) perf.waitUntil(readyWhen).then((t) => (perf.readyAt = t))
}

/** 遅い回線・CPUにする(Chrome DevTools Protocol)。Lighthouse のモバイルの計測と同じ条件 */
async function applyThrottle(page, throttle) {
  if (!throttle) return
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: throttle.latencyMs,
    downloadThroughput: (throttle.downloadKbps * 1024) / 8,
    uploadThroughput: (throttle.uploadKbps * 1024) / 8,
  })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle.cpuSlowdown })
}

/** 小さい順に並べた値の中央値など */
export function summarize(samples) {
  const sorted = [...samples].sort((a, b) => a - b)
  const at = (p) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]
  return { median: at(50), p75: at(75), min: sorted[0], max: sorted[sorted.length - 1], samples }
}

export const test = base.extend({
  /** プロジェクトごとの回線・CPUの制限(playwright.perf.config.js)。null なら制限しない */
  throttle: [null, { option: true }],
  /** 基準を外れたらテストを失敗にするか(false なら結果に表示するだけ) */
  enforceBudgets: [true, { option: true }],

  /** 性能テスト用のユーザー(perf/seed/seed.sql で作ったもの)でログインし、JWTを取る */
  perfAccount: [
    async ({ playwright }, use) => {
      const email = process.env.PERF_EMAIL ?? 'perf_u00001@example.com'
      const password = process.env.PERF_PASSWORD ?? 'perfpass123'
      const request = await playwright.request.newContext({ baseURL: API_URL })
      const res = await request.post('/api/auth/login', { data: { email, password } })
      if (!res.ok()) {
        throw new Error(
          `性能テスト用のユーザー(${email})でログインできません(${res.status()})。` +
            'perf/README.md の手順で性能テスト専用DBを起動し、seed.sql でテストデータを投入してください',
        )
      }
      const { token, user } = await res.json()
      await request.dispose()
      await use({ ...user, email, password, token })
    },
    { scope: 'worker' },
  ],

  /**
   * 計測した値を記録する。テストの最後に結果ファイル(perf-reporter.js)へ渡し、基準と比べる。
   *   metrics.add('timelineReady', 'タイムラインの表示', 'ms', samples, 'timelineReady')
   */
  metrics: async ({ enforceBudgets }, use, testInfo) => {
    /** @type {{ key: string, label: string, unit: string, budgetKey?: string, budget?: number, budgetReason?: string, median: number, p75: number, min: number, max: number, samples: number[] }[]} */
    const results = []
    await use({
      add(key, label, unit, samples, budgetKey) {
        const budget = budgetKey ? BUDGETS[budgetKey] : undefined
        results.push({
          key,
          label,
          unit,
          budgetKey,
          budget: budget?.budget,
          budgetReason: budget?.reason,
          ...summarize(samples),
        })
      },
    })
    await testInfo.attach('perf-metrics', {
      body: JSON.stringify({ enforceBudgets, results }),
      contentType: 'application/json',
    })
    if (!enforceBudgets) return
    for (const r of results) {
      if (r.budget === undefined) continue
      expect.soft(r.median, `${r.label} の中央値(${fmt(r.median, r.unit)})が基準(${fmt(r.budget, r.unit)})以内`).toBeLessThanOrEqual(r.budget)
    }
  },

  /**
   * 性能を測るための画面を開く。毎回新しいブラウザのコンテキスト(キャッシュが空の状態)になる。
   * @returns {(path: string, options?: { readyWhen?: string, loggedIn?: boolean }) => Promise<import('@playwright/test').Page>}
   */
  openPerfPage: async ({ browser, throttle, perfAccount }, use, testInfo) => {
    const contexts = []
    await use(async (path, { readyWhen, loggedIn = true } = {}) => {
      const { viewport, isMobile, hasTouch, deviceScaleFactor, userAgent } = testInfo.project.use
      const context = await browser.newContext({
        baseURL: FRONT_URL,
        viewport,
        isMobile,
        hasTouch,
        deviceScaleFactor,
        userAgent,
        locale: 'ja-JP',
        timezoneId: 'Asia/Tokyo',
        storageState: loggedIn
          ? { cookies: [], origins: [{ origin: FRONT_URL, localStorage: [{ name: TOKEN_STORAGE_KEY, value: perfAccount.token }] }] }
          : undefined,
      })
      contexts.push(context)
      const page = await context.newPage()
      await page.addInitScript(installPerfObserver, { readyWhen })
      await applyThrottle(page, throttle)
      await page.goto(path)
      return page
    })
    for (const context of contexts) await context.close()
  },
})

/**
 * 読み込みが終わった時点の、ページを開いたときの指標を集める
 * @param {import('@playwright/test').Page} page
 */
export async function collectLoadMetrics(page) {
  await page.waitForFunction(() => window.__perf.readyAt != null, null, { timeout: 30_000 })
  // LCP・レイアウトのずれは表示の直後にも記録されることがあるので、少し待ってから読む
  await page.waitForTimeout(300)
  return page.evaluate(() => {
    const perf = window.__perf
    const nav = performance.getEntriesByType('navigation')[0]
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null
    const resources = performance.getEntriesByType('resource')
    const api = (pattern) => {
      const entry = resources.find((r) => r.initiatorType === 'fetch' && pattern.test(r.name))
      return entry ? entry.duration : null
    }
    const kb = (type) =>
      resources.filter((r) => r.initiatorType === type).reduce((sum, r) => sum + r.transferSize, 0) / 1024
    // Total Blocking Time: 最初の描画から表示が終わるまでの長いタスク(50ms超)の、50msを超えた分の合計
    const tbt = perf.longTasks
      .filter((t) => fcp != null && t.start >= fcp && t.start < perf.readyAt)
      .reduce((sum, t) => sum + Math.max(0, t.duration - 50), 0)
    return {
      ttfb: nav.responseStart,
      fcp,
      domContentLoaded: nav.domContentLoadedEventEnd,
      lcp: perf.lcp,
      timelineReady: perf.readyAt,
      cls: perf.cls,
      tbt,
      apiMe: api(/\/api\/auth\/me$/),
      apiTimeline: api(/\/api\/timeline$/),
      jsKB: kb('script'),
      cssKB: kb('link') + kb('css'),
    }
  })
}

/**
 * 操作してから、条件を満たして描画されるまでの時間(ms)
 * @param {import('@playwright/test').Page} page
 * @param {{ action: () => Promise<unknown>, until: string, target?: import('@playwright/test').Locator }} options
 *   until … 終わったとみなす条件(JavaScriptの式)。target を渡すと、式の中で window.__perfTarget として使える
 */
export async function measureInteraction(page, { action, until, target }) {
  if (target) await target.evaluate((el) => (window.__perfTarget = el))
  await page.evaluate((source) => {
    window.__perf.inputAt = null
    window.__perfDone = window.__perf.waitUntil(source)
  }, until)
  await action()
  const end = await page.evaluate(() => window.__perfDone)
  const start = await page.evaluate(() => window.__perf.inputAt)
  if (start == null) throw new Error('操作(pointerdown・keydown)を検出できませんでした')
  return end - start
}

/** ブラウザ全体のメモリ・DOMの量(Chrome DevTools Protocol) */
export async function browserMetrics(page) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Performance.enable')
  const { metrics } = await cdp.send('Performance.getMetrics')
  const get = (name) => metrics.find((m) => m.name === name)?.value
  return { jsHeapMB: get('JSHeapUsedSize') / 1024 / 1024, domNodes: get('Nodes') }
}
