/* =========================================================
   SNS TimeLine プロトタイプ（HTML/CSS/JavaScript のみ）

   - サーバー・DBは使わず、データはブラウザの localStorage に保存する
   - 画面は URL のハッシュ（#/...）で切り替える（React Router の代わり）
   - 画面ID・機能IDは 要件定義書.md / 機能一覧.md / 機能定義書 に対応している
   - 本番実装ではサーバー側で行う処理（パスワードのハッシュ化・本人チェック等）も、
     ここではブラウザ内で簡易的に再現しているだけ。セキュリティ上の参考にはしないこと
   ========================================================= */
'use strict';

// ---------------------------------------------------------
// 定数（要件定義書 8-1 数値の一覧）
// ---------------------------------------------------------
const STORAGE_KEY = 'sns-timeline-mock';
const DATA_VERSION = 1;

const LIMITS = {
  postChars: 140,
  commentChars: 140,
  usernameMin: 3,
  usernameMax: 15,
  displayNameMax: 50,
  bioMax: 160,
  passwordMin: 8,
  passwordMax: 72,
  keywordMax: 50,
  imagesPerPost: 4,
  imageBytes: 5 * 1024 * 1024,
  pageSize: 20,
};

const RESERVED_USERNAMES = ['search', 'new', 'me', 'admin', 'settings', 'login', 'signup'];
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const LOADING_DELAY_MS = 250; // API通信の待ち時間を再現する

// ---------------------------------------------------------
// データの保存・読み込み（localStorage）
// ---------------------------------------------------------
let db = loadData() || createSeedData();
saveData();

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && data.version === DATA_VERSION ? data : null;
  } catch {
    return null; // 壊れたデータ・保存不可の環境では初期データで動かす
  }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    return true;
  } catch {
    toast('ブラウザの保存容量を超えたため、この変更は再読み込みすると消えます', 'error');
    return false;
  }
}

function nextId(kind) {
  db.seq[kind] += 1;
  return db.seq[kind];
}

// ---------------------------------------------------------
// サンプルデータ
// ---------------------------------------------------------
function createSeedData() {
  const now = Date.now();
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;
  const iso = (msAgo) => new Date(now - msAgo).toISOString();

  const users = [
    ['taro', '太郎', 'Javaを勉強中です。\nSpring Bootでアプリを作っています。', 40],
    ['hanako', '花子', 'フロントエンドが好きです。React勉強中🌸', 38],
    ['jiro', '次郎', 'インフラ担当。AWSとTerraformを触っています', 30],
    ['taro_dev', 'たろう', 'フロントエンド担当', 20],
    ['yamada', 'Taro Yamada', "Hello! I'm learning web development.", 10],
    ['sakura', 'さくら', '最近スクールに入りました。よろしくお願いします！', 2],
  ].map(([username, displayName, bio, daysAgo], i) => ({
    id: i + 1,
    username,
    email: `${username}@example.com`,
    password: 'password123', // 本番ではBCryptでハッシュ化して保存する（認証機能 4. 処理のルール No.1）
    displayName,
    bio,
    avatar: null,
    createdAt: iso(daysAgo * DAY),
  }));

  const followPairs = [
    [2, 1], [2, 3], [2, 6], // hanako → taro, jiro, sakura
    [1, 2], [1, 3],         // taro → hanako, jiro
    [3, 1], [3, 2],         // jiro → taro, hanako
    [6, 2],                 // sakura → hanako
    [4, 1],                 // taro_dev → taro
  ];
  const follows = followPairs.map(([followerId, followeeId], i) => ({
    id: i + 1,
    followerId,
    followeeId,
    createdAt: iso((followPairs.length - i) * DAY),
  }));

  const texts = [
    '今日はSpring Securityを学びました。認証と認可の違いがやっと分かった気がする',
    'Reactのコンポーネント分割、どこで切るかいつも迷う…',
    'Terraformで terraform plan → apply の流れに慣れてきた',
    'N+1問題、知らないと本当に気付かないやつ',
    'ER図を書いてから実装すると迷いが減る',
    'おはようございます☀️ 今日も1日がんばりましょう',
    'useEffect の依存配列でハマった。lintのルール大事',
    'PostgreSQL の ILIKE 便利',
    'カフェで作業中☕',
    '休憩がてら散歩してきました',
    'JWTの中身って base64 でデコードすると読めるんですね。秘密情報は入れちゃダメ',
    'ポートフォリオ用の画面を作りました！',
    'HTMLタグ <b>太字</b> や <script>alert(1)</script> を書いても、文字としてそのまま表示されます（XSS対策の確認）',
    'git の rebase と merge の違い、図で理解した',
    'ALBのヘルスチェックの設定、地味に大事',
    '週末はハッカソンに参加します',
    '論理削除と物理削除、どっちにするか悩んだ',
    'S3の署名付きURL、仕組みが面白い',
    'テストを書くと安心感が全然違う👍',
    '今日はここまで。おつかれさまでした🌙',
  ];
  // 投稿者の並び。hanako（ID:2）のタイムラインが20件を超え、追加読み込みを確認できるようにしている
  const authorPattern = [1, 2, 3, 6, 1, 4, 2, 3, 5, 1, 2, 6];
  // 投稿ごとの画像枚数（0〜4枚。全レイアウトを確認できるように散らしている）
  const imagePattern = [0, 0, 1, 0, 0, 2, 0, 0, 0, 3, 0, 0, 4, 0];

  const POST_COUNT = 60;
  const posts = [];
  for (let i = 0; i < POST_COUNT; i += 1) {
    const id = i + 1;
    const imageCount = imagePattern[i % imagePattern.length];
    posts.push({
      id,
      userId: authorPattern[i % authorPattern.length],
      content: texts[i % texts.length],
      images: Array.from({ length: imageCount }, (_, n) => sampleImage(id * 5 + n, `Photo ${id}-${n + 1}`)),
      // 古い投稿ほどIDが小さい（新しい順＝IDの降順になる）
      createdAt: iso((POST_COUNT - 1 - i) * 3.3 * HOUR + 5 * 60 * 1000),
      deletedAt: null,
    });
  }

  const likes = [];
  posts.forEach((post) => {
    users.forEach((user) => {
      if ((post.id * 7 + user.id * 3) % 4 === 0) likes.push({ userId: user.id, postId: post.id });
    });
  });

  const commentTexts = [
    '参考になります！',
    '私も同じところでつまずきました',
    'いいですね👏',
    'どの教材で勉強しましたか？',
    'あとで詳しく教えてください！',
  ];
  const comments = [];
  posts.forEach((post) => {
    const count = post.id % 5 === 0 ? 3 : post.id % 3 === 0 ? 1 : 0;
    for (let n = 0; n < count; n += 1) {
      const userId = ((post.userId + n) % users.length) + 1;
      comments.push({
        id: comments.length + 1,
        postId: post.id,
        userId,
        content: commentTexts[(post.id + n) % commentTexts.length],
        createdAt: new Date(new Date(post.createdAt).getTime() + (n + 1) * 20 * 60 * 1000).toISOString(),
        deletedAt: null,
      });
    }
  });

  return {
    version: DATA_VERSION,
    currentUserId: null,
    users,
    posts,
    likes,
    comments,
    follows,
    seq: { user: users.length, post: posts.length, comment: comments.length, follow: follows.length },
  };
}

