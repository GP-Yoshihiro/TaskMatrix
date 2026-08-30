'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createFolderAction, deleteFolderAction } from '@/lib/actions/folders'
import type { FolderNode } from '@/lib/domain/folders'

function flatten(node: FolderNode): { id: string; name: string }[] {
  return [{ id: node.id, name: node.name }, ...node.children.flatMap(flatten)]
}

function FolderItem({
  node,
  projectId,
  depth,
  onChanged,
}: {
  node: FolderNode
  projectId: string
  depth: number
  onChanged: () => void
}) {
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    const confirmed = window.confirm(
      `フォルダ「${node.name}」と配下の内容をすべて削除します。よろしいですか？`,
    )
    if (!confirmed) return

    const formData = new FormData()
    formData.set('projectId', projectId)
    formData.set('id', node.id)
    startTransition(async () => {
      await deleteFolderAction(formData)
      onChanged()
    })
  }

  return (
    <li>
      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          paddingLeft: depth * 16,
        }}
      >
        <span>📁 {node.name}</span>
        <Button variant="secondary" disabled={isPending} onClick={handleDelete}>
          削除
        </Button>
      </div>
      {node.children.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 6, marginTop: 6 }}>
          {node.children.map((child) => (
            <FolderItem
              key={child.id}
              node={child}
              projectId={projectId}
              depth={depth + 1}
              onChanged={onChanged}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export function FolderTree({
  projectId,
  tree,
}: {
  projectId: string
  tree: FolderNode[]
}) {
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const options = tree.flatMap(flatten)

  function handleCreate(formData: FormData) {
    setMessage(null)
    formData.set('projectId', projectId)
    startTransition(async () => {
      const result = await createFolderAction(formData)
      if (result.ok) router.refresh()
      else setMessage(result.error.message)
    })
  }

  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <h2 style={{ fontWeight: 600 }}>フォルダ</h2>
      <form action={handleCreate} style={{ display: 'flex', gap: 8 }}>
        <Input name="name" placeholder="フォルダ名" disabled={isPending} />
        <select
          name="parentId"
          aria-label="作成先"
          defaultValue=""
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--color-bg)',
            color: 'var(--color-fg)',
            padding: '0 8px',
          }}
        >
          <option value="">ルート直下</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name} の下
            </option>
          ))}
        </select>
        <Button type="submit" disabled={isPending}>
          作成
        </Button>
      </form>
      {message && (
        <p role="alert" style={{ color: 'var(--color-danger)', fontSize: '0.85rem' }}>
          {message}
        </p>
      )}
      {tree.length === 0 ? (
        <p style={{ color: 'var(--color-fg-muted)' }}>フォルダがまだありません。</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 6 }}>
          {tree.map((node) => (
            <FolderItem
              key={node.id}
              node={node}
              projectId={projectId}
              depth={0}
              onChanged={() => router.refresh()}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
