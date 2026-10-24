/** 検索キーワードの最大文字数(ユーザー検索機能 SC-09) */
export const MAX_KEYWORD_LENGTH = 50

/**
 * 入力されたキーワードを整える。前後の空白を取り除き、先頭の @ を判定する(サーバーと同じルール)。
 * @returns {{ query: string, text: string, usernameOnly: boolean }}
 *   query: URL・APIに渡す値(前後の空白を取り除いたもの)。text: @ を取り除いた検索する文字
 */
export function normalizeKeyword(input) {
  const query = input.trim()
  const usernameOnly = query.startsWith('@')
  const text = usernameOnly ? query.slice(1).trim() : query
  return { query, text, usernameOnly }
}
