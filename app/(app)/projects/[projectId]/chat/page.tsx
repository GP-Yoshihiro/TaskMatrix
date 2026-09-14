import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { RagChat } from '@/components/features/chat/rag-chat'
import { createSupabaseAiUsageRepository } from '@/lib/repositories/ai-usage'
import { createSupabaseChatRepository } from '@/lib/repositories/chat'
import { createSupabaseFileChunkRepository } from '@/lib/repositories/file-chunks'
import { getCurrentUser } from '@/lib/supabase/current-user'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { loadEstimate } from '@/lib/usecases/load-estimate'

/** 埋め込みの作成と回答の生成に時間がかかるため、実行時間の上限を延ばす */
export const maxDuration = 300

export default async function ChatPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const supabase = await createServerSupabaseClient()

  const chunks = createSupabaseFileChunkRepository(supabase)
  const chat = createSupabaseChatRepository(supabase)
  // 処理中に「あとどれくらいか」を出すため、過去の実績から予測を作る
  const usageRepository = createSupabaseAiUsageRepository(supabase)

  // 互いに依存しない取得を束ねる。順に待つと待ち時間が足し算になる
  const [{ data: project }, user, indexedChunks, buildEstimate, answerEstimate] =
    await Promise.all([
      supabase.from('projects').select('id, name').eq('id', projectId).maybeSingle(),
      getCurrentUser(),
      chunks.countByProject(projectId),
      loadEstimate(usageRepository, 'build_index'),
      loadEstimate(usageRepository, 'answer_question'),
    ])

  if (!project) notFound()

  // ここだけは利用者が決まってからでないと引けない
  const session = user
    ? await chat.findOrCreateSession({ projectId, userId: user.id })
    : null
  const messages = session ? await chat.listMessages(session.id) : []

  const estimates = { build_index: buildEstimate, answer_question: answerEstimate }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <PageHeader
        projectId={projectId}
        projectName={project.name}
        pageLabel="AI チャット"
        title="AI チャット"
        description="プロジェクト内の資料を根拠に、質問へ答えます。"
      />
      <RagChat
        projectId={projectId}
        messages={messages}
        indexedChunks={indexedChunks}
        estimates={estimates}
      />
    </div>
  )
}
