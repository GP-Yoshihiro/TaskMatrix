import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemberManager } from '@/components/features/members/member-manager'
import type { ProjectMember, Section } from '@/lib/repositories/members'

// 画面の更新要求は、テストでは行き先が無いので受け止めるだけにする
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}))

const addMember = vi.fn()
const toggleSection = vi.fn()
const removeMember = vi.fn()

vi.mock('@/lib/actions/members', () => ({
  addMemberAction: (...args: unknown[]) => addMember(...args),
  addSectionAction: vi.fn(async () => ({ ok: true, data: null })),
  removeMemberAction: (...args: unknown[]) => removeMember(...args),
  removeSectionAction: vi.fn(async () => ({ ok: true, data: null })),
  renameMemberAction: vi.fn(async () => ({ ok: true, data: null })),
  renameSectionAction: vi.fn(async () => ({ ok: true, data: null })),
  toggleSectionAction: (...args: unknown[]) => toggleSection(...args),
}))

const SECTIONS: Section[] = [
  { id: 's1', name: '基礎班', position: 0 },
  { id: 's2', name: '内装班', position: 1 },
]

const MEMBERS: ProjectMember[] = [
  { id: 'm1', name: '田中', sections: [SECTIONS[0], SECTIONS[1]] },
  { id: 'm2', name: '鈴木', sections: [] },
]

beforeEach(() => {
  addMember.mockReset().mockResolvedValue({ ok: true, data: null })
  toggleSection.mockReset().mockResolvedValue({ ok: true, data: null })
  removeMember.mockReset().mockResolvedValue({ ok: true, data: null })
})

function setup() {
  return {
    user: userEvent.setup(),
    ...render(<MemberManager projectId="p1" members={MEMBERS} sections={SECTIONS} />),
  }
}

describe('MemberManager', () => {
  it('メンバーとセクションを並べる', () => {
    setup()

    expect(screen.getByText('田中')).toBeInTheDocument()
    expect(screen.getByText('鈴木')).toBeInTheDocument()
    expect(screen.getAllByText('基礎班').length).toBeGreaterThan(0)
  })

  it('複属しているメンバーは、所属を並べて示す', () => {
    setup()

    expect(screen.getByText('基礎班・内装班')).toBeInTheDocument()
  })

  it('所属が無いメンバーは未設定と示す', () => {
    setup()

    expect(screen.getByText('未設定')).toBeInTheDocument()
  })

  it('所属している欄は、押された状態で示す', () => {
    setup()

    // どのセクションに属しているかを、押す前に見て分かるようにする
    const buttons = screen.getAllByRole('button', { name: '基礎班' })
    expect(buttons.some((button) => button.getAttribute('aria-pressed') === 'true')).toBe(true)
  })

  it('名前が空のうちは追加できない', () => {
    setup()

    // 空欄のまま押させると、必ず失敗する操作を誘う
    const addButtons = screen.getAllByRole('button', { name: '追加' })
    expect(addButtons.every((button) => (button as HTMLButtonElement).disabled)).toBe(true)
  })

  it('名前を入れると追加できる', async () => {
    const { user } = setup()

    await user.type(screen.getByLabelText('メンバーの名前'), '佐藤')
    const addButtons = screen.getAllByRole('button', { name: '追加' })
    const enabled = addButtons.find((button) => !(button as HTMLButtonElement).disabled)

    expect(enabled).toBeDefined()
    await user.click(enabled as HTMLElement)

    expect(addMember).toHaveBeenCalledOnce()
  })

  it('所属の欄を押すと、付け外しを求める', async () => {
    const { user } = setup()

    const buttons = screen.getAllByRole('button', { name: '内装班' })
    const toggle = buttons.find((button) => button.hasAttribute('aria-pressed'))
    await user.click(toggle as HTMLElement)

    expect(toggleSection).toHaveBeenCalledOnce()
  })

  it('削除してもタスクは残ることを伝える', () => {
    setup()

    // 消えると思って削除をためらわせない
    expect(screen.getByText(/担当だけが空になります/)).toBeInTheDocument()
  })
})
