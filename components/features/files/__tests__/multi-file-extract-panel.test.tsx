import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MultiFileExtractPanel } from '@/components/features/files/multi-file-extract-panel'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}))

const extract = vi.fn()
const register = vi.fn()

vi.mock('@/lib/actions/extraction', () => ({
  extractTasksFromFilesAction: (...args: unknown[]) => extract(...args),
  registerTasksAction: (...args: unknown[]) => register(...args),
}))

const FILES = [
  { id: 'f1', name: '議事録.docx' },
  { id: 'f2', name: '要件.xlsx' },
]

function suggestion(overrides: Record<string, unknown> = {}) {
  return {
    key: 'f1-0',
    title: '見積もりを提出する',
    description: '',
    priority: 'medium' as const,
    assignee: '',
    dueDate: null,
    ambiguityNote: '',
    aiSuggestion: '',
    estimatedDays: null,
    estimateSource: '' as const,
    sourceFileName: '議事録.docx',
    mergedCount: 1,
    mergedFrom: ['議事録.docx'],
    mergedKeys: ['f1-0'],
    ...overrides,
  }
}

beforeEach(() => {
  extract.mockReset()
  register.mockReset().mockResolvedValue({ ok: true, data: 1 })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

function setup(selected: string[] = []) {
  const onToggleAll = vi.fn()
  const onDone = vi.fn()

  render(
    <MultiFileExtractPanel
      projectId="p1"
      files={FILES}
      selected={new Set(selected)}
      onToggleAll={onToggleAll}
      onDone={onDone}
    />,
  )

  return { user: userEvent.setup(), onToggleAll, onDone }
}

describe('MultiFileExtractPanel', () => {
  it('選ぶ前は抽出を押せない', () => {
    setup()
    expect(screen.getByRole('button', { name: '選んだ資料からタスク抽出' })).toBeDisabled()
  })

  it('AI の呼び出し回数を、押す前に伝える', () => {
    // 1 日の上限に算入されるため、押す前に分かるようにする
    setup()
    expect(screen.getByText(/資料の数 ＋ 1 回/)).toBeInTheDocument()
  })

  it('外部へ送信することを、押す前に伝える', () => {
    setup()
    expect(screen.getByText(/Google Gemini API に送信されます/)).toBeInTheDocument()
  })

  it('選んだ資料だけを対象にする', async () => {
    extract.mockResolvedValue({ ok: true, data: { suggestions: [], failures: [], mergedGroupCount: 0 } })
    const { user } = setup(['f2'])

    await user.click(screen.getByRole('button', { name: '選んだ資料からタスク抽出' }))

    const formData = extract.mock.calls[0][0] as FormData
    expect(JSON.parse(String(formData.get('fileIds')))).toEqual(['f2'])
  })

  it('まとめた件数を示す', async () => {
    extract.mockResolvedValue({
      ok: true,
      data: {
        suggestions: [suggestion({ mergedCount: 2, mergedFrom: ['議事録.docx', '要件.xlsx'] })],
        failures: [],
        mergedGroupCount: 1,
      },
    })
    const { user } = setup(['f1', 'f2'])

    await user.click(screen.getByRole('button', { name: '選んだ資料からタスク抽出' }))

    expect(await screen.findByText(/2 件をまとめました/)).toBeInTheDocument()
  })

  it('まとめたときは、確認を促す', async () => {
    // 重複の判定は AI。別の作業がまとめられる危険を伝える
    extract.mockResolvedValue({
      ok: true,
      data: { suggestions: [suggestion({ mergedCount: 2 })], failures: [], mergedGroupCount: 1 },
    })
    const { user } = setup(['f1', 'f2'])

    await user.click(screen.getByRole('button', { name: '選んだ資料からタスク抽出' }))

    expect(
      await screen.findByText(/別の作業がまとめられていないか/),
    ).toBeInTheDocument()
  })

  it('抽出しただけでは登録しない', async () => {
    extract.mockResolvedValue({
      ok: true,
      data: { suggestions: [suggestion()], failures: [], mergedGroupCount: 0 },
    })
    const { user } = setup(['f1'])

    await user.click(screen.getByRole('button', { name: '選んだ資料からタスク抽出' }))
    await screen.findByText(/見積もりを提出する/)

    expect(register).not.toHaveBeenCalled()
  })

  it('確かめてから登録できる', async () => {
    extract.mockResolvedValue({
      ok: true,
      data: { suggestions: [suggestion()], failures: [], mergedGroupCount: 0 },
    })
    const { user } = setup(['f1'])

    await user.click(screen.getByRole('button', { name: '選んだ資料からタスク抽出' }))
    await user.click(await screen.findByRole('button', { name: 'この内容で登録する' }))

    expect(register).toHaveBeenCalledOnce()
  })

  it('読み取れなかった資料を知らせる', async () => {
    // 1 つ失敗しても残りは続ける。どれが駄目だったかは伝える
    extract.mockResolvedValue({
      ok: true,
      data: {
        suggestions: [suggestion()],
        failures: [{ fileName: '要件.xlsx', message: '本文を取り出せませんでした。' }],
        mergedGroupCount: 0,
      },
    })
    const { user } = setup(['f1', 'f2'])

    await user.click(screen.getByRole('button', { name: '選んだ資料からタスク抽出' }))

    expect(await screen.findByText(/要件.xlsx/)).toBeInTheDocument()
  })
})
