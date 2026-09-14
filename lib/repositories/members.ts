import type { SupabaseClient } from '@supabase/supabase-js'
import type { SectionRef } from '@/lib/domain/member'

export type ProjectMember = {
  id: string
  name: string
  /** 所属。付けた順に並ぶ。先頭が「最初の所属」 */
  sections: SectionRef[]
}

export type Section = {
  id: string
  name: string
  position: number
}

export interface MemberRepository {
  listMembers(projectId: string): Promise<ProjectMember[]>
  listSections(projectId: string): Promise<Section[]>
  addMember(projectId: string, name: string): Promise<void>
  renameMember(memberId: string, name: string): Promise<void>
  removeMember(memberId: string): Promise<void>
  addSection(projectId: string, name: string): Promise<void>
  renameSection(sectionId: string, name: string): Promise<void>
  removeSection(sectionId: string): Promise<void>
  /** 所属を付ける。すでに付いていれば何もしない */
  assignSection(memberId: string, sectionId: string): Promise<void>
  unassignSection(memberId: string, sectionId: string): Promise<void>
}

type MemberRow = {
  id: string
  name: string
  member_sections: {
    created_at: string
    sections: { id: string; name: string } | null
  }[]
}

export function createSupabaseMemberRepository(supabase: SupabaseClient): MemberRepository {
  return {
    async listMembers(projectId) {
      const { data, error } = await supabase
        .from('project_members')
        .select('id, name, member_sections(created_at, sections(id, name))')
        .eq('project_id', projectId)
        .order('name')
      if (error) throw error

      return ((data ?? []) as unknown as MemberRow[]).map((row) => ({
        id: row.id,
        name: row.name,
        // 付けた順に並べる。先頭が「最初の所属」になる
        sections: [...row.member_sections]
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .map((link) => link.sections)
          .filter((section): section is SectionRef => section !== null),
      }))
    },

    async listSections(projectId) {
      const { data, error } = await supabase
        .from('sections')
        .select('id, name, position')
        .eq('project_id', projectId)
        .order('position')
        .order('name')
      if (error) throw error

      return (data ?? []) as Section[]
    },

    async addMember(projectId, name) {
      const { error } = await supabase
        .from('project_members')
        .insert({ project_id: projectId, name })
      if (error) throw error
    },

    async renameMember(memberId, name) {
      const { error } = await supabase
        .from('project_members')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', memberId)
      if (error) throw error
    },

    async removeMember(memberId) {
      const { error } = await supabase.from('project_members').delete().eq('id', memberId)
      if (error) throw error
    },

    async addSection(projectId, name) {
      const { error } = await supabase.from('sections').insert({ project_id: projectId, name })
      if (error) throw error
    },

    async renameSection(sectionId, name) {
      const { error } = await supabase.from('sections').update({ name }).eq('id', sectionId)
      if (error) throw error
    },

    async removeSection(sectionId) {
      const { error } = await supabase.from('sections').delete().eq('id', sectionId)
      if (error) throw error
    },

    async assignSection(memberId, sectionId) {
      // すでに付いていれば何もしない。押し直しで失敗させない
      const { error } = await supabase
        .from('member_sections')
        .upsert(
          { member_id: memberId, section_id: sectionId },
          { onConflict: 'member_id,section_id', ignoreDuplicates: true },
        )
      if (error) throw error
    },

    async unassignSection(memberId, sectionId) {
      const { error } = await supabase
        .from('member_sections')
        .delete()
        .eq('member_id', memberId)
        .eq('section_id', sectionId)
      if (error) throw error
    },
  }
}
