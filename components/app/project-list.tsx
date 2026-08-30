'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { deleteProjectAction } from '@/lib/actions/projects'
import type { Project } from '@/lib/repositories/projects'

export function ProjectList({ projects }: { projects: Project[] }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleDelete(id: string, name: string) {
    const confirmed = window.confirm(
      `プロジェクト「${name}」を削除します。含まれるフォルダとファイルもすべて削除されます。よろしいですか？`,
    )
    if (!confirmed) return

    const formData = new FormData()
    formData.set('id', id)
    startTransition(async () => {
      await deleteProjectAction(formData)
      router.refresh()
    })
  }

  if (projects.length === 0) {
    return (
      <p style={{ color: 'var(--color-fg-muted)' }}>
        プロジェクトがまだありません。上の入力欄から作成してください。
      </p>
    )
  }

  return (
    <ul
      style={{
        display: 'grid',
        gap: 12,
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        listStyle: 'none',
        padding: 0,
      }}
    >
      {projects.map((project) => (
        <li key={project.id}>
          <Card style={{ display: 'grid', gap: 12 }}>
            <Link href={`/projects/${project.id}`} style={{ fontWeight: 600 }}>
              {project.name}
            </Link>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-fg-muted)' }}>
              更新: {new Date(project.updatedAt).toLocaleString('ja-JP')}
            </span>
            <Button
              variant="danger"
              disabled={isPending}
              onClick={() => handleDelete(project.id, project.name)}
            >
              削除
            </Button>
          </Card>
        </li>
      ))}
    </ul>
  )
}
