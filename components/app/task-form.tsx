'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { createTaskAction, updateTaskAction } from '@/lib/actions/tasks'
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from '@/lib/domain/tasks'
import type { Task } from '@/lib/repositories/tasks'

const selectStyle = {
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--color-bg)',
  color: 'var(--color-fg)',
  padding: 'calc(var(--space-unit) * 2)',
  fontFamily: 'var(--font-ui)',
  fontSize: '0.95rem',
}

const labelStyle = { fontSize: '0.8rem', color: 'var(--color-fg-muted)' }

export function TaskForm({
  projectId,
  task,
  onDone,
  onCancel,
}: {
  projectId: string
  /** 渡されたら編集、渡されなければ新規作成 */
  task?: Task
  onDone: () => void
  onCancel?: () => void
}) {
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const editing = task !== undefined

  function handleSubmit(formData: FormData) {
    setMessage(null)
    formData.set('projectId', projectId)
    if (task) formData.set('id', task.id)

    startTransition(async () => {
      const result = editing
        ? await updateTaskAction(formData)
        : await createTaskAction(formData)
      if (result.ok) onDone()
      else setMessage(result.error.message)
    })
  }

  return (
    <Card style={{ display: 'grid', gap: 10 }}>
      <h3 style={{ fontWeight: 600 }}>{editing ? 'タスクを編集' : 'タスクを追加'}</h3>
      <form action={handleSubmit} style={{ display: 'grid', gap: 10 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={labelStyle}>タスク名</span>
          <Input name="title" defaultValue={task?.title ?? ''} disabled={isPending} required />
        </label>

        <label style={{ display: 'grid', gap: 4 }}>
          <span style={labelStyle}>説明</span>
          <textarea
            name="description"
            defaultValue={task?.description ?? ''}
            disabled={isPending}
            rows={2}
            style={{ ...selectStyle, width: '100%', resize: 'vertical' }}
          />
        </label>

        <div
          style={{
            display: 'grid',
            gap: 10,
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          }}
        >
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={labelStyle}>優先度</span>
            <select
              name="priority"
              defaultValue={task?.priority ?? 'medium'}
              disabled={isPending}
              style={selectStyle}
            >
              {TASK_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {PRIORITY_LABEL[priority]}
                </option>
              ))}
            </select>
          </label>

          {editing && (
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={labelStyle}>ステータス</span>
              <select
                name="status"
                defaultValue={task.status}
                disabled={isPending}
                style={selectStyle}
              >
                {TASK_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABEL[status]}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label style={{ display: 'grid', gap: 4 }}>
            <span style={labelStyle}>担当</span>
            <Input name="assignee" defaultValue={task?.assignee ?? ''} disabled={isPending} />
          </label>

          <label style={{ display: 'grid', gap: 4 }}>
            <span style={labelStyle}>期限</span>
            <Input
              name="dueDate"
              type="date"
              defaultValue={task?.dueDate ?? ''}
              disabled={isPending}
            />
          </label>
        </div>

        {message && (
          <p role="alert" style={{ color: 'var(--color-danger)', fontSize: '0.85rem' }}>
            {message}
          </p>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="submit" disabled={isPending}>
            {isPending ? '保存中…' : editing ? '更新' : '追加'}
          </Button>
          {onCancel && (
            <Button type="button" variant="secondary" disabled={isPending} onClick={onCancel}>
              キャンセル
            </Button>
          )}
        </div>
      </form>
    </Card>
  )
}
