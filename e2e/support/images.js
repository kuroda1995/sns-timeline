// テストでアップロードする画像を作る。
// サーバーはファイルの先頭のバイト列で形式を判定し、画面では <img> で表示するため、本物の PNG にする。
import { crc32, deflateSync } from 'node:zlib'

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

/**
 * 単色の PNG を作る
 * @param {{ width?: number, height?: number, rgb?: [number, number, number] }} options
 * @returns {Buffer}
 */
export function createPng({ width = 120, height = 80, rgb = [29, 155, 240] } = {}) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // ビット深度
  header[9] = 2 // カラータイプ: RGB
  // 各行の先頭はフィルターの種類(0 = なし)
  const row = Buffer.alloc(1 + width * 3)
  for (let x = 0; x < width; x++) row.set(rgb, 1 + x * 3)
  const pixels = Buffer.concat(Array.from({ length: height }, () => row))
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const COLORS = [
  [29, 155, 240],
  [249, 24, 128],
  [0, 186, 124],
  [255, 212, 0],
  [120, 86, 255],
]

/**
 * ファイル選択(setFiles)に渡す形の画像
 * @param {number} index 何枚目か(色を変える)
 */
export function pngFile(index = 0) {
  return { name: `e2e-${index + 1}.png`, mimeType: 'image/png', buffer: createPng({ rgb: COLORS[index % COLORS.length] }) }
}

/** 5MB(画像1枚の上限)を超える PNG。画面のチェックで止まるので、中身は先頭だけ PNG にする */
export function oversizedPngFile() {
  const buffer = Buffer.alloc(5 * 1024 * 1024 + 1)
  createPng({ width: 1, height: 1 }).copy(buffer)
  return { name: 'too-large.png', mimeType: 'image/png', buffer }
}

/** 画像ではないファイル */
export function textFile() {
  return { name: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from('これは画像ではありません') }
}
