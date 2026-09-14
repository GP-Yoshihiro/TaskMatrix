import { describe, expect, it } from 'vitest'
import {
  MAX_NAME_LENGTH,
  UNASSIGNED_SECTION,
  isDuplicateName,
  normalizeName,
  primarySectionOf,
  validateName,
} from '../member'

describe('normalizeName', () => {
  it('前後の空白を落とす', () => {
    expect(normalizeName('  田中  ')).toBe('田中')
  })

  it('間の連続した空白は 1 つにまとめる', () => {
    // 「田中　太郎」と「田中  太郎」を別人にしない
    expect(normalizeName('田中   太郎')).toBe('田中 太郎')
  })

  it('全角の空白も空白として扱う', () => {
    expect(normalizeName('田中　太郎')).toBe('田中 太郎')
  })

  it('空文字はそのまま空文字', () => {
    expect(normalizeName('   ')).toBe('')
  })
})

describe('validateName', () => {
  it('通常の名前は通す', () => {
    expect(validateName('田中')).toBeNull()
  })

  it('空欄は通さない', () => {
    expect(validateName('')).toContain('入力')
    expect(validateName('   ')).toContain('入力')
  })

  it('長すぎる名前は通さない', () => {
    // 画面の欄からあふれ、並べ替えの見出しが読めなくなる
    expect(validateName('あ'.repeat(MAX_NAME_LENGTH + 1))).toContain('文字')
  })

  it('上限ちょうどは通す', () => {
    expect(validateName('あ'.repeat(MAX_NAME_LENGTH))).toBeNull()
  })
})

describe('isDuplicateName', () => {
  const existing = [
    { id: 'a', name: '田中' },
    { id: 'b', name: '鈴木' },
  ]

  it('同じ名前があれば重複とする', () => {
    expect(isDuplicateName('田中', existing)).toBe(true)
  })

  it('空白の入り方が違うだけなら重複とする', () => {
    // 見た目が同じ人を別人として登録させない
    expect(isDuplicateName('  田中 ', existing)).toBe(true)
  })

  it('無い名前は重複でない', () => {
    expect(isDuplicateName('佐藤', existing)).toBe(false)
  })

  it('自分自身は重複に数えない', () => {
    // 改名しないまま保存したときに弾かれてしまう
    expect(isDuplicateName('田中', existing, 'a')).toBe(false)
  })

  it('他人と同じ名前への改名は重複とする', () => {
    expect(isDuplicateName('鈴木', existing, 'a')).toBe(true)
  })
})

describe('primarySectionOf', () => {
  const sections = [
    { id: 's1', name: '基礎班' },
    { id: 's2', name: '内装班' },
  ]

  it('所属が 1 つならそれを返す', () => {
    expect(primarySectionOf([sections[0]])?.name).toBe('基礎班')
  })

  it('複属なら最初の所属を返す', () => {
    // 全ての見出しに出すと件数が二重に数えられる。既定は 1 か所のみ
    expect(primarySectionOf(sections)?.name).toBe('基礎班')
  })

  it('所属が無ければ未設定を返す', () => {
    expect(primarySectionOf([])?.name).toBe(UNASSIGNED_SECTION)
  })
})
