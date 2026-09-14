'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { TaskForm } from '@/components/features/tasks/task-form'
import { Button } from '@/components/ui/button'
import { hasAssignee, resolveAssignee } from '@/lib/domain/assignee'
import { ESTIMATE_SOURCE_LABEL, formatEstimatedDays } from '@/lib/domain/estimate-days'
import { PRIORITY_LABEL, STATUS_LABEL } from '@/lib/domain/tasks'
import type { Task } from '@/lib/repositories/tasks'

const muted = { color: 'var(--color-fg-muted)' } as const

/**
 * 予定から開くタスクの詳細。
 *
 * 予定を見ていて「このタスクは何だったか」を確かめたくなったとき、
 * タスク画面へ移ってから戻るのは手間が大きい。ここで確かめ、直せるようにする。
 *
 * 詳細を先に出し、編集は押したときだけ開く。
 * いきなり入力欄が並ぶと、見るだけのときに読みにくい。
 */
export function TaskDetailDialog({
  task,
  projectId,
  members,
  onClose,
  onSaved,
}: {
  /** null なら閉じている */
  task: Task | null
  projectId: string
  members: { id: string; name: string }[]
  onClose: () => void
  onSaved: () => void
}) {
  if (!task) return null

  /*
   * タスクが変わったら部品ごと作り直す。
   *
   * 閲覧と編集の切り替えを副作用で戻すと、描き直しが連鎖する。
   * 鍵を変えて作り直せば、状態は自然に初期値へ戻る。
   */
  return (
    <DetailBody
      key={task.id}
      task={task}
      projectId={projectId}
      members={members}
      onClose={onClose}
      onSaved={onSaved}
    />
  )
}

function DetailBody({
  task,
  projectId,
  members,
  onClose,
  onSaved,
}: {
  task: Task
  projectId: string
  members: { id: string; name: string }[]
  onClose: () => void
  onSaved: () => void
}) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const [editing, setEditing] = useState(false)

  // 開いたときに焦点を移す。これは状態の更新ではない
  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const assignee = resolveAssignee({
    memberName: task.assigneeMemberName,
    freeText: task.assignee,
  })

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        padding: 16,
        background: 'rgba(0, 0, 0, 0.4)',
        zIndex: 50,
      }}
    >
      <div
        style={{
          display: 'grid',
          gap: 12,
          width: '100%',
          maxWidth: 560,
          maxHeight: '85vh',
          overflowY: 'auto',
          padding: 20,
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <strong id={titleId} style={{ flex: 1, fontSize: '1rem' }}>
            {task.title}
          </strong>
          <Button ref={closeRef} size="sm" variant="secondary" onClick={onClose}>
            閉じる
          </Button>
        </div>

        {editing ? (
          <TaskForm
            projectId={projectId}
            members={members}
            task={task}
            onDone={() => {
              setEditing(false)
              onSaved()
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <>
            <dl
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                gap: '6px 14px',
                margin: 0,
                fontSize: '0.85rem',
              }}
            >
              <dt style={muted}>状態</dt>
              <dd style={{ margin: 0 }}>{STATUS_LABEL[task.status]}</dd>

              <dt style={muted}>優先度</dt>
              <dd style={{ margin: 0 }}>{PRIORITY_LABEL[task.priority]}</dd>

              <dt style={muted}>担当</dt>
              <dd style={{ margin: 0 }}>
                {hasAssignee({
                  memberName: task.assigneeMemberName,
                  freeText: task.assignee,
                })
                  ? assignee
                  : '未設定'}
              </dd>

              <dt style={muted}>想定日程</dt>
              <dd style={{ margin: 0 }}>
                {formatEstimatedDays(task.estimatedDays)}
                {task.estimatedDays !== null && (
                  <span style={{ ...muted, fontSize: '0.78rem' }}>
                    （{ESTIMATE_SOURCE_LABEL[task.estimateSource]}）
                  </span>
                )}
              </dd>

              <dt style={muted}>期限</dt>
              <dd style={{ margin: 0 }}>{task.dueDate ?? '未設定'}</dd>
            </dl>

            {task.description && (
              <p style={{ fontSize: '0.85rem', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {task.description}
              </p>
            )}

            {task.ambiguityNote && (
              <p style={{ fontSize: '0.82rem', color: 'var(--color-danger)', lineHeight: 1.7 }}>
                不明な点: {task.ambiguityNote}
              </p>
            )}

            <div>
              <Button size="sm" onClick={() => setEditing(true)}>
                編集する
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
