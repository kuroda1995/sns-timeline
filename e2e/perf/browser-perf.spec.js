// ブラウザ性能テスト(設計書 7-5、perf/README.md「ブラウザ性能テスト」)。
// k6(perf/k6)はAPIの応答時間を測る。こちらは実際のブラウザで「画面に表示されるまで」「押してから反応するまで」を測る。
// 性能テスト専用DB(ユーザー100人・投稿1万件、perf/seed/seed.sql)のデータを使う。
//
// 各項目を ITERATIONS 回(既定5回)測り、中央値で基準(support/budgets.js)と比べる。
// 最初の1回はサーバー・ブラウザの準備(JITのコンパイルなど)が入るため、捨てて数えない。
import {
  browserMetrics,
  collectLoadMetrics,
  expect,
  ITERATIONS,
  measureInteraction,
  test as it,
  TIMELINE_READY,
} from './support/perf-test.js'

const articles = (page) => page.locator('main article')
const waitTimeline = (page) => expect(articles(page).nth(19)).toBeVisible({ timeout: 30_000 })

// 計測が互いに影響しないよう、1つずつ順に実行する
it.describe.configure({ mode: 'serial' })

it('タイムラインの初回表示(キャッシュなし)', async ({ openPerfPage, metrics }) => {
  const runs = []
  for (let i = 0; i <= ITERATIONS; i++) {
    const page = await openPerfPage('/', { readyWhen: TIMELINE_READY })
    const m = await collectLoadMetrics(page)
    if (i > 0) runs.push(m)
    await page.context().close()
  }
  const col = (key) => runs.map((r) => r[key]).filter((v) => v != null)
  metrics.add('timelineReady', 'タイムライン20件の表示(開いてから)', 'ms', col('timelineReady'), 'timelineReady')
  metrics.add('lcp', 'LCP(最も大きい要素の表示)', 'ms', col('lcp'), 'lcp')
  metrics.add('cls', 'CLS(表示のずれ)', '', col('cls'), 'cls')
  metrics.add('tbt', 'TBT(画面が操作を受け付けない時間)', 'ms', col('tbt'), 'tbt')
  metrics.add('ttfb', 'TTFB(HTMLの最初の1バイト)', 'ms', col('ttfb'))
  metrics.add('fcp', 'FCP(最初の描画)', 'ms', col('fcp'))
  metrics.add('domContentLoaded', 'DOMContentLoaded', 'ms', col('domContentLoaded'))
  metrics.add('apiMe', 'うち API A-03 ログイン確認', 'ms', col('apiMe'))
  metrics.add('apiTimeline', 'うち API T-01 タイムライン', 'ms', col('apiTimeline'))
  metrics.add('jsKB', 'JavaScript の転送量', 'KB', col('jsKB'))
})

it('タイムラインの再表示(キャッシュあり・読み込み直し)', async ({ openPerfPage, metrics }) => {
  const page = await openPerfPage('/', { readyWhen: TIMELINE_READY })
  await collectLoadMetrics(page)
  const runs = []
  for (let i = 0; i < ITERATIONS; i++) {
    await page.reload()
    runs.push(await collectLoadMetrics(page))
  }
  metrics.add('timelineReadyWarm', 'タイムライン20件の表示(読み込み直し)', 'ms', runs.map((r) => r.timelineReady), 'timelineReady')
  metrics.add('lcpWarm', 'LCP(読み込み直し)', 'ms', runs.map((r) => r.lcp).filter((v) => v != null), 'lcp')
})

it('ログインしてからタイムラインが表示されるまで', async ({ openPerfPage, perfAccount, metrics }) => {
  const samples = []
  for (let i = 0; i <= ITERATIONS; i++) {
    const page = await openPerfPage('/login', { loggedIn: false })
    await page.getByLabel('メールアドレス').fill(perfAccount.email)
    await page.getByLabel('パスワード').fill(perfAccount.password)
    const ms = await measureInteraction(page, {
      action: () => page.getByRole('button', { name: 'ログイン' }).click(),
      until: TIMELINE_READY,
    })
    if (i > 0) samples.push(ms)
    await page.context().close()
  }
  metrics.add('login', 'ログイン → タイムライン20件の表示', 'ms', samples, 'login')
})

