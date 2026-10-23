const pad = (n) => String(n).padStart(2, '0')

/** 「2026/10/02」(ブラウザのタイムゾーン＝日本時間で表示する) */
export function formatDate(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`
}

/** 「2026/10/02 12:34」(投稿詳細で使う) */
export function formatDateTime(iso) {
  const d = new Date(iso)
  return `${formatDate(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 24時間以内は「3分前」「5時間前」、それより前は「2026/10/02」(タイムライン機能 処理のルール No.6) */
export function formatRelativeTime(iso, now = Date.now()) {
  const sec = Math.floor((now - new Date(iso).getTime()) / 1000)
  if (sec < 60) return 'たった今'
  if (sec < 3600) return `${Math.floor(sec / 60)}分前`
  if (sec < 86400) return `${Math.floor(sec / 3600)}時間前`
  return formatDate(iso)
}