// サンプル画像（SVGをその場で作る。外部ファイル不要）
function sampleImage(seed, label) {
  const hue = (seed * 47) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="hsl(${hue},70%,62%)"/><stop offset="1" stop-color="hsl(${(hue + 60) % 360},70%,42%)"/>
</linearGradient></defs>
<rect width="800" height="600" fill="url(#g)"/>
<circle cx="620" cy="160" r="70" fill="rgba(255,255,255,.35)"/>
<path d="M0 480 L220 300 L380 440 L520 340 L800 520 L800 600 L0 600Z" fill="rgba(0,0,0,.18)"/>
<text x="40" y="560" font-family="sans-serif" font-size="40" fill="#fff">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// ---------------------------------------------------------
// データ取得（本番ではAPI・SQLで行う処理）
// ---------------------------------------------------------
const userById = (id) => db.users.find((u) => u.id === id);
const userByName = (name) => db.users.find((u) => u.username.toLowerCase() === String(name).toLowerCase());
const currentUser = () => userById(db.currentUserId);
const isMe = (user) => user.id === db.currentUserId;

const activePosts = () => db.posts.filter((p) => !p.deletedAt);
const findActivePost = (id) => db.posts.find((p) => p.id === id && !p.deletedAt);

const likeCount = (postId) => db.likes.filter((l) => l.postId === postId).length;
const likedByMe = (postId) => db.likes.some((l) => l.postId === postId && l.userId === db.currentUserId);
const commentCount = (postId) => db.comments.filter((c) => c.postId === postId && !c.deletedAt).length;

const isFollowing = (followerId, followeeId) =>
  db.follows.some((f) => f.followerId === followerId && f.followeeId === followeeId);
const followingIds = (userId) => db.follows.filter((f) => f.followerId === userId).map((f) => f.followeeId);
const followingCount = (userId) => db.follows.filter((f) => f.followerId === userId).length;
const followerCount = (userId) => db.follows.filter((f) => f.followeeId === userId).length;

// カーソル方式のページング（設計書 3-1）。sorted は表示順に並んだ配列
function paginateByCursor(sorted, cursor, getKey, isAfterCursor) {
  const rest = cursor == null ? sorted : sorted.filter((item) => isAfterCursor(item, cursor));
  const items = rest.slice(0, LIMITS.pageSize);
  const hasNext = rest.length > LIMITS.pageSize;
  return { items, hasNext, nextCursor: hasNext ? getKey(items[items.length - 1]) : null };
}

// ページ番号方式（ユーザー検索のみ。ユーザー検索機能 9. の補足）
function paginateByPage(list, page) {
  const start = page * LIMITS.pageSize;
  const items = list.slice(start, start + LIMITS.pageSize);
  const hasNext = list.length > start + LIMITS.pageSize;
  return { items, hasNext, nextCursor: hasNext ? page + 1 : null };
}

// T-01 タイムライン：フォロー中＋自分の投稿を新しい順に
function fetchTimeline(cursor) {
  const targetIds = new Set([db.currentUserId, ...followingIds(db.currentUserId)]);
  const sorted = activePosts()
    .filter((p) => targetIds.has(p.userId))
    .sort((a, b) => b.id - a.id);
  return paginateByCursor(sorted, cursor, (p) => p.id, (p, c) => p.id < c);
}

// U-04 ユーザーの投稿一覧
function fetchUserPosts(userId, cursor) {
  const sorted = activePosts()
    .filter((p) => p.userId === userId)
    .sort((a, b) => b.id - a.id);
  return paginateByCursor(sorted, cursor, (p) => p.id, (p, c) => p.id < c);
}

// C-01 コメント一覧：古い順
function fetchComments(postId, cursor) {
  const sorted = db.comments
    .filter((c) => c.postId === postId && !c.deletedAt)
    .sort((a, b) => a.id - b.id);
  return paginateByCursor(sorted, cursor, (c) => c.id, (c, cur) => c.id > cur);
}

// F-03 / F-04 フォロー中・フォロワー一覧：フォローした日時が新しい順
function fetchFollowList(userId, type, cursor) {
  const sorted = db.follows
    .filter((f) => (type === 'following' ? f.followerId === userId : f.followeeId === userId))
    .sort((a, b) => b.id - a.id);
  const page = paginateByCursor(sorted, cursor, (f) => f.id, (f, c) => f.id < c);
  return {
    ...page,
    items: page.items.map((f) => userById(type === 'following' ? f.followeeId : f.followerId)),
  };
}

// U-01 ユーザー検索（ユーザー検索機能 5. 検索のルール）
function normalizeKeyword(raw) {
  let keyword = String(raw || '').trim();
  let usernameOnly = false;
  if (keyword.startsWith('@')) {
    usernameOnly = true;
    keyword = keyword.slice(1).trim();
  }
  return { keyword: keyword.slice(0, LIMITS.keywordMax), usernameOnly };
}

function searchUsers(raw) {
  const { keyword, usernameOnly } = normalizeKeyword(raw);
  if (!keyword) return [];
  const kw = keyword.toLowerCase();
  // JavaScriptの includes は文字をそのまま比較するので % や _ のエスケープは不要。
  // 本番（PostgreSQL の ILIKE）では % と _ のエスケープが必須（ユーザー検索機能 6-1）
  return db.users
    .filter((u) => u.username.toLowerCase().includes(kw) || (!usernameOnly && u.displayName.toLowerCase().includes(kw)))
    .sort((a, b) => {
      const exactA = a.username.toLowerCase() === kw ? 1 : 0;
      const exactB = b.username.toLowerCase() === kw ? 1 : 0;
      return exactB - exactA || b.id - a.id; // 完全一致を先頭に、それ以外は登録が新しい順
    });
}

// U-02 新しく参加したユーザー（自分は除く）
function fetchNewUsers() {
  return db.users
    .filter((u) => !isMe(u))
    .sort((a, b) => b.id - a.id)
    .slice(0, LIMITS.pageSize);
}

// ---------------------------------------------------------
// 共通ユーティリティ
// ---------------------------------------------------------

// DOM要素を作る。ユーザーが入力した文字列は必ず textContent で入れる（XSS対策）
function h(tag, props, ...children) {
  const el = document.createElement(tag);
  Object.entries(props || {}).forEach(([key, value]) => {
    if (value == null || value === false) return;
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'value') el.value = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else el.setAttribute(key, value === true ? '' : value);
  });
  children.flat().forEach((child) => {
    if (child == null || child === false) return;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  });
  return el;
}

// 絵文字も1文字として数える（投稿機能 3. の補足）
const countChars = (text) => [...text].length;

const pad = (n) => String(n).padStart(2, '0');

function formatDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

function formatDateTime(iso) {
  const d = new Date(iso);
  return `${formatDate(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 24時間以内は相対表示、それより前は日付（タイムライン機能 4. No.6）
function formatRelative(iso) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return 'たった今';
  if (sec < 3600) return `${Math.floor(sec / 60)}分前`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}時間前`;
  return formatDate(iso);
}

function toast(message, type = 'info') {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const el = h('div', { class: `toast${type === 'error' ? ' toast--error' : ''}`, role: 'status' }, message);
  root.append(el);
  setTimeout(() => el.remove(), 3000);
}

const wait = (ms = LOADING_DELAY_MS) => new Promise((resolve) => setTimeout(resolve, ms));

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// 画像の形式・サイズチェック（画像投稿機能 3.）。本番ではサーバー側でマジックナンバーも確認する
function validateImageFile(file) {
  if (!IMAGE_TYPES.includes(file.type)) return 'jpg・png・gif・webp の画像を選んでください';
  if (file.size > LIMITS.imageBytes) return '5MB以下の画像を選んでください';
  return null;
}

