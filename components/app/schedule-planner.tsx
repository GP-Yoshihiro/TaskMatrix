'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import {
  type OverlapPair,
  OverlapWarningDialog,
} from '@/components/app/overlap-warning-dialog'
import { type CalendarEntry, CalendarMonth } from '@/components/app/calendar-month'
import { type Conflict, ScheduleDraftItem } from '@/components/app/schedule-draft-item'
import { AiProgress } from '@/components/ui/ai-progress'
import { AiUsageNote } from '@/components/ui/ai-usage-note'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { confirmSchedulesAction, planScheduleAction } from '@/lib/actions/schedules'
import { callAction } from '@/lib/client/safe-action'
import { type WorkSettings, findOverlaps } from '@/lib/domain/schedule'
import type { AiUsage, Estimate } from '@/lib/domain/usage'
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

export function SchedulePlanner({
  projectId,
  confirmed,
  pendingTaskCount,
  settings,
  estimate,
}: {
  projectId: string
  confirmed: Schedule[]
  pendingTaskCount: number
  settings: WorkSettings
  estimate: Estimate
}) {
  const [drafts, setDrafts] = useState<ScheduleDraft[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [note, setNote] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [warningOpen, setWarningOpen] = useState(false)
  // 算出だけを進捗表示の対象にする。確定の保存は AI を呼ばず一瞬で終わるため
  const [planning, setPlanning] = useState(false)
  const [lastRun, setLastRun] = useState<{ usage: AiUsage; durationMs: number } | null>(
    null,
  )
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  /**
   * 仮案と確定済みを合わせた比較対象。
   * 日時を編集するたびに作り直すため useMemo の依存に drafts を入れる。
   */
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

  function conflictsFor(draft: ScheduleDraft): Conflict[] {
    return findOverlaps(
      {
        id: draft.key,
        startsAt: draft.startsAt,
        endsAt: draft.endsAt,
        label: draft.taskTitle,
        kind: 'draft' as const,
      },
      comparables,
    ).map((item) => ({ id: item.id, label: item.label, kind: item.kind }))
  }

  const selectedDrafts = (drafts ?? []).filter((draft) => selected.has(draft.key))

  /** 確定対象に含まれる仮案の重複だけを集める */
  const overlapPairs: OverlapPair[] = selectedDrafts.flatMap((draft) =>
    conflictsFor(draft).map((conflict) => ({
      draftKey: draft.key,
      draftLabel: draft.taskTitle,
      withLabel: conflict.label,
      kind: conflict.kind,
    })),
  )

  const totalOverlapCount = (drafts ?? []).filter(
    (draft) => conflictsFor(draft).length > 0,
  ).length

  /** カレンダーに出す予定。仮案は編集に追従して動く */
  const calendarEntries: CalendarEntry[] = comparables.map((item) => ({
    id: item.id,
    label: item.label,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    draft: item.kind === 'draft',
  }))

  function handlePlan() {
    const agreed = window.confirm(
      '未完了タスクの一覧（タスク名・説明・優先度・期限）と稼働条件、\n' +
        '確定済みの予定を Google Gemini API に送信してスケジュールを算出します。\n' +
        'ファイルの本文やプロジェクト名は送信しません。\n\n' +
        '実行してよろしいですか？',
    )
    if (!agreed) return

    setMessage(null)
    setDrafts(null)
    setSelected(new Set())
    setLastRun(null)
    setPlanning(true)

    const formData = new FormData()
    formData.set('projectId', projectId)

    startTransition(async () => {
      const result = await callAction(() => planScheduleAction(formData))
      setPlanning(false)

      if (result.ok) {
        setDrafts(result.data.drafts)
        setNote(result.data.note)
        setLastRun({ usage: result.data.usage, durationMs: result.data.durationMs })
        setSelected(new Set(result.data.drafts.map((draft) => draft.key)))
        if (result.data.drafts.length === 0) {
          setMessage('割り当てられる予定がありませんでした。')
        }
      } else {
        setMessage(result.error.message)
      }
    })
  }

  function updateRange(key: string, startsAt: string, endsAt: string) {
    setDrafts((previous) =>
      (previous ?? []).map((draft) =>
        draft.key === key ? { ...draft, startsAt, endsAt } : draft,
      ),
    )
  }

  function toggle(key: string) {
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function save() {
    const formData = new FormData()
    formData.set('projectId', projectId)
    formData.set('drafts', JSON.stringify(selectedDrafts))

    startTransition(async () => {
      const result = await callAction(() => confirmSchedulesAction(formData))
      setWarningOpen(false)
      if (result.ok) {
        setMessage(`${result.data} 件の予定を確定しました。`)
        setDrafts(null)
        setSelected(new Set())
        router.refresh()
      } else {
        setMessage(result.error.message)
      }
    })
  }

  function handleConfirm() {
    setMessage(null)
    if (selectedDrafts.length === 0) {
      setMessage('確定する予定を選んでください。')
      return
    }
    if (overlapPairs.length > 0) {
      setWarningOpen(true)
      return
    }
    save()
  }

  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <h2 className="tm-h2">スケジュール算出</h2>
        <Button onClick={handlePlan} disabled={isPending || pendingTaskCount === 0}>
          {planning ? '処理中…' : 'スケジュールを算出'}
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

      <AiProgress
        pending={planning}
        estimateMs={estimate.ms}
        isMeasured={estimate.isMeasured}
      />
      {lastRun && !planning && (
        <AiUsageNote usage={lastRun.usage} durationMs={lastRun.durationMs} />
      )}

      {pendingTaskCount === 0 && (
        <p style={{ fontSize: '0.85rem', color: 'var(--color-fg-muted)' }}>
          予定を立てるタスクがありません。先にタスクを作成してください。
        </p>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {confirmed.length > 0 ? (
          <a
            href={`/api/projects/${projectId}/schedule.ics`}
            download="taskmatrix.ics"
            style={{ fontSize: '0.85rem' }}
          >
            .ics を書き出す（確定済み {confirmed.length} 件）
          </a>
        ) : (
          <span style={{ fontSize: '0.85rem', color: 'var(--color-fg-muted)' }}>
            確定した予定がありません。書き出しは確定後にご利用いただけます。
          </span>
        )}
      </div>

      <CalendarMonth entries={calendarEntries} settings={settings} />

      {drafts && drafts.length > 0 && (
        <Card style={{ display: 'grid', gap: 12 }}>
          {note && (
            <p style={{ fontSize: '0.85rem', color: 'var(--color-fg-muted)' }}>{note}</p>
          )}

          {totalOverlapCount > 0 && (
            <p style={{ fontSize: '0.85rem', color: 'var(--color-danger)' }}>
              ⚠️ {totalOverlapCount} 件の予定が他の予定と重複しています。
              日時を編集して調整できます。
            </p>
          )}

          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 10 }}>
            {drafts.map((draft) => (
              <ScheduleDraftItem
                key={draft.key}
                draft={draft}
                timezone={settings.timezone}
                selected={selected.has(draft.key)}
                conflicts={conflictsFor(draft)}
                disabled={isPending}
                onToggle={() => toggle(draft.key)}
                onChangeRange={(startsAt, endsAt) => updateRange(draft.key, startsAt, endsAt)}
              />
            ))}
          </ul>

          <div>
            <Button onClick={handleConfirm} disabled={isPending}>
              選択した予定を確定（{selected.size} 件）
            </Button>
          </div>
        </Card>
      )}

      <OverlapWarningDialog
        open={warningOpen}
        pairs={overlapPairs}
        pending={isPending}
        onConfirm={save}
        onCancel={() => setWarningOpen(false)}
      />
    </section>
  )
}
