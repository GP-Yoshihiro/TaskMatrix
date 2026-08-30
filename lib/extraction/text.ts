import { type SupportedFileType, parseOffice } from 'officeparser'
import { ALLOWED_EXTENSIONS, getExtension } from '@/lib/domain/files'

/** officeparser に渡せる形式かどうかを判定する */
function toSupportedFileType(extension: string): SupportedFileType | undefined {
  const supported = (ALLOWED_EXTENSIONS as readonly string[]).includes(extension)
  return supported ? (extension as SupportedFileType) : undefined
}

/**
 * バイナリファイルからテキストを取り出す。
 * 実装を差し替えられるようインターフェースを切り、テストではモックする。
 */
export interface TextExtractor {
  extract(input: { buffer: Uint8Array; filename: string }): Promise<string>
}

/**
 * officeparser v7 による実装。
 *
 * AST の `to('md')` は表を Markdown テーブルとして保持するため、
 * セルが1行ずつに分解される `toText()` より LLM への入力として適している。
 * Markdown 化に失敗した場合のみ `toText()` に退避する。
 */
export function createOfficeParserExtractor(): TextExtractor {
  return {
    async extract({ buffer, filename }) {
      const fileType = toSupportedFileType(getExtension(filename))
      const ast = await parseOffice(Buffer.from(buffer), fileType ? { fileType } : {})

      try {
        const markdown = await ast.to('md')
        const value = typeof markdown === 'string' ? markdown : (markdown?.value ?? '')
        if (value.trim().length > 0) return value
      } catch {
        // Markdown 化に失敗したらプレーンテキストで取り出す
      }

      return await ast.toText()
    },
  }
}
