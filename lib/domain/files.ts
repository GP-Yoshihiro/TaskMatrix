import { type Result, err, ok } from './result'

/** アップロード可能な最大バイト数（25MB） */
export const MAX_FILE_SIZE = 25 * 1024 * 1024

/** アップロードを許可する拡張子 */
export const ALLOWED_EXTENSIONS = ['xlsx', 'docx', 'pptx', 'pdf', 'txt', 'md'] as const

export type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number]

/** ファイルの扱い方。markdown/text は本文を DB に保持し、binary は Storage に置く */
export type FileKind = 'markdown' | 'text' | 'binary'

export function getExtension(filename: string): string {
  const index = filename.lastIndexOf('.')
  if (index <= 0 || index === filename.length - 1) return ''
  return filename.slice(index + 1).toLowerCase()
}

export function detectFileKind(filename: string): FileKind {
  const extension = getExtension(filename)
  if (extension === 'md') return 'markdown'
  if (extension === 'txt') return 'text'
  return 'binary'
}

export function validateUpload(input: {
  name: string
  size: number
}): Result<{ name: string; kind: FileKind }> {
  const name = input.name.trim()

  if (name.length === 0) {
    return err('VALIDATION_ERROR', 'ファイル名が空です。')
  }

  if (input.size <= 0) {
    return err('VALIDATION_ERROR', '空のファイルはアップロードできません。')
  }

  const extension = getExtension(name)
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(extension)) {
    return err(
      'UNSUPPORTED_FILE_TYPE',
      `対応していない形式です。${ALLOWED_EXTENSIONS.join(' / ')} のいずれかを指定してください。`,
    )
  }

  if (input.size > MAX_FILE_SIZE) {
    return err('FILE_TOO_LARGE', 'ファイルサイズが 25MB を超えています。')
  }

  return ok({ name, kind: detectFileKind(name) })
}

/**
 * Storage 上のオブジェクトキー。
 *
 * - 先頭を projectId にすることで storage.objects のアクセスポリシーが効く
 * - 末尾は `{fileId}.{拡張子}` に固定する。Supabase Storage は非 ASCII のキーを
 *   InvalidKey で拒否するため、日本語ファイル名をそのまま使えない。
 *   表示名は files.name に保持し、ダウンロード時に署名付きURLで復元する。
 */
export function buildStoragePath(input: {
  projectId: string
  fileId: string
  version: number
  filename: string
}): string {
  const basename = input.filename.split(/[/\\]/).pop() ?? ''
  const extension = getExtension(basename)
  const leaf = extension ? `${input.fileId}.${extension}` : input.fileId
  return `${input.projectId}/${input.fileId}/${input.version}/${leaf}`
}
