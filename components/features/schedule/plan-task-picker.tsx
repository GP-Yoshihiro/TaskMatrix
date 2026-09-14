'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MAX_PLAN_TASKS } from '@/lib/domain/plan-selection'
import { toggleOne } from '@/lib/domain/selection'
import type { Task } from '@/lib/repositories/tasks'
import { PRIORITY_LABEL } from '@/lib/domain/tasks'
import { formatEstimatedDays } from '@/lib/domain/estimate-days'

const muted = { color: 'var(--color-fg-muted)' } as const

/**
 * 算出の対象を選ぶ。
 *
 * 未完了のタスクが多いと、AI の応答が持ち時間に収まらず中断する。
 * **上限を超える場合は、どれを対象にするかを選んでもらう。**
 *
 * 勝手に上から 100 件を採らない。どれが外れたのか分からないまま
 * 予定が組まれると、「なぜこのタスクの予定が無いのか」を追えなくなる。
 */
export function PlanTaskPicker({
  tasks,
  selected,
  onChange,
  disabled,
}: {
  /** 未完了のタスク */
  tasks: Task[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
  disabled: boolean
}) {
  const count = tasks.filter((task) => selected.has(task.id)).length
  const overLimit = count > MAX_PLAN_TASKS

  /** 期限の近い順に上限まで選ぶ。よく使う選び方を 1 押しで済ませる */
  function pickByDueDate() {
    const sorted = [...tasks].sort((a, b) => {
      // 期限のないものは後ろへ
      if (a.dueDate === null) return b.dueDate === null ? 0 : 1
      if (b.dueDate === null) return -1
      return a.dueDate.localeCompare(b.dueDate)
    })

    onChange(new Set(sorted.slice(0, MAX_PLAN_TASKS).map((task) => task.id)))
  }

  return (
    <Card style={{ display: 'grid', gap: 10, borderColor: 'var(--color-accent)' }}>
      <strong style={{ fontSize: '0.9rem' }}>算出するタスクを選んでください</strong>

      <p style={{ fontSize: '0.82rem', lineHeight: 1.7 }}>
        未完了のタスクが <strong>{tasks.length} 件</strong>あります。
        1 度に算出できるのは <strong>{MAX_PLAN_TASKS} 件</strong>までです。
        <span style={muted}>（多すぎると応答が返らず、中断します）</span>
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button size="sm" variant="secondary" onClick={pickByDueDate} disabled={disabled}>
          期限の近い順に {MAX_PLAN_TASKS} 件選ぶ
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onChange(new Set())}
          disabled={disabled || count === 0}
        >
          選択を解除
        </Button>
        <span
          style={{
            fontSize: '0.82rem',
            color: overLimit ? 'var(--color-danger)' : 'var(--color-fg-muted)',
          }}
        >
          {count} / {MAX_PLAN_TASKS} 件
          {overLimit && ' — 減らしてください'}
        </span>
      </div>

      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'grid',
          gap: 4,
          maxHeight: 280,
          overflowY: 'auto',
        }}
      >
        {tasks.map((task) => (
          <li key={task.id}>
            <label
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                fontSize: '0.82rem',
                padding: '3px 4px',
                borderRadius: 'var(--radius-sm)',
                background: selected.has(task.id)
                  ? 'color-mix(in srgb, var(--color-accent) 8%, transparent)'
                  : 'transparent',
              }}
            >
              <input
                type="checkbox"
                checked={selected.has(task.id)}
                onChange={() => onChange(toggleOne(selected, task.id))}
                disabled={disabled}
                style={{ width: 15, height: 15, cursor: 'pointer' }}
              />
              <span style={{ flex: 1, minWidth: 0 }}>{task.title}</span>
              <span style={{ ...muted, fontSize: '0.74rem', whiteSpace: 'nowrap' }}>
                {PRIORITY_LABEL[task.priority]}
                {task.dueDate && ` / ${task.dueDate}`}
                {task.estimatedDays !== null && ` / ${formatEstimatedDays(task.estimatedDays)}`}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </Card>
  )
}
