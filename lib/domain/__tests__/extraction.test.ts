import { describe, expect, it } from 'vitest'
import {
  MAX_EXTRACTION_CHARS,
  SCANNED_PDF_THRESHOLD,
  looksLikeScannedPdf,
  preprocessText,
  validateExtractedText,
} from '@/lib/domain/extraction'

describe('preprocessText', () => {
  it('改行を LF に統一する', () => {
    expect(preprocessText('a\r\nb\rc')).toBe('a\nb\nc')
  })

  it('3 行以上の連続する空行を 2 行に圧縮する', () => {
    expect(preprocessText('a\n\n\n\n\nb')).toBe('a\n\nb')
  })

  it('行末の空白を取り除く', () => {
    expect(preprocessText('a   \nb\t\n')).toBe('a\nb')
  })

  it('全体の前後の空白を取り除く', () => {
    expect(preprocessText('\n\n  本文  \n\n')).toBe('本文')
  })

  it('通常の本文は変えない', () => {
    expect(preprocessText('# 見出し\n\n- 項目')).toBe('# 見出し\n\n- 項目')
  })

  it('officeparser が混ぜる HTML タグを取り除く', () => {
    // docx の表は <div style="text-align: center">**項目**</div> の形で出てくる
    expect(preprocessText('<div style="text-align: center">**項目**</div>')).toBe('**項目**')
  })

  it('Markdown のテーブル記法は残す', () => {
    const table = '| 項目 | 内容 |\n| --- | --- |\n| 見積もり | 来週まで |'
    expect(preprocessText(table)).toBe(table)
  })
})

describe('validateExtractedText', () => {
  it('通常の本文を受け入れる', () => {
    const result = validateExtractedText('タスクの説明が書かれた文章')
    expect(result.ok).toBe(true)
  })

  it('空のテキストを拒否する', () => {
    const result = validateExtractedText('   ')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('TEXT_EXTRACTION_FAILED')
  })

  it('上限ちょうどは受け入れる', () => {
    expect(validateExtractedText('あ'.repeat(MAX_EXTRACTION_CHARS)).ok).toBe(true)
  })

  it('上限を 1 文字超えたら拒否する', () => {
    const result = validateExtractedText('あ'.repeat(MAX_EXTRACTION_CHARS + 1))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('TEXT_TOO_LONG')
  })

  it('上限は 20 万文字である', () => {
    expect(MAX_EXTRACTION_CHARS).toBe(200000)
  })
})

describe('looksLikeScannedPdf', () => {
  it('PDF で抽出テキストが極端に短ければ true', () => {
    expect(looksLikeScannedPdf('a'.repeat(SCANNED_PDF_THRESHOLD - 1), 'pdf')).toBe(true)
  })

  it('しきい値ちょうどなら false', () => {
    expect(looksLikeScannedPdf('a'.repeat(SCANNED_PDF_THRESHOLD), 'pdf')).toBe(false)
  })

  it('PDF 以外は短くても false', () => {
    expect(looksLikeScannedPdf('', 'docx')).toBe(false)
    expect(looksLikeScannedPdf('', 'md')).toBe(false)
  })

  it('大文字の拡張子でも判定する', () => {
    expect(looksLikeScannedPdf('', 'PDF')).toBe(true)
  })

  it('しきい値は 200 文字である', () => {
    expect(SCANNED_PDF_THRESHOLD).toBe(200)
  })
})
