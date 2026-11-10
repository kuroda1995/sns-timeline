// load: 想定規模(ユーザー100人)が同時に使っている状態を再現し、要件を満たすかを判定する(設計書 7-5)。
// 合否の基準は lib/config.js の thresholdsFor()。外れたら終了コードが非0になる
//   k6 run perf/k6/scenarios/load.js
//   k6 run -e VUS=30 -e HOLD=3m perf/k6/scenarios/load.js   # 人数・時間を変える
//
// 1人(VU)の1回の流れ(約1分):
//   タイムラインを開く → 下にスクロール(0〜2ページ) → ときどき いいね・コメント・投稿詳細・検索・投稿
//   → タイムラインを開いたまま15秒ごとに新着確認(3回)
// 画面と同じく、新着確認は15秒ごと(要件定義書 8-1)。人が読む時間として、操作の間に数秒待つ
import { group, sleep } from 'k6';
import * as api from '../lib/api.js';
import { USER_COUNT, pick, randomInt, thresholdsFor } from '../lib/config.js';

const VUS = Number(__ENV.VUS || USER_COUNT);
const HOLD = __ENV.HOLD || '8m';
const POLL_INTERVAL_SECONDS = 15;

export const options = {
  // 100人分のログイン(BCrypt)に時間がかかるため、setup() の制限時間を延ばす
  setupTimeout: '3m',
  scenarios: {
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: VUS }, // 1分かけて全員がログインしてくる
        { duration: HOLD, target: VUS }, // 全員が使い続ける(ここが計測の本番)
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: thresholdsFor('load'),
};

export function setup() {
  return { users: api.loginUsers(Math.min(VUS, USER_COUNT)) };
}

export default function (data) {
  // VU(仮想ユーザー)ごとに別の人としてログインした状態で操作する
  const { token, username } = data.users[(__VU - 1) % data.users.length];

  // ---- タイムラインを開く ----
  const first = api.timeline(token);
  if (!first) {
    sleep(1);
    return;
  }
  const posts = [...first.items];
  let latestId = posts.length > 0 ? posts[0].id : 0;
  sleep(randomInt(2, 5));

  // ---- 下にスクロールして続きを読む(0〜2ページ) ----
  let cursor = first.hasNext ? first.nextCursor : null;
  const scrolls = randomInt(0, 2);
  for (let i = 0; i < scrolls && cursor; i++) {
    const page = api.timeline(token, cursor);
    if (!page) {
      break;
    }
    posts.push(...page.items);
    cursor = page.hasNext ? page.nextCursor : null;
    sleep(randomInt(2, 5));
  }

  // ---- 投稿に反応する ----
  const target = pick(posts);
  if (target) {
    if (Math.random() < 0.3) {
      group('いいね', () => {
        // いいね済みなら取り消す(いいねが増え続けて、データの偏りが変わらないようにする)
        if (target.likedByMe) {
          api.unlike(token, target.id);
        } else {
          api.like(token, target.id);
        }
      });
      sleep(1);
    }
    if (Math.random() < 0.2) {
      group('投稿詳細とコメント', () => {
        api.getPost(token, target.id);
        api.comments(token, target.id);
        if (Math.random() < 0.3) {
          api.createComment(token, target.id, `load test comment ${Date.now()}`);
        }
      });
      sleep(randomInt(2, 4));
    }
  }

  if (Math.random() < 0.1) {
    group('ユーザー検索・プロフィール', () => {
      const found = api.searchUsers(token, `perf_u000${randomInt(0, 9)}`);
      const user = found ? pick(found.items) : undefined;
      if (user) {
        api.profile(token, user.username);
        api.userPosts(token, user.username);
      }
    });
    sleep(randomInt(2, 4));
  }

  if (Math.random() < 0.05) {
    const created = api.createPost(token, `load test post by ${username} ${Date.now()}`);
    if (created) {
      latestId = Math.max(latestId, created.id);
    }
    sleep(1);
  }

  // ---- タイムラインを開いたまま、15秒ごとに新着を確認する ----
  for (let i = 0; i < 3; i++) {
    sleep(POLL_INTERVAL_SECONDS);
    const fresh = api.timelineNew(token, latestId);
    if (fresh && fresh.items.length > 0) {
      latestId = fresh.items[0].id;
    }
  }
}
