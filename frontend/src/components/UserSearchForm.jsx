import { useState } from 'react'
import { MAX_KEYWORD_LENGTH, normalizeKeyword } from '../utils/searchUtils.js'

/**
 * 検索欄と「検索」ボタン(SRCH-01)。<form> にしているので、Enterキーでもボタンでも送信できる。
 * 入力しただけでは検索しない(インクリメンタルサーチはしない、6-4)。
 * キーワードが変わったときに入力欄を合わせ直すよう、呼び出し側で key を付ける。
 */
export function UserSearchForm({ initialQuery, onSearch }) {
  const [input, setInput] = useState(initialQuery)
  const { query, text } = normalizeKeyword(input)
  // 空白だけ・@ だけのときは押せない
  const canSearch = text !== ''

  const handleSubmit = (e) => {
    e.preventDefault()
    if (canSearch) onSearch(query)
  }

  return (
    <form className="search-form" role="search" onSubmit={handleSubmit}>
      <input
        type="search"
        className="input"
        aria-label="ユーザー名で検索"
        placeholder="🔍 ユーザー名で検索"
        value={input}
        maxLength={MAX_KEYWORD_LENGTH}
        // 画面を開いたら、すぐに入力できるようにする
        autoFocus
        onChange={(e) => setInput(e.target.value)}
      />
      <button type="submit" className="btn btn--primary" disabled={!canSearch}>
        検索
      </button>
    </form>
  )
}
