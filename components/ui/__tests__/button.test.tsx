import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from '@/components/ui/button'

describe('Button', () => {
  it('ラベルを表示する', () => {
    render(<Button>保存</Button>)
    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
  })

  it('disabled のとき操作できない', () => {
    render(<Button disabled>保存</Button>)
    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled()
  })
})
