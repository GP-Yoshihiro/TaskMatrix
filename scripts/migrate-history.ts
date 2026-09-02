/**
 * 既存の file_versions から history_entries を作る 1 回限りの移行。
 *
 * 変更履歴機能の導入前に保存された版から差分を計算し、履歴として登録する。
 * 「プロジェクト始動時から遡れる」という仕様を満たすために必要。
 *
 * 差分の計算はアプリ本体と同じ関数を使う（二重に実装して食い違わせないため）。
 *
 * 実行（拡張子つきの相対 import を解決するため jiti を使う）:
 *   node_modules/.bin/jiti scripts/migrate-history.ts            # 表示のみ
 *   node_modules/.bin/jiti scripts/migrate-history.ts --apply    # 実際に登録
 *
 * アプリ本体とは import の書き方が異なるため、tsconfig の型検査からは除外している。
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { buildChangeSet } from '../lib/domain/history.ts'
import { getExtension } from '../lib/domain/files.ts'
import { resolveAuthorName } from '../lib/domain/profile.ts'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
)

const apply = process.argv.includes('--apply')

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

type VersionRow = {
  file_id: string
  version: number
  content: string | null
  author_id: string | null
  created_at: string
}

type FileRow = {
  id: string
  project_id: string
  name: string
  kind: string
}

const { data: fileData, error: fileError } = await supabase
  .from('files')
  .select('id, project_id, name, kind')
if (fileError) throw fileError

const files = new Map((fileData as FileRow[]).map((file) => [file.id, file]))

const { data: versionData, error: versionError } = await supabase
  .from('file_versions')
  .select('file_id, version, content, author_id, created_at')
  .order('file_id')
  .order('version')
if (versionError) throw versionError

const { data: profileData } = await supabase
  .from('profiles')
  .select('id, display_name, email')

const profiles = new Map(
  ((profileData ?? []) as { id: string; display_name: string; email: string }[]).map((p) => [
    p.id,
    p,
  ]),
)

const { count: existing } = await supabase
  .from('history_entries')
  .select('id', { count: 'exact', head: true })

console.log(`既存の履歴: ${existing ?? 0} 件`)
if ((existing ?? 0) > 0) {
  console.log('すでに履歴があります。二重登録を避けるため中止します。')
  process.exit(0)
}

const rows: Record<string, unknown>[] = []
const previousByFile = new Map<string, string>()

for (const version of versionData as VersionRow[]) {
  const file = files.get(version.file_id)
  if (!file) continue

  const before = previousByFile.get(version.file_id) ?? ''
  const after = version.content ?? ''
  const changeSet = buildChangeSet(before, after)

  const profile = version.author_id ? profiles.get(version.author_id) : undefined

  rows.push({
    project_id: file.project_id,
    file_id: file.id,
    file_name: file.name,
    file_extension: getExtension(file.name),
    file_kind: file.kind,
    action: version.version === 1 ? 'created' : 'updated',
    version: version.version,
    changes: changeSet.changes,
    added_count: changeSet.addedCount,
    removed_count: changeSet.removedCount,
    truncated: changeSet.truncated,
    author_id: version.author_id,
    author_name: resolveAuthorName({
      displayName: profile?.display_name ?? null,
      email: profile?.email ?? null,
      snapshot: '',
    }),
    // 元の記録日時を保つ。移行した日時にすると時系列が壊れる
    created_at: version.created_at,
  })

  previousByFile.set(version.file_id, after)
}

console.log(`登録する履歴: ${rows.length} 件`)
for (const row of rows) {
  console.log(
    `  ${row.created_at} ${row.file_name} v${row.version} ` +
      `${row.action} +${row.added_count} -${row.removed_count} (${row.author_name})`,
  )
}

if (!apply) {
  console.log('')
  console.log('※ 表示のみです。登録するには --apply を付けて実行してください。')
  process.exit(0)
}

const { error: insertError } = await supabase.from('history_entries').insert(rows)
if (insertError) throw insertError

console.log('')
console.log(`登録しました: ${rows.length} 件`)
