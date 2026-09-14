import { describe, expect, it } from 'vitest'
import { AI_USAGE_PATHS, pathsToRefresh } from '../revalidate-targets'

const PROJECT = 'p1'

describe('pathsToRefresh', () => {
  it('タスクの更新は、予定にも反映する', () => {
    // ガントチャートは担当と想定日程を使う。片方だけ新しいと食い違う
    const paths = pathsToRefresh('task', PROJECT)
    expect(paths).toContain('/projects/p1/tasks')
    expect(paths).toContain('/projects/p1/schedule')
  })

  it('ファイルの更新は、変更履歴にも反映する', () => {
    // 記録はされるのに履歴画面に出てこない、という食い違いを防ぐ
    const paths = pathsToRefresh('file', PROJECT)
    expect(paths).toContain('/projects/p1')
    expect(paths).toContain('/projects/p1/history')
  })

  it('予定の更新は、予定とホームに反映する', () => {
    const paths = pathsToRefresh('schedule', PROJECT)
    expect(paths).toContain('/projects/p1/schedule')
    expect(paths).toContain('/dashboard')
  })

  it('メンバーの更新は、タスクと予定にも反映する', () => {
    const paths = pathsToRefresh('member', PROJECT)
    expect(paths).toContain('/projects/p1/members')
    expect(paths).toContain('/projects/p1/tasks')
    expect(paths).toContain('/projects/p1/schedule')
  })

  it('同じ経路を重ねて返さない', () => {
    const paths = pathsToRefresh('task', PROJECT)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('プロジェクトが分かれば、その経路だけを返す', () => {
    // 他のプロジェクトまで作り直すのは無駄
    expect(pathsToRefresh('task', PROJECT).every((path) => !path.includes('p2'))).toBe(true)
  })
})

describe('AI_USAGE_PATHS', () => {
  it('使用量の画面を含む', () => {
    // AI を使ったのに残量が減らないように見えるのを防ぐ
    expect(AI_USAGE_PATHS).toContain('/settings/usage')
  })

  it('上限の知らせを出すホームも含む', () => {
    expect(AI_USAGE_PATHS).toContain('/dashboard')
  })
})
