'use client'

import { Button } from '@/components/ui/button'
import { PRIORITY_LABEL, STATUS_LABEL, TASK_STATUSES } from '@/lib/domain/tasks'
import { hasAssignee, resolveAssignee } from '@/lib/domain/assignee'
import { ESTIMATE_SOURCE_LABEL, formatEstimatedDays } from '@/lib/domain/estimate-days'
import type { Task } from '@/lib/repositories/tasks'

const PRIORITY_COLOR: Record<Task['priority'], string> = {
  high: 'var(--color-danger)',
  medium: 'var(--color-fg)',
  low: 'var(--color-fg-muted)',
}

/**
 * タスク 1 件の表示。
 *
 * AI が挙げた不明点と改善案も併せて出し、判断の材料にする。
 */
export function TaskCard({
  task,
  showStatus,
  pending,
  onEdit,
  onDelete,
  onMove,
  selected,
  onToggleSelect,
}: {
  task: Task
  /** カンバンでは列がステータスを表すので出さない */
  showStatus: boolean
  pending: boolean
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  onMove: (task: Task, status: Task['status']) => void
  selected: boolean
  onToggleSelect: (id: string) => void
}) {
  const hasNotes = task.ambiguityNote !== '' || task.aiSuggestion !== ''

  return (
    <article
      style={{
        // 選んだものは枠で示す。印だけだと、どれを選んだか見落とす
        border: selected
          ? '1px solid var(--color-accent)'
          : '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        background: selected
          ? 'color-mix(in srgb, var(--color-accent) 6%, var(--color-bg))'
          : 'var(--color-bg)',
        padding: 12,
        display: 'grid',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        {/* まとめて操作するための選択。行の先頭に置き、見つけやすくする */}
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(task.id)}
          disabled={pending}
          aria-label={`タスク「${task.title}」を選択`}
          style={{ width: 16, height: 16, cursor: 'pointer', alignSelf: 'center' }}
        />
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
        {task.estimatedDays !== null && (
          <span title={ESTIMATE_SOURCE_LABEL[task.estimateSource]}>
            想定: {formatEstimatedDays(task.estimatedDays)}
            {/* 推定値を、書かれていた値と同じ顔で出さない */}
            {task.estimateSource === 'inferred' && (
              <span style={{ color: 'var(--color-fg-muted)' }}>（推定）</span>
            )}
          </span>
        )}
        {hasAssignee({ memberName: task.assigneeMemberName, freeText: task.assignee }) && (
          <span>
            担当:{' '}
            {resolveAssignee({
              memberName: task.assigneeMemberName,
              freeText: task.assignee,
            })}
          </span>
        )}
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
