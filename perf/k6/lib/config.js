// 性能テストの共通設定(設計書 7-5)。値は k6 の -e オプション(環境変数)で上書きできる
//   例: k6 run -e BASE_URL=http://<ALBのDNS名> perf/k6/scenarios/load.js

/** テスト対象のURL。ローカルは Spring Boot に直接つなぐ(AWSでは ALB のURLを渡す) */
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

/** perf/seed/seed.sql で全ユーザーに設定したパスワード */
export const PASSWORD = __ENV.PERF_PASSWORD || 'perfpass123';

/** seed.sql で作ったユーザー数(scale=1 なら100人)。ログインに使うユーザーはこの範囲から選ぶ */
export const USER_COUNT = Number(__ENV.USER_COUNT || 100);

/** n番目(1始まり)の性能テスト用ユーザー。seed.sql と同じ形にする */
export function perfUser(n) {
  const id = String(n).padStart(5, '0');
  return { username: `perf_u${id}`, email: `perf_u${id}@example.com` };
}

/** 1〜max の整数をランダムに返す */
export function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** 配列からランダムに1つ選ぶ(空なら undefined) */
export function pick(items) {
  return items.length === 0 ? undefined : items[Math.floor(Math.random() * items.length)];
}

/**
 * 合否の基準(要件定義書 8章 No.4「タイムラインの表示が1秒以内」)。
 * 画面の描画にかかる時間を残すため、APIは1秒より短い目標にする。
 * name タグには設計書 4-2 の API の No(T-01 など)を入れている(lib/api.js)。
 * setup() のログイン(BCryptで遅い)を含めないように、シナリオ名(scenario タグ)で絞って判定する
 */
export function thresholdsFor(scenario) {
  return {
    // エラー(4xx・5xx・タイムアウト)の割合
    [`http_req_failed{scenario:${scenario}}`]: ['rate<0.01'],
    // レスポンスの中身の確認(check)に合格した割合
    [`checks{scenario:${scenario}}`]: ['rate>0.99'],
    // タイムライン(T-01)
    [`http_req_duration{scenario:${scenario},name:T-01}`]: ['p(95)<500'],
    // 新着確認(T-02)。全員が15秒ごとに呼ぶので、タイムラインより短くする
    [`http_req_duration{scenario:${scenario},name:T-02}`]: ['p(95)<200'],
    // その他を含めた全API
    [`http_req_duration{scenario:${scenario}}`]: ['p(95)<1000'],
  };
}
