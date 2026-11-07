// テストで使うAPIのレスポンスの形のデータ。必要な項目だけ上書きして使う

export const CURRENT_USER = { id: 1, username: 'hanako', displayName: '花子', avatarUrl: null, bio: '' }

export function makeAuthor(overrides = {}) {
  return { id: 2, username: 'taro', displayName: '太郎', avatarUrl: null, ...overrides }
}

export function makePost(overrides = {}) {
  return {
    id: 100,
    author: makeAuthor(),
    content: 'こんにちは',
    images: [],
    likeCount: 0,
    commentCount: 0,
    likedByMe: false,
    isMine: false,
    edited: false,
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    ...overrides,
  }
}

export function makeComment(overrides = {}) {
  return {
    id: 10,
    author: makeAuthor(),
    content: 'いいですね',
    isMine: false,
    createdAt: new Date(Date.now() - 60 * 1000).toISOString(),
    ...overrides,
  }
}

export function makeUserSummary(overrides = {}) {
  return {
    id: 2,
    username: 'taro',
    displayName: '太郎',
    avatarUrl: null,
    bio: '',
    followedByMe: false,
    isMe: false,
    ...overrides,
  }
}

export function page(items, { nextCursor = null, hasNext = false } = {}) {
  return { items, nextCursor, hasNext }
}

/** 解決・失敗のタイミングをテストから決められる Promise(通信中の表示を確かめるときに使う) */
export function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** 無限スクロールの末尾の目印が画面に入ったことにする(setup.js の IntersectionObserver を使う) */
export function triggerIntersection() {
  for (const observer of globalThis.IntersectionObserver.instances) {
    if (observer.elements.length > 0) observer.callback([{ isIntersecting: true }])
  }
}