it('タイムラインの操作(続きの読み込み・投稿詳細・プロフィール・いいね)', async ({ openPerfPage, metrics }) => {
  const page = await openPerfPage('/', { readyWhen: TIMELINE_READY })
  await waitTimeline(page)

  await it.step('いいね(押してから表示が変わるまで。サーバーの応答は待たない)', async () => {
    const samples = []
    for (let i = 0; i <= ITERATIONS; i++) {
      const like = articles(page).nth(i).getByRole('button', { name: /^いいね/ })
      const pressed = await like.getAttribute('aria-pressed')
      const toggled = pressed === 'true' ? 'false' : 'true'
      const sent = page.waitForResponse((res) => res.url().includes('/likes'))
      const ms = await measureInteraction(page, {
        action: () => like.click(),
        until: `window.__perfTarget.getAttribute('aria-pressed') === '${toggled}'`,
        target: like,
      })
      await sent
      if (i > 0) samples.push(ms)
      // データを元に戻す(次回の計測と同じ状態にする)
      const restored = page.waitForResponse((res) => res.url().includes('/likes'))
      await like.click()
      await restored
      await expect(like).toHaveAttribute('aria-pressed', pressed)
    }
    metrics.add('like', 'いいね(押してから表示が変わるまで)', 'ms', samples, 'instant')
  })

  await it.step('投稿詳細を開く(コメントの読み込みまで)と、タイムラインに戻る', async () => {
    const open = []
    const back = []
    for (let i = 0; i <= ITERATIONS; i++) {
      const content = articles(page).nth(i).getByRole('paragraph').first()
      await content.scrollIntoViewIfNeeded()
      const openMs = await measureInteraction(page, {
        action: () => content.click(),
        until:
          "location.pathname.startsWith('/posts/') && (() => { const s = document.querySelector('section[aria-label=\"コメント\"]'); return !!s && !s.textContent.includes('読み込み中') })()",
      })
      const backMs = await measureInteraction(page, {
        action: () => page.getByRole('button', { name: '戻る' }).click(),
        until: `location.pathname === '/' && ${TIMELINE_READY}`,
      })
      if (i > 0) {
        open.push(openMs)
        back.push(backMs)
      }
    }
    metrics.add('openDetail', '投稿詳細を開く(コメントの表示まで)', 'ms', open, 'withApi')
    metrics.add('backToTimeline', '投稿詳細からタイムラインに戻る', 'ms', back, 'instant')
  })

  await it.step('投稿者のプロフィールを開く(投稿一覧の表示まで)', async () => {
    const samples = []
    for (let i = 0; i <= ITERATIONS; i++) {
      const author = articles(page).nth(i).getByRole('link', { name: /^@/ })
      await author.scrollIntoViewIfNeeded()
      const ms = await measureInteraction(page, {
        action: () => author.click(),
        until:
          "location.pathname.startsWith('/users/') && !!document.querySelector('section[aria-label=\"プロフィール\"]') && document.querySelectorAll('main article').length > 0",
      })
      if (i > 0) samples.push(ms)
      await page.goBack()
      await waitTimeline(page)
    }
    metrics.add('openProfile', 'プロフィールを開く(投稿一覧の表示まで)', 'ms', samples, 'withApi')
  })

  await it.step('続きの20件の読み込み(一番下へスクロールしてから表示まで)', async () => {
    await page.evaluate(() => window.scrollTo(0, 0))
    const samples = []
    for (let i = 0; i <= ITERATIONS; i++) {
      const before = await articles(page).count()
      const ms = await measureInteraction(page, {
        action: () => page.evaluate(() => window.__perf.scrollToBottom()),
        until: `document.querySelectorAll('main article').length >= ${before + 20}`,
      })
      if (i > 0) samples.push(ms)
    }
    metrics.add('loadMore', '続きの20件の読み込み(スクロールしてから表示まで)', 'ms', samples, 'withApi')
  })
})