// ---------------------------------------------------------
// 共通部品
// ---------------------------------------------------------
function avatar(user, size = '') {
  const cls = `avatar${size ? ` avatar--${size}` : ''}`;
  if (user.avatar) return h('span', { class: cls }, h('img', { src: user.avatar, alt: '' }));
  const hue = (user.id * 67) % 360;
  const el = h('span', { class: cls, 'aria-hidden': 'true' }, [...user.displayName][0] || '?');
  el.style.background = `hsl(${hue}, 55%, 50%)`;
  return el;
}

// SRCH-03：表示名・ユーザー名・アイコンからプロフィールへ移動するリンク
const profileHref = (user) => `#/users/${encodeURIComponent(user.username)}`;
const userLink = (user, child, cls) => h('a', { href: profileHref(user), class: cls }, child);

// フォローボタン（フォロー機能 3.）
function followButton(user, onChange) {
  if (isMe(user)) return h('span', { class: 'you-label' }, 'あなた');
  const btn = h('button', { type: 'button', class: 'btn follow-btn' });
  const paint = (hover = false) => {
    const following = isFollowing(db.currentUserId, user.id);
    btn.classList.toggle('following', following);
    btn.textContent = following ? (hover ? 'フォロー解除' : 'フォロー中') : 'フォローする';
  };
  btn.addEventListener('mouseenter', () => paint(true));
  btn.addEventListener('mouseleave', () => paint(false));
  btn.addEventListener('click', (event) => {
    event.stopPropagation();
    if (isFollowing(db.currentUserId, user.id)) {
      // FLW-02：解除だけ確認ダイアログを出す
      if (!window.confirm(`@${user.username} さんのフォローを解除しますか？`)) return;
      db.follows = db.follows.filter((f) => !(f.followerId === db.currentUserId && f.followeeId === user.id));
      toast(`@${user.username} さんのフォローを解除しました`);
    } else {
      // FLW-01：既にフォロー済みなら何もしない（冪等）
      db.follows.push({ id: nextId('follow'), followerId: db.currentUserId, followeeId: user.id, createdAt: new Date().toISOString() });
      toast(`@${user.username} さんをフォローしました`);
    }
    saveData();
    paint(false);
    if (onChange) onChange();
  });
  paint(false);
  return btn;
}

// 投稿カード（要件定義書 6-4）
function postCard(post, { detail = false } = {}) {
  const author = userById(post.userId);
  const card = h('article', { class: `post-card${detail ? ' is-detail' : ''}` });

  if (!detail) {
    card.addEventListener('click', (event) => {
      if (event.target.closest('a, button, img')) return;
      navigate(`/posts/${post.id}`);
    });
  }

  const deleteBtn = post.userId === db.currentUserId
    ? h('button', {
      type: 'button',
      class: 'icon-btn post-card__delete',
      title: '削除',
      'aria-label': '投稿を削除',
      onclick: () => deletePost(post, card, detail),
    }, '🗑')
    : null;

  const content = post.content ? h('p', { class: 'post-card__content', text: post.content }) : null;
  const images = imageGrid(post.images);
  const actions = postActions(post);

  if (detail) {
    // append() は null を "null" という文字として追加してしまうため、無い要素は除く
    card.append(...[
      h('div', { class: 'post-card__detail-head' },
        userLink(author, avatar(author)),
        h('div', { class: 'post-card__detail-names' },
          userLink(author, author.displayName, 'post-card__name'),
          userLink(author, `@${author.username}`, 'post-card__user')),
        deleteBtn),
      content,
      images,
      h('p', { class: 'post-card__datetime' }, formatDateTime(post.createdAt)),
      actions,
    ].filter(Boolean));
    return card;
  }

  card.append(
    userLink(author, avatar(author)),
    h('div', { class: 'post-card__body' },
      h('div', { class: 'post-card__head' },
        userLink(author, author.displayName, 'post-card__name'),
        userLink(author, `@${author.username}`, 'post-card__user'),
        h('span', { class: 'post-card__time', title: formatDateTime(post.createdAt) }, `・${formatRelative(post.createdAt)}`),
        deleteBtn),
      content,
      images,
      actions),
  );
  return card;
}

// 💬 コメント数・♡ いいね数（インプレッション数・リツイートは置かない）
function postActions(post) {
  const commentBtn = h('button', {
    type: 'button',
    class: 'action-btn action-btn--comment',
    'aria-label': 'コメント',
    onclick: () => navigate(`/posts/${post.id}`),
  },
  h('span', { class: 'action-btn__icon' }, '💬'),
  h('span', { class: 'comment-count' }, String(commentCount(post.id) || '')));

  const likeBtn = h('button', { type: 'button', class: 'action-btn action-btn--like' });
  const paintLike = () => {
    const liked = likedByMe(post.id);
    const count = likeCount(post.id);
    likeBtn.classList.toggle('is-liked', liked);
    likeBtn.setAttribute('aria-pressed', String(liked));
    likeBtn.setAttribute('aria-label', liked ? 'いいねを取り消す' : 'いいね');
    likeBtn.replaceChildren(
      h('span', { class: 'action-btn__icon' }, liked ? '♥' : '♡'),
      h('span', {}, count ? String(count) : ''),
    );
  };
  likeBtn.addEventListener('click', (event) => {
    // ボタンの中身を描き直すと押した要素が外れ、投稿カード側のクリック判定（詳細へ移動）が誤作動するため止める
    event.stopPropagation();
    // LIKE-01 / LIKE-02：同じ人の同じ投稿へのいいねは1件だけ（DBのUNIQUE制約に相当）
    if (likedByMe(post.id)) {
      db.likes = db.likes.filter((l) => !(l.postId === post.id && l.userId === db.currentUserId));
    } else {
      db.likes.push({ userId: db.currentUserId, postId: post.id });
    }
    saveData();
    paintLike();
  });
  paintLike();

  return h('div', { class: 'post-actions' }, commentBtn, likeBtn);
}

// IMG-03：1〜4枚のレイアウト
function imageGrid(images) {
  if (!images || images.length === 0) return null;
  return h('div', { class: `image-grid image-grid--${images.length}` },
    images.map((src, index) => h('img', {
      src,
      alt: `投稿画像 ${index + 1}`,
      loading: 'lazy',
      onclick: () => openLightbox(images, index),
    })));
}

// PST-02：投稿削除（本人のみ・確認ダイアログ・論理削除）
function deletePost(post, card, isDetail) {
  if (post.userId !== db.currentUserId) {
    toast('この投稿は削除できません', 'error'); // 本番ではサーバーが403を返す
    return;
  }
  if (!window.confirm('この投稿を削除しますか？この操作は取り消せません。')) return;
  post.deletedAt = new Date().toISOString();
  saveData();
  toast('投稿を削除しました');
  if (isDetail) navigate('/');
  else card.remove();
}

