'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  addMemberAction,
  addSectionAction,
  removeMemberAction,
  removeSectionAction,
  renameMemberAction,
  renameSectionAction,
  toggleSectionAction,
} from '@/lib/actions/members'
import { callAction } from '@/lib/client/safe-action'
import type { Result } from '@/lib/domain/result'
import { UNASSIGNED_SECTION } from '@/lib/domain/member'
import type { ProjectMember, Section } from '@/lib/repositories/members'

const muted = { color: 'var(--color-fg-muted)' } as const

type Message = { text: string; isError: boolean } | null

/**
 * メンバーとセクションの管理。
 *
 * メンバーは**名簿**であり、利用者アカウントではない。
 * ここで登録した名前が、タスクの担当とガントチャートの並べ替えの基準になる。
 */
export function MemberManager({
  projectId,
  members,
  sections,
}: {
  projectId: string
  members: ProjectMember[]
  sections: Section[]
}) {
  const [memberName, setMemberName] = useState('')
  const [sectionName, setSectionName] = useState('')
  const [editing, setEditing] = useState<{ kind: 'member' | 'section'; id: string } | null>(
    null,
  )
  const [editValue, setEditValue] = useState('')
  const [message, setMessage] = useState<Message>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  /** 操作の共通部分。プロジェクト ID の付与と、結果の扱いをここにまとめる */
  function run(
    action: (formData: FormData) => Promise<Result<null>>,
    fields: Record<string, string>,
    onDone?: () => void,
  ) {
    setMessage(null)

    const formData = new FormData()
    formData.set('projectId', projectId)
    for (const [key, value] of Object.entries(fields)) formData.set(key, value)

    startTransition(async () => {
      const result = await callAction(() => action(formData))
      if (result.ok) {
        onDone?.()
        router.refresh()
      } else {
        setMessage({ text: result.error.message, isError: true })
      }
    })
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {message && (
        <p
          role="alert"
          style={{
            fontSize: '0.85rem',
            color: message.isError ? 'var(--color-danger)' : 'var(--color-fg-muted)',
          }}
        >
          {message.text}
        </p>
      )}

      <section style={{ display: 'grid', gap: 10 }}>
        <h2 className="tm-h2">セクション</h2>
        <p style={{ ...muted, fontSize: '0.82rem' }}>
          班や部署などの区切りです。1 人が複数のセクションに属せます。
        </p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Input
            value={sectionName}
            onChange={(event) => setSectionName(event.target.value)}
            placeholder="例: 基礎班"
            aria-label="セクション名"
            disabled={isPending}
            style={{ flex: '1 1 200px' }}
          />
          <Button
            onClick={() =>
              run(addSectionAction, { name: sectionName }, () => setSectionName(''))
            }
            disabled={isPending || sectionName.trim() === ''}
          >
            追加
          </Button>
        </div>

        {sections.length === 0 ? (
          <p style={{ ...muted, fontSize: '0.85rem' }}>まだセクションがありません。</p>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {sections.map((section) => (
              <Card
                key={section.id}
                style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}
              >
                {editing?.kind === 'section' && editing.id === section.id ? (
                  <>
                    <Input
                      value={editValue}
                      onChange={(event) => setEditValue(event.target.value)}
                      aria-label="セクションの新しい名前"
                      disabled={isPending}
                      style={{ flex: '1 1 180px' }}
                    />
                    <Button
                      size="sm"
                      onClick={() =>
                        run(
                          renameSectionAction,
                          { sectionId: section.id, name: editValue },
                          () => setEditing(null),
                        )
                      }
                      disabled={isPending}
                    >
                      保存
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setEditing(null)}
                      disabled={isPending}
                    >
                      やめる
                    </Button>
                  </>
                ) : (
                  <>
                    <span style={{ flex: 1, fontSize: '0.9rem' }}>{section.name}</span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setEditing({ kind: 'section', id: section.id })
                        setEditValue(section.name)
                      }}
                      disabled={isPending}
                    >
                      名前を変える
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => run(removeSectionAction, { sectionId: section.id })}
                      disabled={isPending}
                    >
                      削除
                    </Button>
                  </>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      <section style={{ display: 'grid', gap: 10 }}>
        <h2 className="tm-h2">メンバー</h2>
        <p style={{ ...muted, fontSize: '0.82rem' }}>
          作業にあたる人の名簿です。ここに登録した人は<strong>ログインしません</strong>。
          タスクの担当として選べるようになります。
        </p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Input
            value={memberName}
            onChange={(event) => setMemberName(event.target.value)}
            placeholder="例: 田中 太郎"
            aria-label="メンバーの名前"
            disabled={isPending}
            style={{ flex: '1 1 200px' }}
          />
          <Button
            onClick={() => run(addMemberAction, { name: memberName }, () => setMemberName(''))}
            disabled={isPending || memberName.trim() === ''}
          >
            追加
          </Button>
        </div>

        {members.length === 0 ? (
          <p style={{ ...muted, fontSize: '0.85rem' }}>まだメンバーがいません。</p>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {members.map((member) => {
              const belongsTo = new Set(member.sections.map((section) => section.id))

              return (
                <Card key={member.id} style={{ display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {editing?.kind === 'member' && editing.id === member.id ? (
                      <>
                        <Input
                          value={editValue}
                          onChange={(event) => setEditValue(event.target.value)}
                          aria-label="メンバーの新しい名前"
                          disabled={isPending}
                          style={{ flex: '1 1 180px' }}
                        />
                        <Button
                          size="sm"
                          onClick={() =>
                            run(
                              renameMemberAction,
                              { memberId: member.id, name: editValue },
                              () => setEditing(null),
                            )
                          }
                          disabled={isPending}
                        >
                          保存
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setEditing(null)}
                          disabled={isPending}
                        >
                          やめる
                        </Button>
                      </>
                    ) : (
                      <>
                        <span style={{ flex: 1, fontSize: '0.95rem', fontWeight: 600 }}>
                          {member.name}
                        </span>
                        <span style={{ ...muted, fontSize: '0.78rem' }}>
                          {member.sections.length === 0
                            ? UNASSIGNED_SECTION
                            : member.sections.map((section) => section.name).join('・')}
                        </span>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setEditing({ kind: 'member', id: member.id })
                            setEditValue(member.name)
                          }}
                          disabled={isPending}
                        >
                          名前を変える
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => run(removeMemberAction, { memberId: member.id })}
                          disabled={isPending}
                        >
                          削除
                        </Button>
                      </>
                    )}
                  </div>

                  {sections.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {sections.map((section) => {
                        const assigned = belongsTo.has(section.id)

                        return (
                          <Button
                            key={section.id}
                            size="sm"
                            variant={assigned ? 'primary' : 'secondary'}
                            aria-pressed={assigned}
                            onClick={() =>
                              run(toggleSectionAction, {
                                memberId: member.id,
                                sectionId: section.id,
                                assign: assigned ? 'false' : 'true',
                              })
                            }
                            disabled={isPending}
                          >
                            {section.name}
                          </Button>
                        )
                      })}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}

        <p style={{ ...muted, fontSize: '0.78rem' }}>
          メンバーを削除しても、そのタスクは残ります。担当だけが空になります。
        </p>
      </section>
    </div>
  )
}
