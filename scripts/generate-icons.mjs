/**
 * PWA 用のアイコンを生成する。
 *
 * 外部ライブラリを使わず、Node 標準の zlib だけで PNG を書き出す。
 * 単色背景に白い格子（プロジェクト名の Matrix に対応）を描くだけなので、
 * 画像ライブラリを持ち込むより自前で書いた方が依存が増えない。
 *
 * 色は既存のデザイントークン（Apple テーマのアクセント）に合わせている。
 * 差し替えたい場合は BACKGROUND を変えるか、生成した PNG を直接置き換える。
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(HERE, '..', 'public', 'icons')

const BACKGROUND = [0x00, 0x71, 0xe3] // #0071e3
const FOREGROUND = [0xff, 0xff, 0xff]

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

/** RGB のピクセル配列から PNG のバイト列を組み立てる */
function encodePng(size, pixels) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // ビット深度
  ihdr[9] = 2 // カラータイプ: トゥルーカラー
  ihdr[10] = 0 // 圧縮方式
  ihdr[11] = 0 // フィルタ方式
  ihdr[12] = 0 // インターレースなし

  // 各行の先頭にフィルタタイプ 0 を付ける
  const raw = Buffer.alloc(size * (size * 3 + 1))
  let offset = 0
  for (let y = 0; y < size; y++) {
    raw[offset++] = 0
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixels[y][x]
      raw[offset++] = r
      raw[offset++] = g
      raw[offset++] = b
    }
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/**
 * 3×3 の格子を描く。
 * inset は図形を収める割合。マスカブル用は 0.8（安全領域）にする。
 */
function drawMatrix(size, inset) {
  const pixels = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => BACKGROUND),
  )

  const area = Math.round(size * inset)
  const origin = Math.round((size - area) / 2)
  const gap = Math.max(1, Math.round(area * 0.08))
  const cell = Math.floor((area - gap * 2) / 3)

  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < 3; column++) {
      // 右下のセルだけ抜いて、単なる格子に見えないようにする
      if (row === 2 && column === 2) continue

      const left = origin + column * (cell + gap)
      const top = origin + row * (cell + gap)

      for (let y = top; y < top + cell && y < size; y++) {
        for (let x = left; x < left + cell && x < size; x++) {
          if (y >= 0 && x >= 0) pixels[y][x] = FOREGROUND
        }
      }
    }
  }

  return pixels
}

const targets = [
  { file: 'icon-192.png', size: 192, inset: 0.62 },
  { file: 'icon-512.png', size: 512, inset: 0.62 },
  { file: 'icon-maskable.png', size: 512, inset: 0.5 },
  { file: 'apple-touch-icon.png', size: 180, inset: 0.62 },
]

mkdirSync(OUT_DIR, { recursive: true })

for (const target of targets) {
  const png = encodePng(target.size, drawMatrix(target.size, target.inset))
  writeFileSync(join(OUT_DIR, target.file), png)
  console.log(`生成: ${target.file} (${target.size}x${target.size}, ${png.length} bytes)`)
}
