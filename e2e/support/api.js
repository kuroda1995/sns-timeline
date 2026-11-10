// テストデータの準備に使うAPIの呼び出し(設計書 4-2)。
// テストしたい操作の前提(ユーザー・投稿・フォローなど)は画面ではなくAPIで作る。
// 速く、テストしたい部分以外の画面の変更でテストが壊れないようにするため。
import { randomBytes } from 'node:crypto'
import { PASSWORD } from './env.js'

/**
 * 他のテスト・前回の実行と重ならないユーザー名(3〜15文字の半角英数字と _)
 * 例: e2e_lq3k9a1b2c3
 */
export function uniqueUsername() {
  return `e2e_${Date.now().toString(36).slice(-5)}${randomBytes(3).toString('hex')}`
}

/**
 * @typedef {object} Account テストで作ったユーザー
 * @property {number} id
 * @property {string} username
 * @property {string} displayName
 * @property {string} email
 * @property {string} password
 * @property {string} token JWT
 */

export class ApiClient {
  /** @param {import('@playwright/test').APIRequestContext} request */
  constructor(request) {
    this.request = request
  }

  /**
   * A-01 新規登録
   * @param {{ username?: string, displayName?: string }} [overrides]
   * @returns {Promise<Account>}
   */
  async signup({ username = uniqueUsername(), displayName } = {}) {
    const email = `${username}@example.com`
    const res = await this.request.post('/api/auth/signup', {
      data: { username, displayName: displayName ?? `E2E ${username}`, email, password: PASSWORD },
    })
    const { token, user } = await json(res)
    return { ...user, email, password: PASSWORD, token }
  }

  /**
   * P-01 投稿作成
   * @param {Account} account
   * @param {string} content
   * @param {{ name: string, mimeType: string, buffer: Buffer }[]} [images]
   */
  async createPost(account, content, images = []) {
    const form = new FormData()
    form.append('content', content)
    for (const image of images) form.append('images', new Blob([image.buffer], { type: image.mimeType }), image.name)
    return json(await this.request.post('/api/posts', { headers: auth(account), multipart: form }))
  }

  /**
   * 投稿を n 件作る(古い順に作るので、最後の投稿が一番新しい)
   * @param {(i: number) => string} contentOf 何件目(1始まり)の本文
   */
  async createPosts(account, n, contentOf = (i) => `${account.username} の投稿 ${i}`) {
    const posts = []
    // 作った順に ID が大きくなるよう、1件ずつ作る
    for (let i = 1; i <= n; i++) posts.push(await this.createPost(account, contentOf(i)))
    return posts
  }

  /** F-01 フォローする */
  async follow(account, username) {
    return json(await this.request.post(`/api/users/${username}/follow`, { headers: auth(account) }))
  }

  /** L-01 いいねする */
  async like(account, postId) {
    return json(await this.request.post(`/api/posts/${postId}/likes`, { headers: auth(account) }))
  }

  /** C-02 コメント投稿 */
  async comment(account, postId, content) {
    return json(await this.request.post(`/api/posts/${postId}/comments`, { headers: auth(account), data: { content } }))
  }

  /** U-05 プロフィール更新 */
  async updateProfile(account, { displayName, bio }) {
    return json(
      await this.request.put('/api/users/me', {
        headers: auth(account),
        data: { displayName: displayName ?? account.displayName, bio },
      }),
    )
  }

  /** P-02 投稿詳細(画面の操作の結果がサーバーに保存されたかを確かめる) */
  async getPost(account, postId) {
    return this.request.get(`/api/posts/${postId}`, { headers: auth(account) })
  }
}

function auth(account) {
  return { Authorization: `Bearer ${account.token}` }
}

/** 2xx でなければ、レスポンスの中身をメッセージに入れて失敗させる(準備の失敗とテストの失敗を区別しやすくする) */
async function json(res) {
  if (!res.ok()) {
    throw new Error(`テストデータの準備に失敗しました: ${res.status()} ${res.url()}\n${await res.text()}`)
  }
  return res.status() === 204 ? null : res.json()
}
