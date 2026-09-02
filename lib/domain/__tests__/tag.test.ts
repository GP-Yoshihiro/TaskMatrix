import { describe, expect, it } from 'vitest'
import {
  MAX_TAG_NAME_LENGTH,
  type Tag,
  canDeleteFile,
  describeLockReason,
  normalizeTagName,
  validateTagName,
} from '../tag'

const tag = (name: string, locked = false): Tag => ({ id: name, name, locked })

describe('normalizeTagName', () => {
  it('前後の空白を落とす', () => {
    expect(normalizeTagName('  設計  ')).toBe('設計')
  })

  it('連続する空白を 1 つにまとめる', () => {
    // 「設計  書」と「設計 書」が別のタグとして増えるのを防ぐ
    expect(normalizeTagName('設計   書')).toBe('設計 書')
  })

  it('変える必要が無ければそのまま', () => {
    expect(normalizeTagName('議事録')).toBe('議事録')
  })
})

describe('validateTagName', () => {
  it('普通の名前は通す', () => {
    expect(validateTagName('設計')).toBeNull()
  })

  it('空は拒否する', () => {
    expect(validateTagName('')).toContain('入力')
    expect(validateTagName('   ')).toContain('入力')
  })

  it('長すぎる名前は拒否する', () => {
    expect(validateTagName('あ'.repeat(MAX_TAG_NAME_LENGTH + 1))).toContain('文字以内')
  })

  it('上限ちょうどは通す', () => {
    expect(validateTagName('あ'.repeat(MAX_TAG_NAME_LENGTH))).toBeNull()
  })

  it('空白を含む長さは正規化後で判定する', () => {
    expect(validateTagName(`  ${'あ'.repeat(MAX_TAG_NAME_LENGTH)}  `)).toBeNull()
  })
})

describe('canDeleteFile', () => {
  it('タグが無ければ削除できる', () => {
    expect(canDeleteFile([])).toBe(true)
  })

  it('ロックが無ければ削除できる', () => {
    expect(canDeleteFile([tag('設計'), tag('議事録')])).toBe(true)
  })

  it('ロックが 1 つでもあれば削除できない', () => {
    expect(canDeleteFile([tag('設計'), tag('保存', true)])).toBe(false)
  })

  it('ロックだけでも削除できない', () => {
    expect(canDeleteFile([tag('保存', true)])).toBe(false)
  })
})

describe('describeLockReason', () => {
  it('止めているタグの名前を伝える', () => {
    // どれを外せば消せるのかが分からないと、利用者は詰まる
    expect(describeLockReason([tag('設計'), tag('保存', true)])).toContain('保存')
  })

  it('複数あればすべて挙げる', () => {
    const reason = describeLockReason([tag('保存', true), tag('重要', true)])

    expect(reason).toContain('保存')
    expect(reason).toContain('重要')
  })

  it('ロックが無ければ空', () => {
    expect(describeLockReason([tag('設計')])).toBe('')
  })
})
