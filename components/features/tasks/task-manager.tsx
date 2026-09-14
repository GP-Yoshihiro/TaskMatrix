'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { TaskCard } from '@/components/features/tasks/task-card'
import { TaskForm } from '@/components/features/tasks/task-form'
import { Button } from '@/components/ui/button'
import {
  allSelected,
  selectionSummary,
  toggleAll,
  toggleOne,
} from '@/lib/domain/selection'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { deleteTaskAction, deleteTasksAction, moveTaskAction } from '@/lib/actions/tasks'
import { callAction } from '@/lib/client/safe-action'
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
  members,
}: {
  projectId: string
  /** 名簿。担当の選択に使う */
  members: { id: string; name: string }[]
  tasks: Task[]
}) {
  const [view, setView] = useState<ViewMode>('list')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [deleting, setDeleting] = useState<Task | null>(null)
  /** まとめて操作するために選んだタスク */
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
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

  /**
   * 編集枠。選んだ行の直下に出す。
   *
   * 一覧と一覧（ボード）の両方から同じものを使う。
   * 描き分けると、片方だけ挙動が変わる。
   */
  function renderEditForm(task: Task) {
    return (
      <TaskForm
        projectId={projectId}
        members={members}
        task={task}
        onDone={() => {
          setEditing(null)
          router.refresh()
        }}
        onCancel={() => setEditing(null)}
      />
    )
  }

  /** 表示中のタスクの識別子。まとめ操作は、見えているものだけを対象にする */
  const visibleIds = sorted.map((task) => task.id)

  /** 選んだうち、いま表示されているもの。隠れているものは消さない */
  const selectedVisible = visibleIds.filter((id) => selected.has(id))

  /** 選んだタスクをまとめて消す */
  function handleBulkDelete() {
    setMessage(null)

    const formData = new FormData()
    formData.set('projectId', projectId)
    // 隠れているものは含めない。見えている数と消える数を一致させる
    formData.set('ids', JSON.stringify(selectedVisible))

    startTransition(async () => {
      const result = await callAction(() => deleteTasksAction(formData))
      setBulkDeleting(false)

      if (result.ok) {
        setSelected(new Set())
        // 求めた数と違えば、その旨を伝える
        setMessage(
          result.data === selectedVisible.length
            ? `${result.data} 件を削除しました。`
            : `${result.data} 件を削除しました（${selectedVisible.length} 件のうち）。`,
        )
        router.refresh()
      } else {
        setMessage(result.error.message)
      }
    })
  }

  const cardProps = {
    pending: isPending,
    selected: false,
    onToggleSelect: (id: string) => setSelected((current) => toggleOne(current, id)),
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

      {/* まとめ操作。表示中のものだけを対象にする */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          flexWrap: 'wrap',
          padding: '8px 10px',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.82rem' }}>
          <input
            type="checkbox"
            checked={allSelected(selected, visibleIds)}
            onChange={() => setSelected((current) => toggleAll(current, visibleIds))}
            disabled={isPending || visibleIds.length === 0}
            aria-label="表示中のタスクをすべて選択"
            style={{ width: 16, height: 16, cursor: 'pointer' }}
          />
          すべて選択
        </label>

        <span style={{ fontSize: '0.82rem', color: 'var(--color-fg-muted)' }}>
          {selectionSummary(selected, visibleIds)}
        </span>

        <Button
          size="sm"
          variant="secondary"
          onClick={() => setBulkDeleting(true)}
          disabled={isPending || selectedVisible.length === 0}
        >
          選択したタスクを削除
        </Button>

        {message && <span style={{ fontSize: '0.82rem' }}>{message}</span>}
      </div>

      {creating && (
        <TaskForm
          projectId={projectId}
          members={members}
          onDone={() => {
            setCreating(false)
            router.refresh()
          }}
          onCancel={() => setCreating(false)}
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
            <li key={task.id} style={{ display: 'grid', gap: 10 }}>
              <TaskCard
                task={task}
                showStatus
                {...cardProps}
                selected={selected.has(task.id)}
              />
              {/* 編集枠は選んだ行の直下に出す。一覧の先頭に出すと、
                  どれを編集しているのかが分からなくなる */}
              {editing?.id === task.id && renderEditForm(task)}
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
                  <div key={task.id} style={{ display: 'grid', gap: 10 }}>
                    <TaskCard
                      task={task}
                      showStatus={false}
                      {...cardProps}
                      selected={selected.has(task.id)}
                    />
                    {editing?.id === task.id && renderEditForm(task)}
                  </div>
                ))
              )}
            </section>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={bulkDeleting}
        title="選択したタスクを削除しますか？"
        description={`表示中の ${selectedVisible.length} 件を削除します。`}
        warning="一度削除すると復元はできません。"
        confirmLabel="まとめて削除する"
        pending={isPending}
        onConfirm={handleBulkDelete}
        onCancel={() => setBulkDeleting(false)}
      />

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