// ユーザー行（検索結果・フォロー一覧で共通）
function userRow(user) {
  const firstLine = (user.bio || '').split('\n')[0];
  const row = h('div', { class: 'user-row', role: 'link', tabindex: '0' },
    avatar(user),
    h('div', { class: 'user-row__body' },
      h('div', { class: 'user-row__head' },
        h('div', { class: 'user-row__names' },
          h('div', { class: 'user-row__name' }, user.displayName),
          h('div', { class: 'user-row__user' }, `@${user.username}`)),
        followButton(user)),
      firstLine ? h('p', { class: 'user-row__bio' }, firstLine) : null));
  const open = () => navigate(`/users/${encodeURIComponent(user.username)}`);
  row.addEventListener('click', (event) => {
    if (event.target.closest('button')) return;
    open();
  });
  row.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') open();
  });
  return row;
}

// 無限スクロール付きの一覧（TL-02 など）
let activeObservers = [];

function pagedList({ fetchPage, renderItem, empty, endText }) {
  const container = h('div', { class: 'paged-list' });
  const sentinel = h('div', { class: 'sentinel' });
  const status = h('p', { class: 'list-status' });
  container.append(sentinel, status);

  let cursor = null;
  let hasNext = true;
  let loading = false;
  let count = 0;

  const isSentinelNearViewport = () => sentinel.getBoundingClientRect().top < window.innerHeight + 200;

  async function loadMore() {
    if (loading || !hasNext) return;
    loading = true;
    status.textContent = '読み込み中…';
    await wait();
    if (!container.isConnected) return; // 画面が切り替わっていたら何もしない
    const page = fetchPage(cursor);
    page.items.forEach((item) => {
      container.insertBefore(renderItem(item), sentinel);
      count += 1;
    });
    cursor = page.nextCursor;
    hasNext = page.hasNext;
    loading = false;
    if (hasNext) {
      status.textContent = '';
      if (isSentinelNearViewport()) loadMore(); // 画面が縦に長く、まだ一番下が見えている場合
    } else {
      observer.disconnect();
      status.textContent = count > 0 ? endText || '' : '';
      if (count === 0 && empty) container.insertBefore(empty, sentinel);
    }
  }

  const observer = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) loadMore();
  }, { rootMargin: '200px' });
  observer.observe(sentinel);
  activeObservers.push(observer);

  loadMore();

  return {
    element: container,
    // 一覧が全部読み込まれている場合だけ末尾に追加する（コメント投稿時）
    appendIfComplete(el) {
      if (hasNext) return;
      const emptyEl = container.querySelector('.notice, .empty');
      if (emptyEl) emptyEl.remove();
      container.insertBefore(el, sentinel);
      count += 1;
    },
  };
}

// ---------------------------------------------------------
// オーバーレイ：投稿作成モーダル（SC-04）・画像の拡大表示（IMG-04）
// ---------------------------------------------------------
let closeActiveOverlay = null;

function showOverlay(element, onRequestClose) {
  const root = document.getElementById('overlay-root');
  root.replaceChildren(element);
  document.body.style.overflow = 'hidden';
  closeActiveOverlay = onRequestClose;
}

function hideOverlay() {
  document.getElementById('overlay-root').replaceChildren();
  document.body.style.overflow = '';
  closeActiveOverlay = null;
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && closeActiveOverlay) closeActiveOverlay();
});

function openComposer() {
  const user = currentUser();
  const images = []; // { src }
  let submitting = false;

  const textarea = h('textarea', {
    class: 'textarea',
    placeholder: 'いまどうしてる？',
    'aria-label': '投稿本文',
  });
  const counter = h('span', { class: 'counter' });
  const previews = h('div', { class: 'previews' });
  const fileInput = h('input', { type: 'file', accept: IMAGE_TYPES.join(','), multiple: true, hidden: true });
  const addImageBtn = h('button', { type: 'button', class: 'image-add', onclick: () => fileInput.click() });
  const submitBtn = h('button', { type: 'button', class: 'btn btn--primary' }, '投稿');

  const isDirty = () => textarea.value.trim() !== '' || images.length > 0;

  function update() {
    const remain = LIMITS.postChars - countChars(textarea.value.trim());
    counter.textContent = `残り ${remain} 文字`;
    counter.classList.toggle('is-over', remain < 0);
    const left = LIMITS.imagesPerPost - images.length;
    addImageBtn.textContent = left > 0 ? `🖼 画像を追加（残り${left}枚）` : '🖼 画像は4枚まで';
    addImageBtn.disabled = left <= 0;
    submitBtn.disabled = submitting || !isDirty() || remain < 0;
    previews.replaceChildren(...images.map((img, index) => h('div', { class: 'preview' },
      h('img', { src: img.src, alt: `選択した画像 ${index + 1}` }),
      h('button', {
        type: 'button',
        class: 'preview__remove',
        'aria-label': `画像 ${index + 1} を取り消す`,
        onclick: () => { images.splice(index, 1); update(); },
      }, '×'))));
  }

  fileInput.addEventListener('change', async () => {
    const files = [...fileInput.files];
    fileInput.value = '';
    const room = LIMITS.imagesPerPost - images.length;
    if (files.length > room) toast('画像は4枚まで添付できます', 'error');
    for (const file of files.slice(0, room)) {
      const error = validateImageFile(file);
      if (error) {
        toast(error, 'error');
        continue;
      }
      images.push({ src: await readFileAsDataUrl(file) });
    }
    update();
  });

  textarea.addEventListener('input', update);

  function requestClose() {
    if (isDirty() && !window.confirm('入力内容を破棄しますか？')) return;
    hideOverlay();
  }

  submitBtn.addEventListener('click', async () => {
    const content = textarea.value.trim();
    if (!content && images.length === 0) return;
    if (countChars(content) > LIMITS.postChars) return;
    submitting = true;
    submitBtn.textContent = '投稿中…';
    update();
    await wait();
    db.posts.push({
      id: nextId('post'),
      userId: db.currentUserId,
      content,
      images: images.map((img) => img.src),
      createdAt: new Date().toISOString(),
      deletedAt: null,
    });
    saveData();
    hideOverlay();
    toast('投稿しました');
    // タイムラインか自分のプロフィールを表示中なら、先頭に出すために再描画する
    const { path } = parseHash();
    if (path === '/' || path === `/users/${user.username}`) render();
    else navigate('/');
  });

  const backdrop = h('div', { class: 'modal-backdrop' },
    h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': '投稿作成' },
      h('div', { class: 'modal__head' },
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': '閉じる', onclick: requestClose }, '×')),
      h('div', { class: 'composer' },
        avatar(user),
        h('div', { class: 'composer__body' },
          textarea,
          previews,
          h('div', { class: 'composer__foot' }, addImageBtn, fileInput, counter, submitBtn)))));
  backdrop.addEventListener('mousedown', (event) => {
    if (event.target === backdrop) requestClose();
  });

  showOverlay(backdrop, requestClose);
  update();
  textarea.focus();
}

function openLightbox(images, startIndex) {
  let index = startIndex;
  const img = h('img', { alt: '' });
  const countLabel = h('span', { class: 'lightbox__count' });
  const paint = () => {
    img.src = images[index];
    img.alt = `画像 ${index + 1}`;
    countLabel.textContent = images.length > 1 ? `${index + 1} / ${images.length}` : '';
  };
  const move = (delta) => {
    index = (index + delta + images.length) % images.length;
    paint();
  };
  const box = h('div', { class: 'lightbox', role: 'dialog', 'aria-modal': 'true', 'aria-label': '画像の拡大表示' },
    img,
    h('button', { type: 'button', class: 'lightbox__close', 'aria-label': '閉じる', onclick: hideOverlay }, '×'),
    images.length > 1 ? h('button', { type: 'button', class: 'lightbox__prev', 'aria-label': '前の画像', onclick: () => move(-1) }, '‹') : null,
    images.length > 1 ? h('button', { type: 'button', class: 'lightbox__next', 'aria-label': '次の画像', onclick: () => move(1) }, '›') : null,
    countLabel);
  box.addEventListener('click', (event) => {
    if (event.target === box) hideOverlay();
  });
  showOverlay(box, hideOverlay);
  paint();
}

