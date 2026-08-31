import { GoogleGenAI } from '@google/genai'
import { EMBEDDING_DIMENSIONS } from '@/lib/domain/chunk'
import { type Result, err, ok } from '@/lib/domain/result'
import { withTimeout } from './with-timeout'

export interface Embedder {
  embed(texts: string[]): Promise<Result<number[][]>>
}

const DEFAULT_EMBEDDING_MODEL = 'gemini-embedding-2'

/** 実測で 1 件あたり 0.4〜0.6 秒。32 件でも十分な余裕を見る */
const REQUEST_TIMEOUT_MS = 90_000

const countMismatch = () =>
  err(
    'EMBEDDING_COUNT_MISMATCH',
    '検索用データの作成に失敗しました。もう一度お試しください。',
  )

/**
 * Gemini による埋め込みの作成。
 *
 * ⚠️ contents に文字列の配列を渡してはいけない。
 * SDK が黙って 1 件に統合し、エラーも出ないまま
 * 「全チャンクの埋め込みが 1 つ」という壊れ方をする。
 * 必ず { parts: [{ text }] } の配列で渡し、件数の一致を検証する。
 */
export function createGeminiEmbedder(): Embedder {
  return {
    async embed(texts) {
      if (texts.length === 0) return ok([])

      const apiKey = process.env.GEMINI_API_KEY
      if (!apiKey) {
        return err('AI_NOT_CONFIGURED', 'AI 機能が設定されていません。')
      }

      const ai = new GoogleGenAI({ apiKey })

      try {
        const response = await withTimeout(
          ai.models.embedContent({
            model: process.env.GEMINI_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL,
            contents: texts.map((text) => ({ parts: [{ text }] })),
            config: { outputDimensionality: EMBEDDING_DIMENSIONS },
          }),
          REQUEST_TIMEOUT_MS,
        )

        const embeddings = (response as { embeddings?: { values?: number[] }[] })
          .embeddings
        if (!embeddings) return countMismatch()

        const vectors = embeddings.map((item) => item.values ?? [])

        // 件数がずれると、あるチャンクの本文に別の意味が結び付いてしまう
        if (vectors.length !== texts.length) return countMismatch()
        if (vectors.some((vector) => vector.length !== EMBEDDING_DIMENSIONS)) {
          return countMismatch()
        }

        return ok(vectors)
      } catch {
        return err(
          'AI_REQUEST_FAILED',
          'AI への問い合わせに失敗しました。時間をおいてお試しください。',
        )
      }
    },
  }
}
