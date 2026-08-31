'use client'

import { useMemo, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { planScheduleAction } from '@/lib/actions/schedules'
import { callAction } from '@/lib/client/safe-action'
import { WEIGHT_LABEL, WEIGHT_OVERLAP_HINT, findOverlaps } from '@/lib/domain/schedule'
import type { Schedule } from '@/lib/repositories/schedules'
import type { ScheduleDraft } from '@/lib/usecases/plan-schedule'

/** 重複検出のために、仮案と確定済みを同じ形に揃える */
type Comparable = {
  id: string
  startsAt: string
  endsAt: string
  label: string
  kind: 'draft' | 'confirmed'
}

function formatRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  const date = start.toLocaleDateString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  })
  const time = (value: Date) =>
    value.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
  return `${date} ${time(start)} 〜 ${time(end)}`
}

export function SchedulePlanner({
  projectId,
  confirmed,
  pendingTaskCount,
}: {
  projectId: string
  confirmed: Schedule[]
  pendingTaskCount: number
}) {
  const [drafts, setDrafts] = useState<ScheduleDraft[] | null>(null)
  const [note, setNote] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  /** 仮案と確定済みを合わせた比較対象。編集のたびに作り直す */
  const comparables = useMemo<Comparable[]>(() => {
    const fromDrafts = (drafts ?? []).map((draft) => ({
      id: draft.key,
      startsAt: draft.startsAt,
      endsAt: draft.endsAt,
      label: draft.taskTitle,
      kind: 'draft' as const,
    }))
    const fromConfirmed = confirmed.map((schedule) => ({
      id: schedule.id,
      startsAt: schedule.startsAt,
      endsAt: schedule.endsAt,
      label: schedule.taskTitle,
      kind: 'confirmed' as const,
    }))
    return [...fromDrafts, ...fromConfirmed]
  }, [drafts, confirmed])

  function overlapsFor(draft: ScheduleDraft): Comparable[] {
    return findOverlaps(
      {
        id: draft.key,
        startsAt: draft.startsAt,
        endsAt: draft.endsAt,
        label: draft.taskTitle,
        kind: 'draft' as const,
      },
      comparables,
    )
  }

  function handlePlan() {
    const confirmedOk = window.confirm(
      '未完了タスクの一覧（タスク名・説明・優先度・期限）と稼働条件、\n' +
        '確定済みの予定を Google Gemini API に送信してスケジュールを算出します。\n' +
        'ファイルの本文やプロジェクト名は送信しません。\n\n' +
        '実行してよろしいですか？',
    )
    if (!confirmedOk) return

    setMessage(null)
    setDrafts(null)

    const formData = new FormData()
    formData.set('projectId', projectId)

    startTransition(async () => {
      const result = await callAction(() => planScheduleAction(formData))
      if (result.ok) {
        setDrafts(result.data.drafts)
        setNote(result.data.note)
        if (result.data.drafts.length === 0) {
          setMessage('割り当てられる予定がありませんでした。')
        }
      } else {
        setMessage(result.error.message)
      }
    })
  }

  const overlapCount = (drafts ?? []).filter((draft) => overlapsFor(draft).length > 0).length

  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <h2 style={{ fontWeight: 600 }}>スケジュール算出</h2>
        <Button onClick={handlePlan} disabled={isPending || pendingTaskCount === 0}>
          {isPending ? '算出中…（最大 2 分）' : 'スケジュールを算出'}
        </Button>
        <span style={{ fontSize: '0.8rem', color: 'var(--color-fg-muted)' }}>
          未完了タスク {pendingTaskCount} 件 / 確定済みの予定 {confirmed.length} 件
        </span>
        {message && <span style={{ fontSize: '0.85rem' }}>{message}</span>}
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--color-fg-muted)' }}>
        未完了タスクの名称・説明・優先度・期限、稼働条件、確定済みの予定が
        Google Gemini API に送信されます。ファイルの本文・プロジェクト名・
        アカウント情報は送信しません。
      </p>

      {pendingTaskCount === 0 && (
        <p style={{ fontSize: '0.85rem', color: 'var(--color-fg-muted)' }}>
          予定を立てるタスクがありません。先にタスクを作成してください。
        </p>
      )}

      {drafts && drafts.length > 0 && (
        <Card style={{ display: 'grid', gap: 12 }}>
          {note && (
            <p style={{ fontSize: '0.85rem', color: 'var(--color-fg-muted)' }}>{note}</p>
          )}

          {overlapCount > 0 && (
            <p style={{ fontSize: '0.85rem', color: 'var(--color-danger)' }}>
              ⚠️ {overlapCount} 件の予定が他の予定と重複しています。
            </p>
          )}

          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 10 }}>
            {drafts.map((draft) => {
              const conflicts = overlapsFor(draft)
              return (
                <li
                  key={draft.key}
                  style={{
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: 12,
                    display: 'grid',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600 }}>{draft.taskTitle}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-fg-muted)' }}>
                      {formatRange(draft.startsAt, draft.endsAt)}
                    </span>
                    <span style={{ fontSize: '0.76rem', color: 'var(--color-fg-muted)' }}>
                      重さ: {WEIGHT_LABEL[draft.weight]}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.82rem' }}>{draft.reason}</p>

                  <p style={{ fontSize: '0.76rem', color: 'var(--color-fg-muted)' }}>
                    {WEIGHT_OVERLAP_HINT[draft.weight]}
                  </p>

                  {draft.outOfWorkHours && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-danger)' }}>
                      ⚠️ 稼働時間外です。
                    </p>
                  )}

                  {conflicts.map((conflict) => (
                    <p
                      key={conflict.id}
                      style={{ fontSize: '0.8rem', color: 'var(--color-danger)' }}
                    >
                      ⚠️ {conflict.kind === 'confirmed' ? '確定済み' : '仮案'}の「
                      {conflict.label}」と重複しています。
                    </p>
                  ))}
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </section>
  )
}
