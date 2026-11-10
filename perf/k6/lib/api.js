// APIの呼び出し(設計書 4-2)。結果を API ごとに集計できるように、name タグに API の No を付ける。
// (URLに投稿IDなどが入るため、タグを付けないと投稿ごとに別のAPIとして集計されてしまう)
import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, PASSWORD, perfUser } from './config.js';

function params(token, name, extraHeaders = {}) {
  return {
    headers: { Authorization: `Bearer ${token}`, ...extraHeaders },
    tags: { name },
  };
}

/** ステータスコードを確かめ、JSONを返す(失敗したら null) */
function expect(res, status, name) {
  const ok = check(res, { [`${name} ${status}`]: (r) => r.status === status });
  if (!ok || !res.body) {
    return null;
  }
  try {
    return res.json();
  } catch {
    return null;
  }
}

/**
 * A-02 ログイン。setup() で必要な人数分まとめてログインし、JWT を返す。
 * BCrypt の照合はCPUを多く使うので、負荷テスト中は毎回ログインせず、ここで取ったJWT(24時間有効)を使い回す
 */
export function loginUsers(count) {
  const tokens = [];
  const batchSize = 10;
  for (let start = 1; start <= count; start += batchSize) {
    const requests = [];
    for (let n = start; n < start + batchSize && n <= count; n++) {
      requests.push({
        method: 'POST',
        url: `${BASE_URL}/api/auth/login`,
        body: JSON.stringify({ email: perfUser(n).email, password: PASSWORD }),
        params: { headers: { 'Content-Type': 'application/json' }, tags: { name: 'A-02' } },
      });
    }
    for (const res of http.batch(requests)) {
      const body = expect(res, 200, 'A-02');
      if (!body) {
        throw new Error(`ログインに失敗しました(status=${res.status})。perf/seed/seed.sql を実行したか、PERF_PASSWORD・USER_COUNT が正しいか確認してください`);
      }
      tokens.push({ token: body.token, username: body.user.username });
    }
  }
  return tokens;
}

/** A-03 ログイン中のユーザー情報 */
export function me(token) {
  return expect(http.get(`${BASE_URL}/api/auth/me`, params(token, 'A-03')), 200, 'A-03');
}

/** T-01 タイムライン */
export function timeline(token, cursor) {
  const query = cursor ? `?cursor=${cursor}` : '';
  return expect(http.get(`${BASE_URL}/api/timeline${query}`, params(token, 'T-01')), 200, 'T-01');
}

/** T-02 新着投稿の確認 */
export function timelineNew(token, since) {
  return expect(http.get(`${BASE_URL}/api/timeline/new?since=${since}`, params(token, 'T-02')), 200, 'T-02');
}

/**
 * P-01 投稿作成(本文のみ)。API は multipart/form-data しか受け付けない。
 * k6 はファイルが無いとフォームを x-www-form-urlencoded で送るため、multipart の本文を自分で組み立てる
 */
export function createPost(token, content) {
  const boundary = `----k6perf${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const body = `--${boundary}\r\nContent-Disposition: form-data; name="content"\r\n\r\n${content}\r\n--${boundary}--\r\n`;
  const res = http.post(`${BASE_URL}/api/posts`, body,
    params(token, 'P-01', { 'Content-Type': `multipart/form-data; boundary=${boundary}` }));
  return expect(res, 201, 'P-01');
}

/** P-02 投稿詳細 */
export function getPost(token, postId) {
  return expect(http.get(`${BASE_URL}/api/posts/${postId}`, params(token, 'P-02')), 200, 'P-02');
}

/** P-03 投稿削除。レスポンスの本文が無い(204)ため、成功したかどうかを返す */
export function deletePost(token, postId) {
  const res = http.del(`${BASE_URL}/api/posts/${postId}`, null, params(token, 'P-03'));
  return check(res, { 'P-03 204': (r) => r.status === 204 });
}

/** L-01 いいねする */
export function like(token, postId) {
  return expect(http.post(`${BASE_URL}/api/posts/${postId}/likes`, null, params(token, 'L-01')), 200, 'L-01');
}

/** L-02 いいね取り消し */
export function unlike(token, postId) {
  return expect(http.del(`${BASE_URL}/api/posts/${postId}/likes`, null, params(token, 'L-02')), 200, 'L-02');
}

/** C-01 コメント一覧 */
export function comments(token, postId) {
  return expect(http.get(`${BASE_URL}/api/posts/${postId}/comments`, params(token, 'C-01')), 200, 'C-01');
}

/** C-02 コメント投稿 */
export function createComment(token, postId, content) {
  const res = http.post(`${BASE_URL}/api/posts/${postId}/comments`, JSON.stringify({ content }),
    params(token, 'C-02', { 'Content-Type': 'application/json' }));
  return expect(res, 201, 'C-02');
}

/** C-03 コメント削除 */
export function deleteComment(token, commentId) {
  return expect(http.del(`${BASE_URL}/api/comments/${commentId}`, null, params(token, 'C-03')), 200, 'C-03');
}

/** U-01 ユーザー検索 */
export function searchUsers(token, q) {
  return expect(http.get(`${BASE_URL}/api/users/search?q=${encodeURIComponent(q)}`, params(token, 'U-01')), 200, 'U-01');
}

/** U-02 新しく参加したユーザー */
export function newUsers(token) {
  return expect(http.get(`${BASE_URL}/api/users/new`, params(token, 'U-02')), 200, 'U-02');
}

/** U-03 プロフィール */
export function profile(token, username) {
  return expect(http.get(`${BASE_URL}/api/users/${username}`, params(token, 'U-03')), 200, 'U-03');
}

/** U-04 ユーザーの投稿一覧 */
export function userPosts(token, username) {
  return expect(http.get(`${BASE_URL}/api/users/${username}/posts`, params(token, 'U-04')), 200, 'U-04');
}

/** F-03 フォロー中の一覧 */
export function following(token, username) {
  return expect(http.get(`${BASE_URL}/api/users/${username}/following`, params(token, 'F-03')), 200, 'F-03');
}

/** F-04 フォロワーの一覧 */
export function followers(token, username) {
  return expect(http.get(`${BASE_URL}/api/users/${username}/followers`, params(token, 'F-04')), 200, 'F-04');
}
