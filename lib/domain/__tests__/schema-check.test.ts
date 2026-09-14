import { describe, expect, it } from 'vitest'
import {
  EXPECTED_SCHEMA,
  missingColumnsFrom,
  summarizeSchemaChecks,
} from '../schema-check'

describe('EXPECTED_SCHEMA', () => {
  it('移行 SQL で足した表と列を並べている', () => {
    const tables = EXPECTED_SCHEMA.map((item) => item.table)
    expect(tables).toContain('tasks')
    expect(tables).toContain('project_members')
    expect(tables).toContain('invitations')
  })

  it('適用漏れが起きた列を含んでいる', () => {
    // 0017 と 0018 の列。二度とも見落としたため、ここで必ず見えるようにする
    const tasks = EXPECTED_SCHEMA.find((item) => item.table === 'tasks')
    expect(tasks?.columns).toContain('assignee_member_id')
    expect(tasks?.columns).toContain('estimated_days')
    expect(tasks?.columns).toContain('estimate_source')
  })
})

describe('missingColumnsFrom', () => {
  it('存在しない列の名前を取り出す', () => {
    const message = `column tasks.estimated_days does not exist`
    expect(missingColumnsFrom(message, ['estimated_days', 'title'])).toEqual([
      'estimated_days',
    ])
  })

  it('関係の見つからない結合も拾う', () => {
    // PostgREST は結合が引けないとき、別の言い回しで返す
    const message = `Could not find a relationship between 'tasks' and 'project_members'`
    expect(missingColumnsFrom(message, ['project_members(name)'])).toEqual([
      'project_members(name)',
    ])
  })

  it('当てはまらなければ空', () => {
    expect(missingColumnsFrom('permission denied', ['title'])).toEqual([])
  })

  it('空のメッセージでも壊れない', () => {
    expect(missingColumnsFrom('', ['title'])).toEqual([])
  })
})

describe('summarizeSchemaChecks', () => {
  it('すべて揃っていれば ok', () => {
    const result = summarizeSchemaChecks([
      { table: 'tasks', ok: true, missing: [] },
      { table: 'sections', ok: true, missing: [] },
    ])
    expect(result.ok).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('足りない表と列をまとめて返す', () => {
    const result = summarizeSchemaChecks([
      { table: 'tasks', ok: false, missing: ['estimated_days'] },
      { table: 'sections', ok: true, missing: [] },
    ])
    expect(result.ok).toBe(false)
    expect(result.missing).toEqual(['tasks.estimated_days'])
  })

  it('原因が分からない失敗も、見落とさずに残す', () => {
    // 「調べられなかった」を「問題なし」と見せない
    const result = summarizeSchemaChecks([
      { table: 'tasks', ok: false, missing: [] },
    ])
    expect(result.ok).toBe(false)
    expect(result.missing).toEqual(['tasks（原因不明）'])
  })
})