// ---------------------------------------------------------
// ルーティング（URLのハッシュで画面を切り替える）
// ---------------------------------------------------------
function parseHash() {
  // パスの各部分は render() で decodeURIComponent、クエリは URLSearchParams がデコードする
  const raw = location.hash.slice(1) || '/';
  const [path, query] = raw.split('?');
  return { path: path || '/', params: new URLSearchParams(query || '') };
}

function navigate(path) {
  if (location.hash === `#${path}`) render();
  else location.hash = path;
}

const routes = [
  { pattern: /^\/login$/, view: viewLogin, auth: false },
  { pattern: /^\/signup$/, view: viewSignup, auth: false },
  { pattern: /^\/$/, view: viewTimeline, auth: true, nav: 'home' },
  { pattern: /^\/posts\/(\d+)$/, view: viewPostDetail, auth: true },
  { pattern: /^\/users\/([^/]+)\/(following|followers)$/, view: viewFollowList, auth: true },
  { pattern: /^\/users\/([^/]+)$/, view: viewProfile, auth: true, nav: 'profile' },
  { pattern: /^\/settings\/profile$/, view: viewProfileEdit, auth: true },
  { pattern: /^\/search$/, view: viewSearch, auth: true, nav: 'search' },
];

function render() {
  activeObservers.forEach((o) => o.disconnect());
  activeObservers = [];
  hideOverlay();
  renderDemoBar();

  const { path, params } = parseHash();
  const route = routes.find((r) => r.pattern.test(path));
  const app = document.getElementById('app');

  // AUTH-05：ログインしていなければログイン画面へ
  if (route && route.auth && !currentUser()) {
    location.replace('#/login');
    return;
  }
  // ログイン済みでログイン・新規登録画面を開いたらタイムラインへ
  if (route && !route.auth && currentUser()) {
    location.replace('#/');
    return;
  }

  window.scrollTo(0, 0);

  if (!route) {
    app.replaceChildren(currentUser()
      ? appLayout(null, h('div', { class: 'notice' }, h('strong', {}, 'ページが見つかりません'), h('a', { href: '#/' }, 'ホームへ戻る')))
      : h('div', { class: 'notice' }, h('strong', {}, 'ページが見つかりません'), h('a', { href: '#/login' }, 'ログイン画面へ')));
    return;
  }

  const match = path.match(route.pattern).slice(1).map(decodeURIComponent);
  const content = route.view(...match, params);
  app.replaceChildren(route.auth ? appLayout(route.nav, content) : content);
}

window.addEventListener('hashchange', render);

// ---------------------------------------------------------
// ログイン後の共通レイアウト（要件定義書 6-3）
// ---------------------------------------------------------
function appLayout(activeNav, content) {
  const user = currentUser();
  const navItem = (key, href, icon, label) => h('a', {
    href,
    class: `nav-link${activeNav === key ? ' is-active' : ''}`,
    'aria-current': activeNav === key ? 'page' : null,
  }, h('span', { class: 'nav-link__icon' }, icon), h('span', { class: 'nav-link__text' }, label));

  const sidebar = h('aside', { class: 'sidebar' },
    h('div', { class: 'sidebar__logo' }, 'SNS TimeLine'),
    h('nav', { class: 'sidebar__nav', 'aria-label': 'メインメニュー' },
      navItem('home', '#/', '🏠', 'ホーム'),
      navItem('search', '#/search', '🔍', '検索'),
      navItem('profile', profileHref(user), '👤', 'プロフィール')),
    h('div', { class: 'sidebar__post' },
      h('button', { type: 'button', class: 'btn btn--primary btn--large', onclick: openComposer }, '投稿する')),
    h('div', { class: 'sidebar__me' },
      userLink(user, [
        avatar(user),
        h('div', { class: 'sidebar__me-text' },
          h('div', { class: 'sidebar__me-name' }, user.displayName),
          h('div', { class: 'sidebar__me-user' }, `@${user.username}`)),
      ], 'sidebar__me-link'),
      h('button', { type: 'button', class: 'btn btn--outline btn--block', onclick: logout }, 'ログアウト')));

  const bottomNav = h('nav', { class: 'bottom-nav', 'aria-label': 'メインメニュー' },
    h('a', { href: '#/', class: activeNav === 'home' ? 'is-active' : null, 'aria-label': 'ホーム' }, '🏠'),
    h('a', { href: '#/search', class: activeNav === 'search' ? 'is-active' : null, 'aria-label': '検索' }, '🔍'),
    h('a', { href: profileHref(user), class: activeNav === 'profile' ? 'is-active' : null, 'aria-label': 'プロフィール' }, '👤'),
    h('button', { type: 'button', 'aria-label': 'ログアウト', onclick: logout }, '🚪'));

  const fab = h('button', { type: 'button', class: 'fab', 'aria-label': '投稿する', onclick: openComposer }, '✏️');

  return h('div', { class: 'layout' }, sidebar, h('main', { class: 'main' }, content), bottomNav, fab);
}

function pageHeader(title, { back = false, sub = null } = {}) {
  return h('header', { class: 'page-header' },
    back ? h('button', { type: 'button', class: 'icon-btn', 'aria-label': '戻る', onclick: goBack }, '←') : null,
    h('div', { class: 'page-header__titles' },
      h('h1', {}, title),
      sub ? h('div', { class: 'page-header__sub' }, sub) : null));
}

function goBack() {
  if (history.length > 1) history.back();
  else navigate('/');
}

// AUTH-03：ログアウト
function logout() {
  db.currentUserId = null;
  saveData();
  toast('ログアウトしました');
  navigate('/login');
}

