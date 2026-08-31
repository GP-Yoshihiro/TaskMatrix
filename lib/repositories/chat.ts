import type { SupabaseClient } from '@supabase/supabase-js'

export type ChatSource = {
  fileId: string
  fileName: string
  chunkIndex: number
  excerpt: string
}

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources: ChatSource[]
  createdAt: string
}

export interface ChatRepository {
  findOrCreateSession(input: { projectId: string; userId: string }): Promise<{ id: string }>
  listMessages(sessionId: string): Promise<ChatMessage[]>
  addMessage(input: {
    sessionId: string
    role: 'user' | 'assistant'
    content: string
    sources: ChatSource[]
  }): Promise<void>
}

type MessageRow = {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources: ChatSource[]
  created_at: string
}

export function createSupabaseChatRepository(supabase: SupabaseClient): ChatRepository {
  return {
    /** プロジェクトごとに 1 つの会話を使う。無ければ作る */
    async findOrCreateSession({ projectId, userId }) {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('id')
        .eq('project_id', projectId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      if (data) return { id: (data as { id: string }).id }

      const created = await supabase
        .from('chat_sessions')
        .insert({ project_id: projectId, created_by: userId })
        .select('id')
        .single()
      if (created.error) throw created.error
      return { id: (created.data as { id: string }).id }
    },

    async listMessages(sessionId) {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, role, content, sources, created_at')
        .eq('session_id', sessionId)
        .order('created_at')
      if (error) throw error

      return ((data ?? []) as MessageRow[]).map((row) => ({
        id: row.id,
        role: row.role,
        content: row.content,
        sources: Array.isArray(row.sources) ? row.sources : [],
        createdAt: row.created_at,
      }))
    },

    async addMessage({ sessionId, role, content, sources }) {
      const { error } = await supabase
        .from('chat_messages')
        .insert({ session_id: sessionId, role, content, sources })
      if (error) throw error

      await supabase
        .from('chat_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', sessionId)
    },
  }
}
