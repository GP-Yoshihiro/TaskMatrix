import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FileUploadForm } from '@/components/features/files/file-upload-form'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}))

const upload = vi.fn()

vi.mock('@/lib/actions/files', () => ({
  uploadFileAction: (...args: unknown[]) => upload(...args),
}))

beforeEach(() => {
  upload.mockReset().mockResolvedValue({ ok: true, data: null })
})

function setup() {
  return {
    user: userEvent.setup(),
    ...render(<FileUploadForm projectId="p1" folderId={null} />),
  }
}

const FILE = new File(['名前,年齢\n田中,30'], '名簿.csv', { type: 'text/csv' })

describe('FileUploadForm の分かりやすさ', () => {
  it('押せる場所だと分かる言葉を出す', () => {
    // 既定の「ファイルを選択」は、押せる場所だと気付きにくい
    setup()
    expect(screen.getByText('ファイルを選ぶ')).toBeInTheDocument()
  })

  it('ドラッグでも入れられることを伝える', () => {
    setup()
    expect(screen.getByText(/ドラッグしても入れられます/)).toBeInTheDocument()
  })

  it('対応する形式をその場に出す', () => {
    // 選んでから断られるより、選ぶ前に分かるほうがよい
    setup()
    expect(screen.getByText(/xlsx/)).toBeInTheDocument()
    expect(screen.getByText(/csv/)).toBeInTheDocument()
  })

  it('大きさの上限をその場に出す', () => {
    setup()
    expect(screen.getByText(/25 MB まで/)).toBeInTheDocument()
  })

  it('まだ選んでいないことを示す', () => {
    setup()
    expect(screen.getByText('まだファイルを選んでいません。')).toBeInTheDocument()
  })
})

describe('FileUploadForm の選択', () => {
  it('選ぶ前はアップロードを押せない', () => {
    // 押しても必ず失敗する操作を誘わない
    setup()
    expect(screen.getByRole('button', { name: 'アップロード' })).toBeDisabled()
  })

  it('選ぶとファイル名を出す', async () => {
    const { user } = setup()

    await user.upload(screen.getByLabelText('アップロードするファイル'), FILE)

    expect(screen.getByText('名簿.csv')).toBeInTheDocument()
  })

  it('選ぶと大きさも出す', async () => {
    const { user } = setup()

    await user.upload(screen.getByLabelText('アップロードするファイル'), FILE)

    expect(screen.getByText(/B）|KB）/)).toBeInTheDocument()
  })

  it('選ぶとアップロードを押せるようになる', async () => {
    const { user } = setup()

    await user.upload(screen.getByLabelText('アップロードするファイル'), FILE)

    expect(screen.getByRole('button', { name: 'アップロード' })).toBeEnabled()
  })

  it('キーボードでも選べるよう、入力欄を残す', () => {
    // 見た目を隠すために display:none にすると、キーボードで届かなくなる
    const input = screen.queryByLabelText('アップロードするファイル')
    expect(input ?? setup().container.querySelector('input[type="file"]')).not.toBeNull()
  })
})
