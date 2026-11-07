// 小さな utils(imageUtils・paths・searchUtils・textUtils)のテスト
import { describe, expect, it } from 'vitest'
import { MAX_IMAGE_SIZE, validateImageFile } from './imageUtils.js'
import { followListPath, profilePath } from './paths.js'
import { normalizeKeyword } from './searchUtils.js'
import { countChars, isBlank } from './textUtils.js'

describe('validateImageFile', () => {
  const file = (type, size) => ({ type, size })

  it.each(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])('%s は受け付ける', (type) => {
    expect(validateImageFile(file(type, 100))).toBeNull()
  })

  it.each(['image/svg+xml', 'image/bmp', 'application/pdf', ''])('%s は受け付けない', (type) => {
    expect(validateImageFile(file(type, 100))).toBe('jpg・png・gif・webp の画像を選んでください')
  })

  it('ちょうど5MBまではOK、超えたらエラー', () => {
    expect(validateImageFile(file('image/png', MAX_IMAGE_SIZE))).toBeNull()
    expect(validateImageFile(file('image/png', MAX_IMAGE_SIZE + 1))).toBe('5MB以下の画像を選んでください')
  })
})

describe('paths', () => {
  it('プロフィールとフォロー一覧のURLを作る', () => {
    expect(profilePath('taro')).toBe('/users/taro')
    expect(followListPath('taro', 'following')).toBe('/users/taro/following')
    expect(followListPath('taro', 'followers')).toBe('/users/taro/followers')
  })

  it('URLで特別な意味を持つ文字はエンコードする', () => {
    expect(profilePath('a/b?c')).toBe('/users/a%2Fb%3Fc')
  })
})

describe('normalizeKeyword', () => {
  it('前後の空白を取り除く', () => {
    expect(normalizeKeyword('  taro  ')).toEqual({ query: 'taro', text: 'taro', usernameOnly: false })
  })

  it('先頭の @ はユーザー名だけの検索として扱い、検索する文字からは取り除く', () => {
    expect(normalizeKeyword(' @ taro')).toEqual({ query: '@ taro', text: 'taro', usernameOnly: true })
  })

  it('@ だけ・空白だけなら検索する文字は空', () => {
    expect(normalizeKeyword('@').text).toBe('')
    expect(normalizeKeyword('   ').text).toBe('')
  })
})

describe('countChars', () => {
  it('絵文字も1文字と数える(コードポイント単位)', () => {
    expect(countChars('abc')).toBe(3)
    expect(countChars('👍')).toBe(1)
    expect('👍'.length).toBe(2)
    expect(countChars('あ👍い')).toBe(3)
  })
})

describe('isBlank', () => {
  it.each(['', '   ', '\n\t '])('空白・改行だけなら空とみなす: %j', (text) => {
    expect(isBlank(text)).toBe(true)
  })

  it('文字があれば空ではない', () => {
    expect(isBlank(' a ')).toBe(false)
  })
})
