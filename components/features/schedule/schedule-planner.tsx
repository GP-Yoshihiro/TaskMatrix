'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import {
  type OverlapPair,
  OverlapWarningDialog,
} from '@/components/features/schedule/overlap-warning-dialog'
import type { CalendarEntry } from '@/components/features/schedule/calendar-month'
import { CalendarView } from '@/components/features/schedule/calendar-view'
import { OverwriteConfirmDialog } from '@/components/features/schedule/overwrite-confirm-dialog'
import { TaskDetailDialog } from '@/components/features/schedule/task-detail-dialog'
import type { Task } from '@/lib/repositories/tasks'
import { type Conflict, ScheduleDraftItem } from '@/components/features/schedule/schedule-draft-item'
import { findDuplicateTasks } from '@/lib/domain/schedule-overwrite'
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
  taskId: string
  startsAt: string
  endsAt: string
  label: string
  /** 担当。ガントチャートの色分けに使う */
  assignee: string
  kind: 'draft' | 'confirmed'
}

/**
 * 予定の算出と確定。
 *
 * 算出した時点では保存しない。利用者が編集・確定してから保存する。
 */
export function SchedulePlanner({
  projectId,
  confirmed,
  pendingTaskCount,
  settings,
  estimate,
  assigneeByTaskId,
  sectionsByAssignee,
  tasks,
  members,
  aiLimit,
}: {
  projectId: string
  confirmed: Schedule[]
  pendingTaskCount: number
  settings: WorkSettings
  estimate: Estimate
  /** タスク ID から担当を引く。ガントチャートの色分けに使う */
  assigneeByTaskId: Record<string, string>
  /** 担当名から所属セクションを引く。ガントチャートの区切りに使う */
  sectionsByAssignee: Record<string, string[]>
  /** 予定から詳細を開くためのタスク一覧 */
  tasks: Task[]
  /** 担当の選択肢 */
  members: { id: string; name: string }[]
  /** 本日の AI の残り。読めなければ null */
  aiLimit: { remainingCalls: number; remainingTokens: number; allowed: boolean } | null
}) {
  const [drafts, setDrafts] = useState<ScheduleDraft[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [note, setNote] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [warningOpen, setWarningOpen] = useState(false)
  const [overwriteOpen, setOverwriteOpen] = useState(false)
  /** 詳細を開いているタスク。null なら閉じている */
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
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
      taskId: draft.taskId,
      startsAt: draft.startsAt,
      endsAt: draft.endsAt,
      label: draft.taskTitle,
      assignee: assigneeByTaskId[draft.taskId] ?? '',
      kind: 'draft' as const,
    }))
    const fromConfirmed = confirmed.map((schedule) => ({
      id: schedule.id,
      taskId: schedule.taskId,
      startsAt: schedule.startsAt,
      endsAt: schedule.endsAt,
      label: schedule.taskTitle,
      assignee: assigneeByTaskId[schedule.taskId] ?? '',
      kind: 'confirmed' as const,
    }))
    return [...fromDrafts, ...fromConfirmed]
  }, [drafts, confirmed, assigneeByTaskId])

  function conflictsFor(draft: ScheduleDraft): Conflict[] {
    return findOverlaps(
      {
        id: draft.key,
        startsAt: draft.startsAt,
        endsAt: draft.endsAt,
        label: draft.taskTitle,
        taskId: draft.taskId,
        assignee: assigneeByTaskId[draft.taskId] ?? '',
        kind: 'draft' as const,
      },
      comparables,
    ).map((item) => ({ id: item.id, label: item.label, kind: item.kind }))
  }

  const selectedDrafts = (drafts ?? []).filter((draft) => selected.has(draft.key))

  /** 選んだ仮案のうち、同じタスクに既存の予定があるもの */
  const duplicates = findDuplicateTasks(
    selectedDrafts.map((draft) => ({
      key: draft.key,
      taskId: draft.taskId,
      taskTitle: draft.taskTitle,
    })),
    confirmed.map((schedule) => ({
      id: schedule.id,
      taskId: schedule.taskId,
      taskTitle: schedule.taskTitle,
      googleEventId: schedule.googleEventId ?? '',
    })),
  )

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
    taskId: item.taskId,
    label: item.label,
    assignee: item.assignee,
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

        /*
         * 対象外になった提案があれば必ず伝える。
         *
         * 黙って捨てると「算出がうまくいかない」理由が分からない。
         * 0 件になった場合は、その原因がここにあることが多い。
         */
        const dropped = result.data.unmatchedCount

        if (result.data.drafts.length === 0) {
          setMessage(
            dropped > 0
              ? `割り当てられる予定がありませんでした（${dropped} 件の提案が、もとのタスクに結び付きませんでした）。もう一度お試しください。`
              : '割り当てられる予定がありませんでした。',
          )
        } else if (dropped > 0) {
          setMessage(`${dropped} 件の提案は、もとのタスクに結び付かなかったため除きました。`)
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

  /** 確定する。`overwrite` が真なら、同じタスクの既存の予定を置き換える */
  function save(overwrite = false) {
    const formData = new FormData()
    formData.set('projectId', projectId)
    formData.set('drafts', JSON.stringify(selectedDrafts))
    formData.set('overwrite', overwrite ? 'true' : 'false')

    startTransition(async () => {
      const result = await callAction(() => confirmSchedulesAction(formData))
      setWarningOpen(false)
      setOverwriteOpen(false)
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
    // 同じタスクに既存の予定があれば、置き換えるかを先に確かめる。
    // そのまま確定すると、同じタスクの予定が二重に増える
    if (duplicates.length > 0) {
      setOverwriteOpen(true)
      return
    }
    save()
  }

  /** 重なりの警告を通したあと。ここでも重複の確認は挟む */
  function handleAfterOverlap() {
    setWarningOpen(false)
    if (duplicates.length > 0) {
      setOverwriteOpen(true)
      return
    }
    save()
  }

  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <h2 className="tm-h2">スケジュール算出</h2>
        <Button
          onClick={handlePlan}
          disabled={isPending || pendingTaskCount === 0 || aiLimit?.allowed === false}
        >
          {planning ? '処理中…' : 'スケジュールを算出'}
        </Button>
        <span style={{ fontSize: '0.8rem', color: 'var(--color-fg-muted)' }}>
          未完了タスク {pendingTaskCount} 件 / 確定済みの予定 {confirmed.length} 件
        </span>

        {/* 上限に達したときだけでなく、達する前から分かるようにする */}
        {aiLimit && (
          <span
            style={{
              fontSize: '0.78rem',
              color: aiLimit.allowed ? 'var(--color-fg-muted)' : 'var(--color-danger)',
            }}
          >
            {aiLimit.allowed
              ? `本日の AI の残り: ${aiLimit.remainingCalls} 回 / ${aiLimit.remainingTokens.toLocaleString('ja-JP')} トークン`
              : 'AI の本日の上限に達しています。日本時間の 0 時を過ぎるとまた使えます。'}
          </span>
        )}
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

      <CalendarView
        entries={calendarEntries}
        settings={settings}
        sections={sectionsByAssignee}
        onOpenTask={setOpenTaskId}
      />

      <TaskDetailDialog
        task={tasks.find((task) => task.id === openTaskId) ?? null}
        projectId={projectId}
        members={members}
        onClose={() => setOpenTaskId(null)}
        onSaved={() => {
          setOpenTaskId(null)
          // 担当や想定日程が変われば、ガントチャートの見え方も変わる
          router.refresh()
        }}
      />

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
        onConfirm={handleAfterOverlap}
        onCancel={() => setWarningOpen(false)}
      />

      <OverwriteConfirmDialog
        open={overwriteOpen}
        duplicates={duplicates}
        pending={isPending}
        onOverwrite={() => save(true)}
        onKeepBoth={() => save(false)}
        onCancel={() => setOverwriteOpen(false)}
      />
    </section>
  )
}
