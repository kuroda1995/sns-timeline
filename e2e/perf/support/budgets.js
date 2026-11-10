// ブラウザ性能テストの合否の基準(設計書 7-5)。
// 中央値がこの値以下なら合格。desktop(通常の回線・CPU)でだけ合否を判定し、
// slow-mobile(遅い回線・CPU)は同じ基準と比べて結果に表示するだけにする(参考値)。

/** @type {Record<string, { budget: number, reason: string }>} */
export const BUDGETS = {
  // 要件定義書 8章 No.4「タイムラインの表示が1秒以内」
  timelineReady: { budget: 1000, reason: '要件定義書 8章 No.4(タイムラインの表示が1秒以内)' },
  // Core Web Vitals の「良好」の基準(https://web.dev/articles/vitals)
  lcp: { budget: 2500, reason: 'Core Web Vitals の LCP「良好」' },
  cls: { budget: 0.1, reason: 'Core Web Vitals の CLS「良好」' },
  // Lighthouse の Total Blocking Time「良好」
  tbt: { budget: 200, reason: 'Lighthouse の TBT「良好」' },
  // 画面の中だけで反応する操作は、押してから次の描画までを INP の「良好」(200ms)以内にする
  instant: { budget: 200, reason: 'Core Web Vitals の INP「良好」(サーバーを待たずに反応する操作)' },
  // サーバーの応答を待つ操作は、タイムラインの表示と同じ1秒以内にする
  withApi: { budget: 1000, reason: '要件定義書 8章 No.4 に合わせる(サーバーの応答を待つ操作)' },
  // ログインはパスワードの照合(BCrypt)にわざと時間をかけるため、他より長くする
  login: { budget: 1500, reason: 'BCrypt の照合(約0.1〜0.3秒)の分を上乗せ' },
}
