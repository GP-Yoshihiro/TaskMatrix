'use client'

import { Button } from '@/components/ui/button'
import { PRIORITY_LABEL, STATUS_LABEL, TASK_STATUSES } from '@/lib/domain/tasks'
import type { Task } from '@/lib/repositories/tasks'

const PRIORITY_COLOR: Record<Task['priority'], string> = {
  high: 'var(--color-danger)',
  medium: 'var(--color-fg)',
  low: 'var(--color-fg-muted)',
}

export function TaskCard({
  task,
  showStatus,
  pending,
  onEdit,
  onDelete,
  onMove,
}: {
  task: Task
  /** カンバンでは列がステータスを表すので出さない */
  showStatus: boolean
  pending: boolean
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  onMove: (task: Task, status: Task['status']) => void
}) {
  const hasNotes = task.ambiguityNote !== '' || task.aiSuggestion !== ''

  return (
    <article
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-bg)',
        padding: 12,
        display: 'grid',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600 }}>{task.title}</span>
        {task.origin === 'ai' && (
          <span
            style={{
              fontSize: '0.68rem',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '1px 5px',
              color: 'var(--color-fg-muted)',
            }}
          >
            AI 抽出
          </span>
        )}
      </div>

      {task.description && <p style={{ fontSize: '0.85rem' }}>{task.description}</p>}

      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          fontSize: '0.76rem',
          color: 'var(--color-fg-muted)',
        }}
      >
        <span style={{ color: PRIORITY_COLOR[task.priority] }}>
          優先度: {PRIORITY_LABEL[task.priority]}
        </span>
        <span>期限: {task.dueDate ?? '未定'}</span>
        {task.assignee && <span>担当: {task.assignee}</span>}
        {showStatus && <span>状態: {STATUS_LABEL[task.status]}</span>}
      </div>

      {hasNotes && (
        <details style={{ fontSize: '0.8rem' }}>
          <summary style={{ cursor: 'pointer', color: 'var(--color-fg-muted)' }}>
            AI の指摘を見る
          </summary>
          <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
            {task.ambiguityNote && (
              <p style={{ color: 'var(--color-danger)' }}>⚠️ 不透明点: {task.ambiguityNote}</p>
            )}
            {task.aiSuggestion && (
              <p style={{ color: 'var(--color-fg-muted)' }}>💡 改善提案: {task.aiSuggestion}</p>
            )}
          </div>
        </details>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TASK_STATUSES.filter((status) => status !== task.status).map((status) => (
          <Button
            key={status}
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() => onMove(task, status)}
          >
            {STATUS_LABEL[status]}へ
          </Button>
        ))}
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => onEdit(task)}>
          編集
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={pending}
          aria-label={`タスク「${task.title}」を削除`}
          onClick={() => onDelete(task)}
          style={{ color: 'var(--color-danger)' }}
        >
          削除
        </Button>
      </div>
    </article>
  )
}
