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

  const { data: project } = await supabase
    .from('projects')
    .select('id, name')
    .eq('id', projectId)
    .maybeSingle()

  if (!project) notFound()

  const user = await getCurrentUser()

  const chunks = createSupabaseFileChunkRepository(supabase)
  const chat = createSupabaseChatRepository(supabase)

  const indexedChunks = await chunks.countByProject(projectId)

  const session = user
    ? await chat.findOrCreateSession({ projectId, userId: user.id })
    : null
  const messages = session ? await chat.listMessages(session.id) : []

  // 処理中に「あとどれくらいか」を出すため、過去の実績から予測を作る
  const usageRepository = createSupabaseAiUsageRepository(supabase)
  const estimates = {
    build_index: await loadEstimate(usageRepository, 'build_index'),
    answer_question: await loadEstimate(usageRepository, 'answer_question'),
  }

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
