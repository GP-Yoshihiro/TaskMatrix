import { describe, expect, it } from 'vitest'
import { matchTaskTitle, stripSplitMarker } from '../match-task-title'

const TITLES = ['見積もりを提出する', '基礎工事を行う']

describe('stripSplitMarker', () => {
  it('日ごとの分割を表す印を落とす', () => {
    // 「複数の日に分けて」と指示すると、AI は名前に印を足すことがある
    expect(stripSplitMarker('基礎工事を行う（1日目）')).toBe('基礎工事を行う')
    expect(stripSplitMarker('基礎工事を行う（2/3）')).toBe('基礎工事を行う')
  })

  it('半角の括弧も落とす', () => {
    expect(stripSplitMarker('基礎工事を行う(1日目)')).toBe('基礎工事を行う')
  })

  it('末尾以外の括弧は残す', () => {
    // 「（仮）見積もり」の括弧は名前の一部
    expect(stripSplitMarker('（仮）見積もりを出す')).toBe('（仮）見積もりを出す')
  })

  it('印が無ければそのまま', () => {
    expect(stripSplitMarker('見積もりを提出する')).toBe('見積もりを提出する')
  })

  it('中身のある括弧は落とさない', () => {
    // 「（田中担当）」のような補足は、別のタスクかもしれない
    expect(stripSplitMarker('見積もりを出す（田中担当）')).toBe('見積もりを出す（田中担当）')
  })
})

describe('matchTaskTitle', () => {
  it('完全に一致すれば、それを返す', () => {
    expect(matchTaskTitle('見積もりを提出する', TITLES)).toBe('見積もりを提出する')
  })

  it('前後の空白の違いは無視する', () => {
    expect(matchTaskTitle('  見積もりを提出する ', TITLES)).toBe('見積もりを提出する')
  })

  it('全角と半角の空白の違いは無視する', () => {
    expect(matchTaskTitle('基礎工事を 行う', ['基礎工事を　行う'])).toBe('基礎工事を　行う')
  })

  it('分割の印が付いていても、元の名前に結び付ける', () => {
    // これを落とすと、分割された予定がすべて消える
    expect(matchTaskTitle('基礎工事を行う（1日目）', TITLES)).toBe('基礎工事を行う')
  })

  it('当てはまるものが無ければ null', () => {
    expect(matchTaskTitle('まったく別の作業', TITLES)).toBeNull()
  })

  it('空文字は null', () => {
    expect(matchTaskTitle('', TITLES)).toBeNull()
  })

  it('候補が無ければ null', () => {
    expect(matchTaskTitle('見積もりを提出する', [])).toBeNull()
  })
})