it('投稿する(モーダルを開く・送信して一覧に出るまで)', async ({ openPerfPage, metrics }) => {
  const page = await openPerfPage('/', { readyWhen: TIMELINE_READY })
  await waitTimeline(page)
  const openSamples = []
  const postSamples = []
  for (let i = 0; i <= ITERATIONS; i++) {
    await page.evaluate(() => window.scrollTo(0, 0))
    const openMs = await measureInteraction(page, {
      action: () => page.getByRole('button', { name: 'いまどうしてる？' }).click(),
      until: "document.activeElement?.getAttribute('aria-label') === '本文'",
    })
    const text = `ブラウザ性能テストの投稿 ${Date.now()}`
    const dialog = page.getByRole('dialog', { name: '投稿する' })
    await dialog.getByRole('textbox', { name: '本文' }).fill(text)
    const postMs = await measureInteraction(page, {
      action: () => dialog.getByRole('button', { name: '投稿', exact: true }).click(),
      until: `document.querySelector('main article')?.textContent.includes(${JSON.stringify(text)})`,
    })
    if (i > 0) {
      openSamples.push(openMs)
      postSamples.push(postMs)
    }
  }
  metrics.add('openComposer', '投稿モーダルを開く', 'ms', openSamples, 'instant')
  metrics.add('createPost', '投稿する(送信してから一覧に出るまで)', 'ms', postSamples, 'withApi')
})

it('ユーザー検索(検索ボタンを押してから結果の表示まで)', async ({ openPerfPage, metrics }) => {
  const page = await openPerfPage('/search')
  const samples = []
  for (let i = 0; i <= ITERATIONS; i++) {
    // 同じキーワードだと画面が変わらないので、毎回変える。
    // seed.sql のユーザー名は perf_u00001〜。perf_u0001 なら perf_u00010〜perf_u00019 の10人に一致する
    const q = `perf_u000${(i % 9) + 1}`
    await page.getByRole('searchbox', { name: 'ユーザー名で検索' }).fill(q)
    const ms = await measureInteraction(page, {
      action: () => page.getByRole('button', { name: '検索', exact: true }).click(),
      until: `document.querySelector('section[aria-label="検索結果"] h2')?.textContent.includes('「${q}」')`,
    })
    if (i > 0) samples.push(ms)
  }
  metrics.add('search', 'ユーザー検索(結果の表示まで)', 'ms', samples, 'withApi')
})

it('200件まで読み込んだときのメモリ・DOMの量と、スクロールの引っかかり', async ({ openPerfPage, metrics }) => {
  it.slow()
  const page = await openPerfPage('/', { readyWhen: TIMELINE_READY })
  await waitTimeline(page)
  const at20 = await browserMetrics(page)

  // 無限スクロールで200件(10ページ)まで読み込む。一覧は画面から外れた投稿も残し続ける作りのため、増え方を見ておく
  const loadTimes = []
  while ((await articles(page).count()) < 200) {
    const before = await articles(page).count()
    loadTimes.push(
      await measureInteraction(page, {
        action: () => page.evaluate(() => window.__perf.scrollToBottom()),
        until: `document.querySelectorAll('main article').length > ${before}`,
      }),
    )
  }
  // 200件の一覧を上までスクロールしたときの長いタスク(50ms超)= 引っかかり
  const longTasksDuringScroll = await page.evaluate(async () => {
    const from = performance.now()
    for (let y = document.body.scrollHeight; y > 0; y -= 600) {
      window.scrollTo(0, y)
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    }
    return window.__perf.longTasks.filter((t) => t.start >= from).reduce((sum, t) => sum + Math.max(0, t.duration - 50), 0)
  })
  const at200 = await browserMetrics(page)

  metrics.add('loadMoreUntil200', '続きの読み込み(21〜200件目、9回)', 'ms', loadTimes)
  metrics.add('scrollBlocking', '200件をスクロールしたときのブロック時間', 'ms', [longTasksDuringScroll])
  metrics.add('heap20', 'JSヒープ(20件)', 'MB', [at20.jsHeapMB])
  metrics.add('heap200', 'JSヒープ(200件)', 'MB', [at200.jsHeapMB])
  metrics.add('dom20', 'DOMのノード数(20件)', '個', [at20.domNodes])
  metrics.add('dom200', 'DOMのノード数(200件)', '個', [at200.domNodes])
})
