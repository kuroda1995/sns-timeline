/** 投稿本文の最大文字数(投稿機能 SC-04) */
export const MAX_POST_LENGTH = 140

/**
 * 見た目の1文字で数える。"👍".length は2になるため、コードポイント単位で数える
 * (サーバー側の codePointCount と同じ数え方)
 */
export function countChars(text) {
  return [...text].length
}

/** 空白・改行だけの本文は「空」とみなす */
export function isBlank(text) {
  return text.trim() === ''
}