// ---------------------------------------------------------
// SC-01 ログイン
// ---------------------------------------------------------
function viewLogin() {
  const email = h('input', { class: 'input', type: 'email', id: 'login-email', autocomplete: 'email' });
  const password = h('input', { class: 'input', type: 'password', id: 'login-password', autocomplete: 'current-password' });
  const formError = h('p', { class: 'auth__error', hidden: true });
  const submit = h('button', { type: 'submit', class: 'btn btn--dark btn--large' }, 'ログイン');
  const fieldErrors = {};

  const field = (key, label, input) => {
    fieldErrors[key] = h('p', { class: 'field__error', hidden: true });
    return h('div', { class: 'field' }, h('label', { for: input.id }, label), input, fieldErrors[key]);
  };

  const form = h('form', { novalidate: true },
    formError,
    field('email', 'メールアドレス', email),
    field('password', 'パスワード', password),
    submit);

  const showError = (key, message) => {
    fieldErrors[key].textContent = message || '';
    fieldErrors[key].hidden = !message;
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    formError.hidden = true;
    const emailValue = email.value.trim().toLowerCase();
    let ok = true;
    if (!emailValue) { showError('email', 'メールアドレスを入力してください'); ok = false; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) { showError('email', 'メールアドレスの形式で入力してください'); ok = false; }
    else showError('email', null);
    if (!password.value) { showError('password', 'パスワードを入力してください'); ok = false; }
    else showError('password', null);
    if (!ok) return;

    submit.disabled = true;
    submit.textContent = 'ログイン中…';
    await wait();
    const user = db.users.find((u) => u.email === emailValue && u.password === password.value);
    if (!user) {
      // どちらが間違っているかは伝えない（認証機能 3.）
      formError.textContent = 'メールアドレスまたはパスワードが正しくありません';
      formError.hidden = false;
      submit.disabled = false;
      submit.textContent = 'ログイン';
      return;
    }
    db.currentUserId = user.id;
    saveData();
    toast(`ようこそ、${user.displayName}さん`);
    navigate('/');
  });

  const demoAccount = (username) => {
    const user = userByName(username);
    return h('li', {},
      h('button', {
        type: 'button',
        onclick: () => {
          email.value = user.email;
          password.value = user.password;
          email.focus();
        },
      }, user.email),
      ` （${user.displayName}）`);
  };

  return h('div', { class: 'auth' },
    h('div', { class: 'auth__card' },
      h('h1', { class: 'auth__logo' }, 'SNS TimeLine'),
      h('h2', { class: 'auth__title' }, 'ログイン'),
      form,
      h('p', { class: 'auth__switch' }, 'アカウントをお持ちでない方は ', h('a', { href: '#/signup' }, '新規登録')),
      h('div', { class: 'demo-accounts' },
        h('h2', {}, 'デモ用アカウント（パスワードはすべて password123）'),
        h('ul', {}, demoAccount('hanako'), demoAccount('taro'), demoAccount('sakura')),
        h('p', { class: 'field__hint' }, 'クリックすると入力欄に入ります。花子はフォロー中が多く、タイムラインの追加読み込みを確認できます'))));
}

// ---------------------------------------------------------
// SC-02 新規登録
// ---------------------------------------------------------
function viewSignup() {
  const inputs = {
    username: h('input', { class: 'input', id: 'su-username', autocomplete: 'username', maxlength: LIMITS.usernameMax }),
    displayName: h('input', { class: 'input', id: 'su-display', maxlength: LIMITS.displayNameMax }),
    email: h('input', { class: 'input', type: 'email', id: 'su-email', autocomplete: 'email' }),
    password: h('input', { class: 'input', type: 'password', id: 'su-password', autocomplete: 'new-password' }),
    confirm: h('input', { class: 'input', type: 'password', id: 'su-confirm', autocomplete: 'new-password' }),
  };
  const errors = {};
  const submit = h('button', { type: 'submit', class: 'btn btn--dark btn--large' }, '登録する');

  const field = (key, label, hint, control = inputs[key]) => {
    errors[key] = h('p', { class: 'field__error', hidden: true });
    return h('div', { class: 'field' },
      h('label', { for: inputs[key].id }, label),
      control,
      hint ? h('p', { class: 'field__hint' }, hint) : null,
      errors[key]);
  };

  // 入力チェック（認証機能 3. SC-02）
  function validate() {
    const v = {
      username: inputs.username.value.trim(),
      displayName: inputs.displayName.value.trim(),
      email: inputs.email.value.trim().toLowerCase(),
      password: inputs.password.value,
      confirm: inputs.confirm.value,
    };
    const result = {};
    if (!v.username) result.username = 'ユーザー名を入力してください';
    else if (!/^[A-Za-z0-9_]+$/.test(v.username)) result.username = '半角英数字と _ だけが使えます';
    else if (v.username.length < LIMITS.usernameMin || v.username.length > LIMITS.usernameMax) result.username = '3〜15文字で入力してください';
    else if (RESERVED_USERNAMES.includes(v.username.toLowerCase())) result.username = 'このユーザー名は使用できません';
    else if (userByName(v.username)) result.username = 'このユーザー名は既に使われています';

    if (!v.displayName) result.displayName = '表示名を入力してください';
    else if (countChars(v.displayName) > LIMITS.displayNameMax) result.displayName = '50文字以内で入力してください';

    if (!v.email) result.email = 'メールアドレスを入力してください';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email) || v.email.length > 255) result.email = 'メールアドレスの形式で入力してください';
    else if (db.users.some((u) => u.email === v.email)) result.email = 'このメールアドレスは既に登録されています';

    if (!v.password) result.password = 'パスワードを入力してください';
    else if (v.password.length < LIMITS.passwordMin || v.password.length > LIMITS.passwordMax) result.password = '8〜72文字で入力してください';
    else if (!/[A-Za-z]/.test(v.password) || !/\d/.test(v.password)) result.password = '英字と数字を両方含めてください';

    if (v.confirm !== v.password) result.confirm = 'パスワードが一致しません';
    return { values: v, result };
  }

  const form = h('form', { novalidate: true },
    field('username', 'ユーザー名', '半角英数字と _（3〜15文字）。プロフィールのURLになります',
      h('div', { class: 'input-prefix' }, h('span', {}, '@'), inputs.username)),
    field('displayName', '表示名', '1〜50文字。後から変更できます'),
    field('email', 'メールアドレス'),
    field('password', 'パスワード', '8〜72文字。英字と数字をそれぞれ1文字以上'),
    field('confirm', 'パスワード（確認）'),
    submit);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const { values, result } = validate();
    Object.keys(inputs).forEach((key) => {
      errors[key].textContent = result[key] || '';
      errors[key].hidden = !result[key];
      inputs[key].classList.toggle('is-invalid', Boolean(result[key]));
    });
    if (Object.keys(result).length > 0) return;

    submit.disabled = true;
    submit.textContent = '登録中…';
    await wait();
    const user = {
      id: nextId('user'),
      username: values.username,
      email: values.email,
      password: values.password,
      displayName: values.displayName,
      bio: '',
      avatar: null,
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
    db.currentUserId = user.id; // AUTH-01：登録後はそのままログイン状態
    saveData();
    toast('アカウントを作成しました');
    navigate('/');
  });

  return h('div', { class: 'auth' },
    h('div', { class: 'auth__card' },
      h('h1', { class: 'auth__logo' }, 'SNS TimeLine'),
      h('h2', { class: 'auth__title' }, 'アカウント作成'),
      form,
      h('p', { class: 'auth__switch' }, 'アカウントをお持ちの方は ', h('a', { href: '#/login' }, 'ログイン'))));
}

// ---------------------------------------------------------
// SC-03 タイムライン
// ---------------------------------------------------------
function viewTimeline() {
  const user = currentUser();
  const list = pagedList({
    fetchPage: fetchTimeline,
    renderItem: (post) => postCard(post),
    endText: 'これ以上投稿はありません',
    // TL-04：0件のときはユーザー検索へ案内
    empty: h('div', { class: 'empty' },
      h('h2', {}, 'まだ投稿がありません'),
      h('p', {}, 'ユーザーを探してフォローしてみましょう'),
      h('a', { href: '#/search', class: 'btn btn--primary' }, 'ユーザーを探す')),
  });

  return h('div', {},
    pageHeader('ホーム'),
    h('div', { class: 'compose-prompt' },
      avatar(user),
      h('button', { type: 'button', class: 'compose-prompt__input', onclick: openComposer }, 'いまどうしてる？'),
      h('button', { type: 'button', class: 'btn btn--primary', onclick: openComposer }, '投稿する')),
    list.element);
}

