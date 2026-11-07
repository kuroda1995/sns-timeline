import { describe, expect, it } from 'vitest'
import { formatDate, formatDateTime, formatRelativeTime } from './dateUtils.js'

// ブラウザのタイムゾーンで表示するため、テストでもローカル時刻で日時を作る
const local = (...args) => new Date(...args).toISOString()

describe('formatDate / formatDateTime', () => {
  it('月・日・時・分は2桁にそろえる', () => {
    const iso = local(2026, 0, 2, 3, 4)
    expect(formatDate(iso)).toBe('2026/01/02')
    expect(formatDateTime(iso)).toBe('2026/01/02 03:04')
  })

  it('2桁の月日時分はそのまま', () => {
    expect(formatDateTime(local(2026, 11, 31, 23, 59))).toBe('2026/12/31 23:59')
  })
})

describe('formatRelativeTime', () => {
  const now = new Date(2026, 9, 2, 12, 0, 0).getTime()
  const ago = (seconds) => new Date(now - seconds * 1000).toISOString()

  it.each([
    [0, 'たった今'],
    [59, 'たった今'],
    [60, '1分前'],
    [3599, '59分前'],
    [3600, '1時間前'],
    [86399, '23時間前'],
  ])('%i秒前 → %s', (seconds, expected) => {
    expect(formatRelativeTime(ago(seconds), now)).toBe(expected)
  })

  it('24時間以上前は日付で表示する', () => {
    expect(formatRelativeTime(ago(86400), now)).toBe('2026/10/01')
  })
})
