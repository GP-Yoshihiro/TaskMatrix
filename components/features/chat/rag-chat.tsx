'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { AiProgress } from '@/components/ui/ai-progress'
import { AiUsageNote } from '@/components/ui/ai-usage-note'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { askAction, buildIndexAction } from '@/lib/actions/rag'
import { callAction } from '@/lib/client/safe-action'
import type { ChatMessage } from '@/lib/repositories/chat'
import type { AiOperation, AiUsage, Estimate } from '@/lib/domain/usage'

type Running = Extract<AiOperation, 'build_index' | 'answer_question'>

type LastRun = { operation: Running; usage: AiUsage; durationMs: number }

/**
 * プロジェクト内の資料を根拠に答える AI チャット。
 *
 * 根拠が 0 件のときは AI を呼ばない。根拠が無いまま答えさせると、
 * それらしい創作を返してしまうため。
 */
export function RagChat({
  projectId,
  messages,
  indexedChunks,
  estimates,
}: {
  projectId: string
  messages: ChatMessage[]
  indexedChunks: number
  estimates: Record<Running, Estimate>
}) {
  const [question, setQuestion] = useState('')
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)
  const [running, setRunning] = useState<Running | null>(null)
  const [lastRun, setLastRun] = useState<LastRun | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleBuildIndex() {
    const agreed = window.confirm(
      'プロジェクト内のファイルの本文を Google Gemini API に送信して、\n' +
        '検索用データを作成します。\n' +
        'ファイル名も根拠の表示のために送信されます。\n\n' +
        '実行してよろしいですか？',
    )
    if (!agreed) return

    setMessage(null)
    setLastRun(null)
    setRunning('build_index')
    const formData = new FormData()
    formData.set('projectId', projectId)

    startTransition(async () => {
      const result = await callAction(() => buildIndexAction(formData))
      setRunning(null)

      if (result.ok) {
        setMessage({
          text: `${result.data.files} 個のファイルから ${result.data.chunks} 件の検索用データを作成しました。`,
          isError: false,
        })
        setLastRun({
          operation: 'build_index',
          usage: result.data.usage,
          durationMs: result.data.durationMs,
        })
        router.refresh()
      } else {
        setMessage({ text: result.error.message, isError: true })
      }
    })
  }

  /**
   * form の action ではなく onSubmit を使う。
   * action に渡した関数は React がトランジション内で実行するため、
   * その中の状態更新（進捗表示の開始）が描画へ反映されるのが遅れる。
   */
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    handleAsk(new FormData(event.currentTarget))
  }

  function handleAsk(formData: FormData) {
    const asked = question.trim()
    if (asked.length === 0) {
      setMessage({ text: '質問を入力してください。', isError: true })
      return
    }

    setMessage(null)
    setLastRun(null)
    setRunning('answer_question')
    formData.set('projectId', projectId)
    formData.set('question', asked)

    startTransition(async () => {
      const result = await callAction(() => askAction(formData))
      setRunning(null)

      if (result.ok) {
        setQuestion('')
        setLastRun({
          operation: 'answer_question',
          usage: result.data.usage,
          durationMs: result.data.durationMs,
        })
        router.refresh()
      } else {
        setMessage({ text: result.error.message, isError: true })
      }
    })
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section style={{ display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <h2 className="tm-h2">検索用データ</h2>
          <Button size="sm" variant="secondary" onClick={handleBuildIndex} disabled={isPending}>
            {running === 'build_index' ? '処理中…' : '検索用データを作成'}
          </Button>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-fg-muted)' }}>
            登録済み {indexedChunks} 件
          </span>
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--color-fg-muted)' }}>
          ファイルの本文とファイル名が Google Gemini API に送信されます。
          プロジェクト名・フォルダ名・アカウント情報は送信しません。
          ファイルを更新したら作り直してください。
        </p>
        <AiProgress
          pending={running === 'build_index'}
          estimateMs={estimates.build_index.ms}
          isMeasured={estimates.build_index.isMeasured}
        />
        {lastRun?.operation === 'build_index' && (
          <AiUsageNote usage={lastRun.usage} durationMs={lastRun.durationMs} />
        )}
      </section>

      {indexedChunks === 0 && (
        <p style={{ fontSize: '0.85rem', color: 'var(--color-fg-muted)' }}>
          検索用データがありません。まず「検索用データを作成」を実行してください。
        </p>
      )}

      <section style={{ display: 'grid', gap: 10 }}>
        {messages.length === 0 ? (
          <p style={{ color: 'var(--color-fg-muted)' }}>
            まだ会話がありません。プロジェクトの資料について質問できます。
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 10 }}>
            {messages.map((item) => (
              <li key={item.id}>
                <Card
                  style={{
                    display: 'grid',
                    gap: 8,
                    background:
                      item.role === 'user' ? 'var(--color-bg)' : 'var(--color-surface)',
                    marginInlineStart: item.role === 'user' ? 'auto' : 0,
                    maxWidth: '92%',
                  }}
                >
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-fg-muted)' }}>
                    {item.role === 'user' ? 'あなた' : 'アシスタント'}
                  </span>
                  <p style={{ fontSize: '0.9rem', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                    {item.content}
                  </p>

                  {item.sources.length > 0 && (
                    <details style={{ fontSize: '0.78rem' }}>
                      <summary style={{ cursor: 'pointer', color: 'var(--color-fg-muted)' }}>
                        参照した資料（{item.sources.length} 件）
                      </summary>
                      <ul style={{ display: 'grid', gap: 6, marginTop: 6, paddingLeft: 16 }}>
                        {item.sources.map((source, index) => (
                          <li key={`${source.fileId}-${source.chunkIndex}-${index}`}>
                            <strong>{source.fileName}</strong>
                            <br />
                            <span style={{ color: 'var(--color-fg-muted)' }}>
                              {source.excerpt}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <Input
            name="question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="例: 見積もりの期限はいつですか？"
            disabled={isPending}
            aria-label="質問"
          />
          <Button type="submit" disabled={isPending}>
            {running === 'answer_question' ? '考え中…' : '質問する'}
          </Button>
        </div>
        <AiProgress
          pending={running === 'answer_question'}
          estimateMs={estimates.answer_question.ms}
          isMeasured={estimates.answer_question.isMeasured}
        />
        {lastRun?.operation === 'answer_question' && (
          <AiUsageNote usage={lastRun.usage} durationMs={lastRun.durationMs} />
        )}
        {message && (
          <p
            role={message.isError ? 'alert' : 'status'}
            style={{
              fontSize: '0.85rem',
              color: message.isError ? 'var(--color-danger)' : 'var(--color-fg-muted)',
            }}
          >
            {message.text}
          </p>
        )}
      </form>
    </div>
  )
}
