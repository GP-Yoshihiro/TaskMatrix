import { type Result, err, ok } from './result'

/** 1 チャンクの最大文字数。日本語で段落 2〜3 個分 */
export const CHUNK_SIZE = 800

/** 隣り合うチャンクの重なり。境界で意味が切れるのを防ぐ */
export const CHUNK_OVERLAP = 100

/** 1 プロジェクトあたりのチャンク数の上限 */
export const MAX_CHUNKS_PER_PROJECT = 300

/** 埋め込みベクトルの次元数。DB の vector(768) と一致させること */
export const EMBEDDING_DIMENSIONS = 768

/**
 * 上限を超える塊を、意味の切れ目を優先して細かくする。
 * 段落 → 改行 → 句点 → 強制切断 の順に試す。
 */
function splitOversized(text: string): string[] {
  if (text.length <= CHUNK_SIZE) return [text]

  for (const separator of ['\n\n', '\n', '。']) {
    // 区切り文字を残したまま分割する
    const parts = text
      .split(separator)
      .map((part, index, all) => (index === all.length - 1 ? part : part + separator))
      .filter((part) => part.length > 0)

    // 分割できていて、かつどれも短くなっているなら採用する
    if (parts.length > 1 && parts.every((part) => part.length < text.length)) {
      return parts.flatMap(splitOversized)
    }
  }

  // どの区切りでも割れない場合は文字数で切る。必ず 1 文字以上進める
  const pieces: string[] = []
  for (let index = 0; index < text.length; index += CHUNK_SIZE) {
    pieces.push(text.slice(index, index + CHUNK_SIZE))
  }
  return pieces
}

/**
 * 本文を検索しやすい大きさに分割する。
 *
 * 意味の切れ目を優先し、隣り合うチャンクを少し重ねる。
 * 重ねるのは、境界にまたがる記述が検索から漏れるのを防ぐため。
 */
export function splitIntoChunks(text: string): string[] {
  const normalized = text.trim()
  if (normalized.length === 0) return []

  const pieces = splitOversized(normalized)

  const chunks: string[] = []
  let current = ''

  for (const piece of pieces) {
    if (current.length === 0) {
      current = piece
      continue
    }

    if (current.length + piece.length <= CHUNK_SIZE) {
      current += piece
      continue
    }

    chunks.push(current)
    // 直前の末尾を引き継いで文脈を保つ。ただし上限は超えない
    const overlap = current.slice(-CHUNK_OVERLAP)
    current =
      overlap.length + piece.length <= CHUNK_SIZE ? overlap + piece : piece
  }

  if (current.length > 0) chunks.push(current)

  return chunks.map((chunk) => chunk.trim()).filter((chunk) => chunk.length > 0)
}

export function validateChunkCount(count: number): Result<number> {
  if (count <= 0) {
    return err(
      'NO_INDEXED_CONTENT',
      '検索用データがありません。先に作成してください。',
    )
  }

  if (count > MAX_CHUNKS_PER_PROJECT) {
    return err(
      'TOO_MANY_CHUNKS',
      'ファイルが多すぎます。対象を絞ってからお試しください。',
    )
  }

  return ok(count)
}
