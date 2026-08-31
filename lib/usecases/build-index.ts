import { splitIntoChunks, validateChunkCount } from '@/lib/domain/chunk'
import { preprocessText } from '@/lib/domain/extraction'
import { type Result, err, ok } from '@/lib/domain/result'
import { EMPTY_USAGE, type AiUsage } from '@/lib/domain/usage'
import type { TextExtractor } from '@/lib/extraction/text'
import type { Embedder } from '@/lib/gemini/embeddings'
import type { ChunkInput, FileChunkRepository } from '@/lib/repositories/file-chunks'
import type { FileVersionRepository } from '@/lib/repositories/file-versions'
import type { FileRepository } from '@/lib/repositories/files'

/** 1 回の埋め込み呼び出しに渡す最大件数 */
const EMBED_BATCH_SIZE = 32

type Deps = {
  files: FileRepository
  versions: FileVersionRepository
  chunks: FileChunkRepository
  embedder: Embedder
  textExtractor: TextExtractor
  downloadBinary: (storagePath: string) => Promise<Uint8Array>
}

/**
 * プロジェクト内のファイルから検索用データ（チャンクと埋め込み）を作る。
 *
 * 同じファイルの古いチャンクは先に消す。
 * 残すと、更新前の記述を根拠に回答してしまう。
 */
export async function buildIndexForProject(
  deps: Deps,
  input: { projectId: string },
): Promise<Result<{ files: number; chunks: number; usage: AiUsage }>> {
  const files = await deps.files.listByProject(input.projectId)

  // 先に全ファイルの本文を集めてチャンク化する。
  // 上限を超えるなら埋め込みを 1 回も呼ばずに止めたいため。
  const pending: { fileId: string; fileVersion: number; chunks: string[] }[] = []

  for (const file of files) {
    let rawText = ''

    if (file.kind === 'binary') {
      if (!file.storagePath) continue
      const buffer = await deps.downloadBinary(file.storagePath)
      rawText = await deps.textExtractor.extract({ buffer, filename: file.name })
    } else {
      const version = await deps.versions.findByVersion(file.id, file.currentVersion)
      rawText = version?.content ?? ''
    }

    const chunks = splitIntoChunks(preprocessText(rawText))
    if (chunks.length === 0) continue

    pending.push({ fileId: file.id, fileVersion: file.currentVersion, chunks })
  }

  const total = pending.reduce((sum, item) => sum + item.chunks.length, 0)

  const validated = validateChunkCount(total)
  if (!validated.ok) return validated

  // 古いチャンクを消してから入れ直す
  const rows: { id: string; content: string }[] = []

  for (const item of pending) {
    await deps.chunks.deleteByFile(item.fileId)

    const inputs: ChunkInput[] = item.chunks.map((content, chunkIndex) => ({
      projectId: input.projectId,
      fileId: item.fileId,
      fileVersion: item.fileVersion,
      chunkIndex,
      content,
    }))

    const inserted = await deps.chunks.insertMany(inputs)
    inserted.forEach((row, index) => {
      rows.push({ id: row.id, content: inputs[index].content })
    })
  }

  // 埋め込みは件数を区切って作る
  let usage: AiUsage = EMPTY_USAGE

  for (let start = 0; start < rows.length; start += EMBED_BATCH_SIZE) {
    const batch = rows.slice(start, start + EMBED_BATCH_SIZE)
    const embedded = await deps.embedder.embed(batch.map((row) => row.content))
    if (!embedded.ok) return embedded

    // 複数回に分けても、利用者から見れば 1 回の処理。文字数を積み上げる
    usage = {
      ...embedded.data.usage,
      inputChars: usage.inputChars + embedded.data.usage.inputChars,
    }

    for (const [index, vector] of embedded.data.vectors.entries()) {
      await deps.chunks.updateEmbedding(batch[index].id, vector)
    }
  }

  return ok({ files: pending.length, chunks: rows.length, usage })
}
