import { describe, expect, it } from 'vitest'
import {
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
  buildStoragePath,
  detectFileKind,
  getExtension,
  validateUpload,
} from '@/lib/domain/files'

describe('getExtension', () => {
  it('小文字の拡張子を返す', () => {
    expect(getExtension('報告書.DOCX')).toBe('docx')
    expect(getExtension('memo.md')).toBe('md')
  })

  it('複数のドットがある場合は最後の要素を返す', () => {
    expect(getExtension('a.b.pdf')).toBe('pdf')
  })

  it('拡張子がない場合は空文字を返す', () => {
    expect(getExtension('README')).toBe('')
  })
})

describe('detectFileKind', () => {
  it('md は markdown', () => {
    expect(detectFileKind('memo.md')).toBe('markdown')
  })

  it('txt は text', () => {
    expect(detectFileKind('memo.txt')).toBe('text')
  })

  it('それ以外は binary', () => {
    expect(detectFileKind('資料.pdf')).toBe('binary')
    expect(detectFileKind('表.xlsx')).toBe('binary')
  })
})

describe('validateUpload', () => {
  it('対応拡張子かつ上限以内なら受け入れる', () => {
    const result = validateUpload({ name: '資料.pdf', size: 1024 })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.kind).toBe('binary')
  })

  it('非対応の拡張子を拒否する', () => {
    const result = validateUpload({ name: 'script.exe', size: 1024 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('UNSUPPORTED_FILE_TYPE')
  })

  it('上限ちょうどは受け入れる', () => {
    const result = validateUpload({ name: '資料.pdf', size: MAX_FILE_SIZE })
    expect(result.ok).toBe(true)
  })

  it('上限を 1 バイト超えたら拒否する', () => {
    const result = validateUpload({ name: '資料.pdf', size: MAX_FILE_SIZE + 1 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('FILE_TOO_LARGE')
  })

  it('サイズ 0 のファイルを拒否する', () => {
    const result = validateUpload({ name: '資料.pdf', size: 0 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  it('上限は 25MB である', () => {
    expect(MAX_FILE_SIZE).toBe(25 * 1024 * 1024)
  })

  it('対応拡張子は6種類である', () => {
    expect([...ALLOWED_EXTENSIONS].sort()).toEqual([
      'docx',
      'md',
      'pdf',
      'pptx',
      'txt',
      'xlsx',
    ])
  })
})

describe('buildStoragePath', () => {
  it('プロジェクトIDを先頭にした階層パスを組み立てる', () => {
    const path = buildStoragePath({
      projectId: 'proj-1',
      fileId: 'file-1',
      version: 3,
      filename: 'report.pdf',
    })
    expect(path).toBe('proj-1/file-1/3/file-1.pdf')
  })

  it('日本語ファイル名でも ASCII のみのキーを返す', () => {
    // Supabase Storage は非 ASCII のオブジェクトキーを InvalidKey で拒否する
    const path = buildStoragePath({
      projectId: 'proj-1',
      fileId: 'file-1',
      version: 1,
      filename: '仕様書.pdf',
    })
    expect(path).toBe('proj-1/file-1/1/file-1.pdf')
    expect(path).toMatch(/^[A-Za-z0-9/._-]+$/)
  })

  it('パス区切り文字を含む名前を無害化する', () => {
    const path = buildStoragePath({
      projectId: 'proj-1',
      fileId: 'file-1',
      version: 1,
      filename: '../../etc/passwd',
    })
    expect(path).toBe('proj-1/file-1/1/file-1')
  })

  it('複数のドットがあっても最後の拡張子だけを使う', () => {
    const path = buildStoragePath({
      projectId: 'proj-1',
      fileId: 'file-1',
      version: 2,
      filename: '2026.08.30.議事録.docx',
    })
    expect(path).toBe('proj-1/file-1/2/file-1.docx')
  })
})
