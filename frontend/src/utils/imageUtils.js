/** 1つの投稿に添付できる画像の枚数(画像投稿機能 IMG-01) */
export const MAX_IMAGES = 4

/** 1枚の上限(サーバーの spring.servlet.multipart.max-file-size と同じ) */
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024

/** 受け付ける形式。ファイル選択ダイアログの accept にも使う */
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

/**
 * 画像を選んだときの形式・サイズのチェック。問題があればエラーメッセージ、無ければ null。
 * 画面では Content-Type で判定し、サーバーではファイルの中身(先頭のバイト列)でもう一度判定する。
 */
export function validateImageFile(file) {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return 'jpg・png・gif・webp の画像を選んでください'
  if (file.size > MAX_IMAGE_SIZE) return '5MB以下の画像を選んでください'
  return null
}
