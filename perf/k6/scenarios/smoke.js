// smoke: 1人で全APIを1回ずつ呼び、スクリプトとテストデータが正しいかを確かめる(設計書 7-5)。
// 負荷をかけるテストの前に毎回実行する。1件でも失敗したら終了コードが非0になる
//   k6 run perf/k6/scenarios/smoke.js
import { group, fail } from 'k6';
import * as api from '../lib/api.js';

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    checks: ['rate==1.0'],
    http_req_failed: ['rate==0'],
  },
};

export function setup() {
  return { users: api.loginUsers(1) };
}

export default function (data) {
  const { token, username } = data.users[0];

  group('ログイン中のユーザー', () => {
    api.me(token);
  });

  let posts = [];
  group('タイムライン', () => {
    const first = api.timeline(token);
    if (!first || first.items.length === 0) {
      fail('タイムラインが空です。perf/seed/seed.sql を実行したか確認してください');
    }
    posts = first.items;
    if (first.hasNext) {
      api.timeline(token, first.nextCursor);
    }
    api.timelineNew(token, posts[0].id);
  });

  group('投稿詳細・いいね・コメント', () => {
    const postId = posts[0].id;
    api.getPost(token, postId);
    api.comments(token, postId);
    // 元の状態に戻すため、いいね済みなら取り消してから付け直す
    if (posts[0].likedByMe) {
      api.unlike(token, postId);
      api.like(token, postId);
    } else {
      api.like(token, postId);
      api.unlike(token, postId);
    }
    const created = api.createComment(token, postId, 'smoke test comment');
    if (created) {
      api.deleteComment(token, created.comment.id);
    }
  });

  group('投稿の作成・削除', () => {
    const created = api.createPost(token, 'smoke test post');
    if (created) {
      api.deletePost(token, created.id);
    }
  });

  group('ユーザー検索・プロフィール・フォロー一覧', () => {
    api.searchUsers(token, 'perf_u0000');
    api.newUsers(token);
    api.profile(token, username);
    api.userPosts(token, username);
    api.following(token, username);
    api.followers(token, username);
  });
}
