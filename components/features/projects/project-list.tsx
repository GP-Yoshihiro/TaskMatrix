'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { deleteProjectAction } from '@/lib/actions/projects'
import type { Project } from '@/lib/repositories/projects'

/**
 * プロジェクトの一覧。
 *
 * 削除は取り消せないため、確認ダイアログを挟む。
 */
export function ProjectList({ projects }: { projects: Project[] }) {
  const [target, setTarget] = useState<Project | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleConfirm() {
    if (!target) return
    const formData = new FormData()
    formData.set('id', target.id)

    startTransition(async () => {
      await deleteProjectAction(formData)
      setTarget(null)
      router.refresh()
    })
  }

  if (projects.length === 0) {
    return (
      <EmptyState
        icon="📁"
        title="プロジェクトがまだありません"
        description="上の入力欄から作成できます。プロジェクトごとにファイル・タスク・予定・履歴がまとまります。"
      />
    )
  }

  return (
    <>
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
            <Card interactive style={{ display: 'grid', gap: 8 }}>
              <Link
                href={`/projects/${project.id}`}
                style={{ fontWeight: 600, fontSize: '1.05rem', padding: '2px 0' }}
              >
                {project.name}
              </Link>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: '0.78rem', color: 'var(--color-fg-muted)' }}>
                  更新: {new Date(project.updatedAt).toLocaleString('ja-JP')}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={isPending}
                  aria-label={`プロジェクト「${project.name}」を削除`}
                  onClick={() => setTarget(project)}
                  style={{ color: 'var(--color-danger)', flexShrink: 0 }}
                >
                  削除
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={target !== null}
        title="本当に削除しますか？"
        description={`プロジェクト「${target?.name ?? ''}」を削除します。含まれるフォルダ・ファイル・タスクもすべて削除されます。`}
        warning="一度削除すると復元はできません。"
        confirmLabel="削除する"
        pending={isPending}
        onConfirm={handleConfirm}
        onCancel={() => setTarget(null)}
      />
    </>
  )
}