// ---------------------------------------------------------
// SC-05 投稿詳細（コメント）
// ---------------------------------------------------------
function viewPostDetail(postIdText) {
  const post = findActivePost(Number(postIdText));
  if (!post) {
    return h('div', {},
      pageHeader('投稿', { back: true }),
      h('div', { class: 'notice' }, h('strong', {}, 'この投稿は削除されたか、存在しません'), h('a', { href: '#/' }, 'ホームへ戻る')));
  }

  const card = postCard(post, { detail: true });
  const updateCommentCount = () => {
    const el = card.querySelector('.comment-count');
    if (el) el.textContent = String(commentCount(post.id) || '');
  };

  function commentItem(comment) {
    const author = userById(comment.userId);
    const item = h('div', { class: 'comment' });
    const deleteBtn = comment.userId === db.currentUserId
      ? h('button', {
        type: 'button',
        class: 'icon-btn post-card__delete',
        title: '削除',
        'aria-label': 'コメントを削除',
        onclick: () => {
          if (!window.confirm('このコメントを削除しますか？この操作は取り消せません。')) return;
          comment.deletedAt = new Date().toISOString();
          saveData();
          item.remove();
          updateCommentCount();
          toast('コメントを削除しました');
        },
      }, '🗑')
      : null;
    item.append(
      userLink(author, avatar(author)),
      h('div', { class: 'comment__body' },
        h('div', { class: 'post-card__head' },
          userLink(author, author.displayName, 'post-card__name'),
          userLink(author, `@${author.username}`, 'post-card__user'),
          h('span', { class: 'post-card__time', title: formatDateTime(comment.createdAt) }, `・${formatRelative(comment.createdAt)}`),
          deleteBtn),
        h('p', { class: 'comment__content', text: comment.content })));
    return item;
  }

  const list = pagedList({
    fetchPage: (cursor) => fetchComments(post.id, cursor),
    renderItem: commentItem,
    empty: h('div', { class: 'notice' }, 'まだコメントはありません'),
  });

  // CMT-01：コメント入力欄
  const textarea = h('textarea', { class: 'textarea', placeholder: 'コメントを書く', 'aria-label': 'コメント本文', rows: 2 });
  const counter = h('span', { class: 'counter' });
  const send = h('button', { type: 'submit', class: 'btn btn--primary' }, '送信');
  let sending = false;
  const update = () => {
    const remain = LIMITS.commentChars - countChars(textarea.value.trim());
    counter.textContent = `残り ${remain} 文字`;
    counter.classList.toggle('is-over', remain < 0);
    send.disabled = sending || textarea.value.trim() === '' || remain < 0;
  };
  textarea.addEventListener('input', update);

  const form = h('form', { class: 'comment-form' },
    avatar(currentUser()),
    h('div', { class: 'comment-form__body' },
      textarea,
      h('div', { class: 'comment-form__foot' }, counter, send)));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const content = textarea.value.trim();
    if (!content || countChars(content) > LIMITS.commentChars) return;
    if (!findActivePost(post.id)) {
      toast('この投稿は削除されています', 'error'); // 本番ではサーバーが404を返す
      return;
    }
    sending = true;
    send.textContent = '送信中…';
    update();
    await wait();
    const comment = {
      id: nextId('comment'),
      postId: post.id,
      userId: db.currentUserId,
      content,
      createdAt: new Date().toISOString(),
      deletedAt: null,
    };
    db.comments.push(comment);
    saveData();
    list.appendIfComplete(commentItem(comment));
    updateCommentCount();
    textarea.value = '';
    sending = false;
    send.textContent = '送信';
    update();
    toast('コメントしました');
  });
  update();

  return h('div', {},
    pageHeader('投稿', { back: true }),
    card,
    form,
    list.element);
}

// ---------------------------------------------------------
// SC-06 プロフィール
// ---------------------------------------------------------
function viewProfile(username) {
  const user = userByName(username);
  if (!user) {
    return h('div', {},
      pageHeader('プロフィール', { back: true }),
      h('div', { class: 'notice' }, h('strong', {}, 'このアカウントは存在しません'), h('a', { href: '#/search' }, 'ユーザーを検索する')));
  }

  const followerCountEl = h('strong', {}, String(followerCount(user.id)));
  const actionBtn = isMe(user)
    ? h('a', { href: '#/settings/profile', class: 'btn btn--outline' }, 'プロフィール編集')
    : followButton(user, () => { followerCountEl.textContent = String(followerCount(user.id)); });

  const joined = new Date(user.createdAt);
  const base = `#/users/${encodeURIComponent(user.username)}`;

  const list = pagedList({
    fetchPage: (cursor) => fetchUserPosts(user.id, cursor),
    renderItem: (post) => postCard(post),
    endText: 'これ以上投稿はありません',
    empty: h('div', { class: 'notice' }, 'まだ投稿がありません'),
  });

  return h('div', {},
    pageHeader(user.displayName, { back: true, sub: `@${user.username}` }),
    h('div', { class: 'profile__cover' }),
    h('section', { class: 'profile__info' },
      h('div', { class: 'profile__top' }, avatar(user, 'large'), actionBtn),
      h('h2', { class: 'profile__name' }, user.displayName),
      h('p', { class: 'profile__username' }, `@${user.username}`),
      user.bio ? h('p', { class: 'profile__bio', text: user.bio }) : null,
      h('p', { class: 'profile__joined' }, `📅 ${joined.getFullYear()}年${joined.getMonth() + 1}月から利用しています`),
      h('div', { class: 'profile__counts' },
        h('a', { href: `${base}/following` }, h('strong', {}, String(followingCount(user.id))), ' フォロー中'),
        h('a', { href: `${base}/followers` }, followerCountEl, ' フォロワー'))),
    h('h3', { class: 'section-title' }, '投稿'),
    list.element);
}

