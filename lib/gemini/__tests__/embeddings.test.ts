import { beforeEach, describe, expect, it, vi } from 'vitest'

/** SDK をモックし、実 API を呼ばずに呼び出しの形を検証する */
const embedContent = vi.fn()

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { embedContent }
  },
}))

const { EMBEDDING_DIMENSIONS } = await import('@/lib/domain/chunk')
const { createGeminiEmbedder } = await import('@/lib/gemini/embeddings')

function vectors(count: number, dimensions = EMBEDDING_DIMENSIONS) {
  return {
    embeddings: Array.from({ length: count }, () => ({
      values: Array.from({ length: dimensions }, () => 0.1),
    })),
  }
}

describe('createGeminiEmbedder', () => {
  beforeEach(() => {
    embedContent.mockReset()
    process.env.GEMINI_API_KEY = 'テスト用'
  })

  it('入力が空なら API を呼ばずに空配列を返す', async () => {
    const result = await createGeminiEmbedder().embed([])
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.vectors).toEqual([])
    expect(embedContent).not.toHaveBeenCalled()
  })

  it('キー未設定なら AI_NOT_CONFIGURED を返す', async () => {
    delete process.env.GEMINI_API_KEY
    const result = await createGeminiEmbedder().embed(['あ'])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('AI_NOT_CONFIGURED')
  })

  it('contents を parts 形式の配列で渡す', async () => {
    // 文字列の配列を渡すと SDK が黙って1件に統合するため、必ず parts 形式にする
    embedContent.mockResolvedValue(vectors(2))
    await createGeminiEmbedder().embed(['一つ目', '二つ目'])

    const call = embedContent.mock.calls[0][0]
    expect(Array.isArray(call.contents)).toBe(true)
    expect(call.contents).toEqual([
      { parts: [{ text: '一つ目' }] },
      { parts: [{ text: '二つ目' }] },
    ])
    // 文字列がそのまま入っていないこと
    expect(call.contents.some((c: unknown) => typeof c === 'string')).toBe(false)
  })

  it('次元数を 768 で指定する', async () => {
    embedContent.mockResolvedValue(vectors(1))
    await createGeminiEmbedder().embed(['あ'])

    expect(embedContent.mock.calls[0][0].config.outputDimensionality).toBe(
      EMBEDDING_DIMENSIONS,
    )
  })

  it('正常時はベクトルの配列を返す', async () => {
    embedContent.mockResolvedValue(vectors(3))
    const result = await createGeminiEmbedder().embed(['a', 'b', 'c'])

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.vectors).toHaveLength(3)
      expect(result.data.vectors[0]).toHaveLength(EMBEDDING_DIMENSIONS)
    }
  })

  it('返却件数が入力より少なければ拒否する', async () => {
    // SDK が黙って統合した場合を検知する
    embedContent.mockResolvedValue(vectors(1))
    const result = await createGeminiEmbedder().embed(['a', 'b', 'c'])

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('EMBEDDING_COUNT_MISMATCH')
  })

  it('返却件数が入力より多くても拒否する', async () => {
    embedContent.mockResolvedValue(vectors(5))
    const result = await createGeminiEmbedder().embed(['a', 'b'])

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('EMBEDDING_COUNT_MISMATCH')
  })

  it('次元数が違えば拒否する', async () => {
    embedContent.mockResolvedValue(vectors(1, 512))
    const result = await createGeminiEmbedder().embed(['a'])

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('EMBEDDING_COUNT_MISMATCH')
  })

  it('embeddings が無い応答を拒否する', async () => {
    embedContent.mockResolvedValue({})
    const result = await createGeminiEmbedder().embed(['a'])
    expect(result.ok).toBe(false)
  })

  it('API が失敗したら AI_REQUEST_FAILED を返す', async () => {
    embedContent.mockRejectedValue(new Error('通信断'))
    const result = await createGeminiEmbedder().embed(['a'])

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('AI_REQUEST_FAILED')
  })
})

describe('createGeminiEmbedder の使用量', () => {
  it('埋め込み API はトークン数を返さないため 0 のままとし、文字数で規模を表す', async () => {
    // 2026-08-31 の実測では応答に embedding しか含まれない。
    // 取れない値を文字数から推定すると、履歴が実測値のように見えてしまう
    embedContent.mockResolvedValue(vectors(2))
    const result = await createGeminiEmbedder().embed(['あいう', 'かきくけこ'])

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.usage.inputTokens).toBe(0)
      expect(result.data.usage.outputTokens).toBe(0)
      expect(result.data.usage.inputChars).toBe(8)
      expect(result.data.usage.model).toBeTruthy()
    }
  })
})
