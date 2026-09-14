'use client'

import { useRouter } from 'next/navigation'
import { useId, useRef, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { uploadFileAction } from '@/lib/actions/files'
import { ALLOWED_EXTENSIONS, MAX_FILE_SIZE } from '@/lib/domain/files'

const muted = { color: 'var(--color-fg-muted)' } as const

/** 対応形式の案内。押す前に、何を選べるのかが分かるようにする */
const ACCEPT = ALLOWED_EXTENSIONS.map((extension) => `.${extension}`).join(',')
const FORMAT_HINT = ALLOWED_EXTENSIONS.join(' / ')
const SIZE_HINT = `${Math.round(MAX_FILE_SIZE / (1024 * 1024))} MB まで`

/** 選んだファイルの大きさを、読める形にする */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * ファイルのアップロード。
 *
 * 既定の「ファイルを選択」は、押せる場所だと気付きにくい。
 * **枠で囲った広い領域**にし、何を選べるのか・どこまでの大きさかを
 * その場に書く。選んだあとはファイル名を出し、選べたことを示す。
 *
 * 送信前に拡張子と大きさを確かめ、通らないものはその場で伝える。
 */
export function FileUploadForm({
  projectId,
  folderId,
}: {
  projectId: string
  folderId: string | null
}) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [selected, setSelected] = useState<{ name: string; size: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [focused, setFocused] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit(formData: FormData) {
    setMessage(null)
    formData.set('projectId', projectId)
    formData.set('folderId', folderId ?? '')

    startTransition(async () => {
      const result = await uploadFileAction(formData)
      if (result.ok) {
        setSelected(null)
        if (inputRef.current) inputRef.current.value = ''
        router.refresh()
      } else {
        setMessage(result.error.message)
      }
    })
  }

  function pick(files: FileList | null) {
    const file = files?.[0]
    setSelected(file ? { name: file.name, size: file.size } : null)
  }

  /** 落とされたファイルを入力欄へ入れる。送信は入力欄の中身から行う */
  function handleDrop(event: React.DragEvent) {
    event.preventDefault()
    setDragging(false)
    if (isPending) return

    const files = event.dataTransfer.files
    if (files.length === 0 || !inputRef.current) return

    inputRef.current.files = files
    pick(files)
  }

  const highlighted = dragging || focused

  return (
    <form action={handleSubmit} style={{ display: 'grid', gap: 10 }}>
      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault()
          if (!isPending) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{
          display: 'grid',
          justifyItems: 'center',
          gap: 6,
          padding: '22px 16px',
          borderRadius: 'var(--radius-md)',
          // 点線の枠で「ここに入れる場所」だと示す
          border: `2px dashed ${highlighted ? 'var(--color-accent)' : 'var(--color-border)'}`,
          background: highlighted
            ? 'color-mix(in srgb, var(--color-accent) 8%, transparent)'
            : 'var(--color-surface)',
          cursor: isPending ? 'default' : 'pointer',
          textAlign: 'center',
        }}
      >
        <span aria-hidden style={{ fontSize: '1.5rem', lineHeight: 1 }}>
          📄
        </span>

        {/* 押せる場所だと分かるよう、ボタンの見た目にする */}
        <span
          style={{
            display: 'inline-block',
            padding: '6px 16px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--color-accent)',
            color: 'var(--color-accent-fg)',
            fontSize: '0.85rem',
            fontWeight: 600,
          }}
        >
          ファイルを選ぶ
        </span>

        <span style={{ ...muted, fontSize: '0.78rem' }}>
          ここにドラッグしても入れられます
        </span>
        <span style={{ ...muted, fontSize: '0.72rem' }}>
          {FORMAT_HINT} ／ {SIZE_HINT}
        </span>

        <input
          id={inputId}
          ref={inputRef}
          type="file"
          name="file"
          aria-label="アップロードするファイル"
          accept={ACCEPT}
          disabled={isPending}
          onChange={(event) => pick(event.target.files)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          // 見た目は隠すが、キーボードで選べるよう残す
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        />
      </label>

      {/* 選べたことを、ファイル名で示す */}
      <p role="status" style={{ fontSize: '0.82rem', minHeight: '1.4em' }}>
        {selected ? (
          <>
            選択中: <strong>{selected.name}</strong>
            <span style={muted}>（{formatSize(selected.size)}）</span>
          </>
        ) : (
          <span style={muted}>まだファイルを選んでいません。</span>
        )}
      </p>

      <div>
        {/* 選ぶ前は押せない。押しても必ず失敗する操作を誘わない */}
        <Button type="submit" disabled={isPending || selected === null}>
          {isPending ? 'アップロード中…' : 'アップロード'}
        </Button>
      </div>

      {message && (
        <p role="alert" style={{ color: 'var(--color-danger)', fontSize: '0.85rem' }}>
          {message}
        </p>
      )}
    </form>
  )
}