// ---------------------------------------------------------
// SC-07 プロフィール編集
// ---------------------------------------------------------
function viewProfileEdit() {
  const user = currentUser();
  const original = { displayName: user.displayName, bio: user.bio, avatar: user.avatar };
  const draft = { ...original };

  const avatarSlot = h('span', {});
  const paintAvatar = () => avatarSlot.replaceChildren(avatar({ ...user, avatar: draft.avatar, displayName: draft.displayName || user.displayName }, 'large'));
  const fileInput = h('input', { type: 'file', accept: IMAGE_TYPES.join(','), hidden: true });
  const avatarError = h('p', { class: 'field__error', hidden: true });

  const nameInput = h('input', { class: 'input', id: 'edit-name', value: draft.displayName, maxlength: LIMITS.displayNameMax });
  const nameCounter = h('span', { class: 'counter' });
  const nameError = h('p', { class: 'field__error', hidden: true });
  const bioInput = h('textarea', { class: 'textarea', id: 'edit-bio', value: draft.bio, rows: 4 });
  const bioCounter = h('span', { class: 'counter' });
  const saveBtn = h('button', { type: 'submit', class: 'btn btn--dark' }, '保存');

  const isDirty = () => draft.displayName !== original.displayName || draft.bio !== original.bio || draft.avatar !== original.avatar;

  function update() {
    draft.displayName = nameInput.value.trim();
    draft.bio = bioInput.value.trim();
    const nameLen = countChars(draft.displayName);
    const bioLen = countChars(draft.bio);
    nameCounter.textContent = `${nameLen}/${LIMITS.displayNameMax}`;
    bioCounter.textContent = `${bioLen}/${LIMITS.bioMax}`;
    bioCounter.classList.toggle('is-over', bioLen > LIMITS.bioMax);
    const nameMessage = nameLen === 0 ? '表示名を入力してください' : '';
    nameError.textContent = nameMessage;
    nameError.hidden = !nameMessage;
    nameInput.classList.toggle('is-invalid', Boolean(nameMessage));
    // 何も変更していない状態では保存できない
    saveBtn.disabled = !isDirty() || nameLen === 0 || nameLen > LIMITS.displayNameMax || bioLen > LIMITS.bioMax;
  }

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    const error = validateImageFile(file);
    avatarError.textContent = error || '';
    avatarError.hidden = !error;
    if (error) return;
    draft.avatar = await readFileAsDataUrl(file);
    paintAvatar();
    update();
  });
  nameInput.addEventListener('input', () => { update(); paintAvatar(); });
  bioInput.addEventListener('input', update);

  const cancel = () => {
    if (isDirty() && !window.confirm('変更を破棄しますか？')) return;
    navigate(`/users/${encodeURIComponent(user.username)}`);
  };

  const form = h('form', { class: 'edit-form', novalidate: true },
    h('div', { class: 'edit-avatar' },
      avatarSlot,
      h('div', {},
        h('button', { type: 'button', class: 'btn btn--outline', onclick: () => fileInput.click() }, '画像を変更'),
        draft.avatar ? null : h('p', { class: 'field__hint' }, 'jpg・png・gif・webp、5MBまで'),
        avatarError,
        fileInput)),
    h('div', { class: 'field' },
      h('div', { class: 'field__row' }, h('label', { for: 'edit-name' }, '表示名'), nameCounter),
      nameInput,
      nameError),
    h('div', { class: 'field' },
      h('div', { class: 'field__row' }, h('label', { for: 'edit-bio' }, '自己紹介'), bioCounter),
      bioInput));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    update();
    if (saveBtn.disabled) return;
    saveBtn.disabled = true;
    await wait();
    user.displayName = draft.displayName;
    user.bio = draft.bio;
    user.avatar = draft.avatar;
    saveData();
    toast('プロフィールを更新しました');
    navigate(`/users/${encodeURIComponent(user.username)}`);
  });

  // ヘッダーの「保存」ボタンからフォームを送信する
  saveBtn.setAttribute('form', 'profile-edit-form');
  form.id = 'profile-edit-form';

  paintAvatar();
  update();

  return h('div', {},
    h('header', { class: 'page-header' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'キャンセル', onclick: cancel }, '×'),
      h('div', { class: 'page-header__titles' }, h('h1', {}, 'プロフィール編集')),
      h('div', { style: 'margin-left:auto' }, saveBtn)),
    form,
    h('p', { class: 'search-tip' }, 'ユーザー名（@ID）・メールアドレス・パスワードの変更は今回のスコープ外です'));
}

// ---------------------------------------------------------
// SC-08 フォロー中／フォロワー一覧
// ---------------------------------------------------------
function viewFollowList(username, type) {
  const user = userByName(username);
  if (!user) {
    return h('div', {},
      pageHeader('フォロー', { back: true }),
      h('div', { class: 'notice' }, h('strong', {}, 'このアカウントは存在しません')));
  }
  const base = `#/users/${encodeURIComponent(user.username)}`;
  const tab = (key, label) => h('a', {
    href: `${base}/${key}`,
    class: `tab${type === key ? ' is-active' : ''}`,
    'aria-current': type === key ? 'page' : null,
  }, label);

  const list = pagedList({
    fetchPage: (cursor) => fetchFollowList(user.id, type, cursor),
    renderItem: userRow,
    empty: h('div', { class: 'notice' }, type === 'following' ? 'まだ誰もフォローしていません' : 'まだフォロワーはいません'),
  });

  return h('div', {},
    pageHeader(user.displayName, { back: true, sub: `@${user.username}` }),
    h('nav', { class: 'tabs' }, tab('following', 'フォロー中'), tab('followers', 'フォロワー')),
    list.element);
}

// ---------------------------------------------------------
// SC-09 ユーザー検索
// ---------------------------------------------------------
function viewSearch(params) {
  const q = params.get('q') || '';
  const input = h('input', {
    class: 'input',
    type: 'search',
    placeholder: 'ユーザー名で検索',
    'aria-label': '検索キーワード',
    maxlength: LIMITS.keywordMax,
    value: q,
  });
  const button = h('button', { type: 'submit', class: 'btn btn--primary' }, '検索');
  const updateButton = () => { button.disabled = !normalizeKeyword(input.value).keyword; };
  input.addEventListener('input', updateButton);
  updateButton();

  // SRCH-01：Enterキー・検索ボタンのどちらでも送信される（入力中は検索しない）
  const form = h('form', { class: 'search-form', role: 'search' },
    h('div', { class: 'search-form__input' }, h('span', { 'aria-hidden': 'true' }, '🔍'), input),
    button);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const raw = input.value.trim();
    if (!normalizeKeyword(raw).keyword) return;
    navigate(`/search?q=${encodeURIComponent(raw)}`); // URLに残すので「戻る」で結果に戻れる
  });

  setTimeout(() => input.focus(), 0);

  const tip = h('p', { class: 'search-tip' }, '@ユーザー名と表示名の部分一致で検索します。先頭に @ を付けると @ユーザー名だけを検索します');
  const { keyword } = normalizeKeyword(q);

  // SRCH-04：検索前は新しく参加したユーザーを表示
  if (!keyword) {
    const users = fetchNewUsers();
    return h('div', {},
      pageHeader('ユーザー検索'),
      form,
      tip,
      h('h2', { class: 'search-heading' }, '新しく参加したユーザー'),
      users.length ? h('div', {}, users.map(userRow)) : h('div', { class: 'notice' }, 'まだ他のユーザーはいません'));
  }

  const results = searchUsers(q);
  const countText = results.length > LIMITS.pageSize ? '20件以上' : `${results.length}件`;
  const list = pagedList({
    fetchPage: (page) => paginateByPage(results, page || 0),
    renderItem: userRow,
    empty: h('div', { class: 'notice' }, `「${q.trim()}」に一致するユーザーは見つかりませんでした`),
  });

  return h('div', {},
    pageHeader('ユーザー検索'),
    form,
    tip,
    h('h2', { class: 'search-heading' }, `「${q.trim()}」の検索結果（${countText}）`),
    list.element);
}

// ---------------------------------------------------------
// デモ用バー：ユーザー切替・データ初期化
// ---------------------------------------------------------
function renderDemoBar() {
  const select = document.getElementById('demo-user-switch');
  if (!select) return;
  select.replaceChildren(
    h('option', { value: '' }, '（ログアウト状態）'),
    ...db.users.map((u) => h('option', { value: String(u.id) }, `${u.displayName} @${u.username}`)),
  );
  select.value = db.currentUserId ? String(db.currentUserId) : '';
}

document.getElementById('demo-user-switch').addEventListener('change', (event) => {
  db.currentUserId = event.target.value ? Number(event.target.value) : null;
  saveData();
  const user = currentUser();
  toast(user ? `${user.displayName}さんとしてログインしました` : 'ログアウトしました');
  navigate(user ? '/' : '/login');
});

document.getElementById('demo-reset').addEventListener('click', () => {
  if (!window.confirm('投稿・いいね・コメント・フォロー・登録したユーザーをすべて初期状態に戻しますか？')) return;
  db = createSeedData();
  saveData();
  toast('データを初期化しました');
  navigate('/login');
});

render();
