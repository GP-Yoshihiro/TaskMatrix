import { normalizeLineEndings } from './files'
import { type Result, err, ok } from './result'

/** Gemini へ送るテキストの最大文字数 */
export const MAX_EXTRACTION_CHARS = 200000

/** これ未満の抽出結果はスキャン PDF とみなす文字数 */
export const SCANNED_PDF_THRESHOLD = 200

/**
 * 抽出したテキストを整える。
 * 無駄な空白と空行を削ってトークン消費を抑える。
 * officeparser は docx の表に <div style="..."> を混ぜてくるため、
 * Markdown の意味を持たない HTML タグを取り除く。
 */
export function preprocessText(text: string): string {
  return normalizeLineEndings(text)
    .replace(/<\/?(?:div|span|p|br|font)\b[^>]*>/gi, '')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function validateExtractedText(text: string): Result<string> {
  const trimmed = text.trim()

  if (trimmed.length === 0) {
    return err('TEXT_EXTRACTION_FAILED', 'ファイルからテキストを取り出せませんでした。')
  }

  if (trimmed.length > MAX_EXTRACTION_CHARS) {
    return err('TEXT_TOO_LONG', 'ドキュメントが大きすぎます。分割してお試しください。')
  }

  return ok(trimmed)
}

/**
 * 画像だけの PDF かどうかを判定する。
 * true の場合はテキストではなく PDF 本体を Gemini に送る。
 */
export function looksLikeScannedPdf(text: string, extension: string): boolean {
  if (extension.toLowerCase() !== 'pdf') return false
  return text.trim().length < SCANNED_PDF_THRESHOLD
}
