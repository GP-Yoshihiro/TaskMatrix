'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { TaskCard } from '@/components/features/tasks/task-card'
import { TaskForm } from '@/components/features/tasks/task-form'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { deleteTaskAction, moveTaskAction } from '@/lib/actions/tasks'
import {
  STATUS_LABEL,
  TASK_STATUSES,
  type TaskStatus,
  groupTasksByStatus,
  sortTasksForDisplay,
} from '@/lib/domain/tasks'
import type { Task } from '@/lib/repositories/tasks'

type ViewMode = 'list' | 'board'

/**
 * タスクの一覧・追加・編集・削除。
 */
export function TaskManager({
  projectId,
  tasks,
}: {
  projectId: string
  tasks: Task[]
}) {
  const [view, setView] = useState<ViewMode>('list')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [deleting, setDeleting] = useState<Task | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const sorted = sortTasksForDisplay(tasks)
  const grouped = groupTasksByStatus(sorted)

  function handleMove(task: Task, status: TaskStatus) {
    const formData = new FormData()
    formData.set('projectId', projectId)
    formData.set('id', task.id)
    formData.set('status', status)
    startTransition(async () => {
      await moveTaskAction(formData)
      router.refresh()
    })
  }

  function handleConfirmDelete() {
    if (!deleting) return
    const formData = new FormData()
    formData.set('projectId', projectId)
    formData.set('id', deleting.id)
    startTransition(async () => {
      await deleteTaskAction(formData)
      setDeleting(null)
      router.refresh()
    })
  }

  const cardProps = {
    pending: isPending,
    onEdit: (task: Task) => {
      setCreating(false)
      setEditing(task)
    },
    onDelete: setDeleting,
    onMove: handleMove,
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div role="group" aria-label="表示の切替" style={{ display: 'flex', gap: 6 }}>
          <Button
            variant={view === 'list' ? 'primary' : 'secondary'}
            size="sm"
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
          >
            リスト
          </Button>
          <Button
            variant={view === 'board' ? 'primary' : 'secondary'}
            size="sm"
            aria-pressed={view === 'board'}
            onClick={() => setView('board')}
          >
            カンバン
          </Button>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null)
            setCreating((prev) => !prev)
          }}
        >
          {creating ? '追加をやめる' : 'タスクを追加'}
        </Button>
        <span style={{ fontSize: '0.8rem', color: 'var(--color-fg-muted)' }}>
          全 {tasks.length} 件
        </span>
      </div>

      {creating && (
        <TaskForm
          projectId={projectId}
          onDone={() => {
            setCreating(false)
            router.refresh()
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      {editing && (
        <TaskForm
          projectId={projectId}
          task={editing}
          onDone={() => {
            setEditing(null)
            router.refresh()
          }}
          onCancel={() => setEditing(null)}
        />
      )}

      {tasks.length === 0 ? (
        <p style={{ color: 'var(--color-fg-muted)' }}>
          タスクがまだありません。ファイル画面の「AI タスク抽出」から作るか、
          上の「タスクを追加」から手動で作成してください。
        </p>
      ) : view === 'list' ? (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 10 }}>
          {sorted.map((task) => (
            <li key={task.id}>
              <TaskCard task={task} showStatus {...cardProps} />
            </li>
          ))}
        </ul>
      ) : (
        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            alignItems: 'start',
          }}
        >
          {TASK_STATUSES.map((status) => (
            <section
              key={status}
              aria-label={STATUS_LABEL[status]}
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: 12,
                display: 'grid',
                gap: 10,
                alignContent: 'start',
              }}
            >
              <h3 style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                {STATUS_LABEL[status]}（{grouped[status].length}）
              </h3>
              {grouped[status].length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--color-fg-muted)' }}>なし</p>
              ) : (
                grouped[status].map((task) => (
                  <TaskCard key={task.id} task={task} showStatus={false} {...cardProps} />
                ))
              )}
            </section>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="本当に削除しますか？"
        description={`タスク「${deleting?.title ?? ''}」を削除します。`}
        warning="一度削除すると復元はできません。"
        confirmLabel="削除する"
        pending={isPending}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
