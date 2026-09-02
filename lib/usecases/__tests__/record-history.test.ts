import { describe, expect, it, vi } from 'vitest'
import { MAX_STORED_CHANGES } from '@/lib/domain/history'
import type { HistoryRepository, RecordHistoryInput } from '@/lib/repositories/history'
import { recordHistory } from '../record-history'

function createRepository(overrides: Partial<HistoryRepository> = {}) {
  const recorded: RecordHistoryInput[] = []

  const repository: HistoryRepository = {
    record: async (input) => {
      recorded.push(input)
    },
    listByProject: async () => [],
    countByProject: async () => 0,
    ...overrides,
  }

  return { repository, recorded }
}

const base = {
  projectId: 'p1',
  fileId: 'f1',
  fileName: '要件メモ.md',
  fileKind: 'markdown',
  version: 2,
  authorId: 'u1',
  authorName: '山田',
}

describe('recordHistory', () => {
  it('変更箇所と件数を記録する', async () => {
    const { repository, recorded } = createRepository()

    await recordHistory(repository, {
      ...base,
      action: 'updated',
      before: 'あ\nい',
      after: 'あ\nい\nう',
    })

    expect(recorded).toHaveLength(1)
    expect(recorded[0]).toMatchObject({
      projectId: 'p1',
      fileId: 'f1',
      fileName: '要件メモ.md',
      action: 'updated',
      version: 2,
      addedCount: 1,
      removedCount: 0,
      authorName: '山田',
    })
  })

  it('拡張子を取り出して記録する', async () => {
    const { repository, recorded } = createRepository()

    await recordHistory(repository, {
      ...base,
      fileName: '見積.xlsx',
      action: 'created',
      before: '',
      after: '本文',
    })

    expect(recorded[0].fileExtension).toBe('xlsx')
  })

  it('新規作成はすべて追加として記録する', async () => {
    const { repository, recorded } = createRepository()

    await recordHistory(repository, {
      ...base,
      action: 'created',
      before: '',
      after: 'あ\nい',
    })

    expect(recorded[0].addedCount).toBe(2)
    expect(recorded[0].removedCount).toBe(0)
  })

  it('削除はすべて削除として記録する', async () => {
    const { repository, recorded } = createRepository()

    await recordHistory(repository, {
      ...base,
      action: 'deleted',
      before: 'あ\nい',
      after: '',
    })

    expect(recorded[0].action).toBe('deleted')
    expect(recorded[0].removedCount).toBe(2)
  })

  it('変更が多すぎるときは打ち切った印を付ける', async () => {
    const { repository, recorded } = createRepository()
    const big = Array.from({ length: MAX_STORED_CHANGES + 10 }, (_, i) => `行${i}`).join(
      '\n',
    )

    await recordHistory(repository, {
      ...base,
      action: 'updated',
      before: '',
      after: big,
    })

    expect(recorded[0].truncated).toBe(true)
    expect(recorded[0].changes).toHaveLength(MAX_STORED_CHANGES)
    // 件数は打ち切らない
    expect(recorded[0].addedCount).toBe(MAX_STORED_CHANGES + 10)
  })

  it('記録に失敗しても例外を投げない', async () => {
    // 履歴が残せないことを理由に、保存や削除が失敗してはならない
    const { repository } = createRepository({
      record: async () => {
        throw new Error('history_entries への書き込みに失敗')
      },
    })

    await expect(
      recordHistory(repository, {
        ...base,
        action: 'updated',
        before: 'あ',
        after: 'い',
      }),
    ).resolves.toBeUndefined()
  })

  it('記録は 1 度だけ行う', async () => {
    const record = vi.fn(async () => {})
    const { repository } = createRepository({ record })

    await recordHistory(repository, {
      ...base,
      action: 'updated',
      before: 'あ',
      after: 'い',
    })

    expect(record).toHaveBeenCalledTimes(1)
  })
})
